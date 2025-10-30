# backend/bonus_api.py
# VERSION MODIFIÉE : Silver max 2 par wallet (au lieu de 5)

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import time
import datetime as dt
import smtplib
from email.message import EmailMessage

from db_bonus import (
    init_db, get_or_create_inventory, inventory_remaining, has_stock, decrement_stock,
    get_wallet_counters, increment_wallet_counter, record_claim, reset_season_inventory
)

bonus_router = APIRouter(prefix="/api/bonus", tags=["bonus"])

# ============================================================
# SAISONS
# ============================================================

SEASON_RESET_DAY = 25

def current_season_id(now_ts: Optional[int] = None) -> str:
    """Saison = [25 du mois N, 25 du mois N+1)"""
    if now_ts is None:
        now_ts = int(time.time())
    now = dt.datetime.utcfromtimestamp(now_ts).replace(tzinfo=dt.timezone.utc)
    year = now.year
    month = now.month
    this_reset = dt.datetime(year, month, SEASON_RESET_DAY, 0, 0, 0, tzinfo=dt.timezone.utc)

    if now >= this_reset:
        start_year, start_month = year, month
    else:
        if month == 1:
            start_year, start_month = year - 1, 12
        else:
            start_year, start_month = year, month - 1
    return f"{start_year:04d}-{start_month:02d}"

# ============================================================
# Config e-mail
# ============================================================

EMAIL_ENABLED = os.getenv("EMAIL_ENABLED", "1") not in ("0", "false", "False", "")
EMAIL_SMTP_HOST = os.getenv("EMAIL_SMTP_HOST", "smtp.gmail.com")
EMAIL_SMTP_PORT = int(os.getenv("EMAIL_SMTP_PORT", "587"))
EMAIL_SMTP_USER = os.getenv("EMAIL_SMTP_USER", "angrywhales1@gmail.com")
EMAIL_SMTP_PASS = os.getenv("EMAIL_SMTP_PASS", "nkkmpgtwxdkrqfop")
EMAIL_FROM      = os.getenv("EMAIL_FROM", "angrywhales1@gmail.com")
EMAIL_TO_CLAIMS = os.getenv("EMAIL_TO_CLAIMS", "angrywhales1@gmail.com")

def send_email(subject: str, body: str) -> bool:
    """Envoie un email texte. Retourne True si succès, False sinon."""
    if not EMAIL_ENABLED:
        return False
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = EMAIL_FROM
        msg["To"] = EMAIL_TO_CLAIMS
        msg.set_content(body)

        with smtplib.SMTP(EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, timeout=12) as s:
            s.starttls()
            if EMAIL_SMTP_USER and EMAIL_SMTP_PASS:
                s.login(EMAIL_SMTP_USER, EMAIL_SMTP_PASS)
            s.send_message(msg)
        return True
    except Exception:
        return False

# ============================================================
# Config quotas + stocks
# ============================================================

# QUOTAS PAR WALLET ET PAR SAISON (MODIFIÉ : Silver = 2)
MAX_PER_WALLET = {
    "silver": 2,        # ← CHANGÉ de 5 à 2
    "gold": 1,
    "platinum": 1,
    "special": 1,
    "angrywhales": 1,
}

# Stocks par défaut
PLATINUM_STOCK_DEFAULT = int(os.getenv("PLATINUM_STOCK", "1"))
SILVER_STOCK_DEFAULT   = int(os.getenv("SILVER_STOCK", "20"))
GOLD_STOCK_DEFAULT     = int(os.getenv("GOLD_STOCK", "1"))
SPECIAL_STOCK_DEFAULT  = int(os.getenv("SPECIAL_STOCK", "4"))
AW_STOCK_DEFAULT       = int(os.getenv("AW_STOCK", "5"))

DEFAULT_STOCK = {
    "silver": SILVER_STOCK_DEFAULT,
    "gold": GOLD_STOCK_DEFAULT,
    "platinum": PLATINUM_STOCK_DEFAULT,
    "special": SPECIAL_STOCK_DEFAULT,
    "angrywhales": AW_STOCK_DEFAULT,
}

# ============================================================
# Helpers éligibilité
# ============================================================

def normalize_wallet(w: Optional[str]) -> str:
    if not w or not isinstance(w, str):
        return ""
    return w.lower().strip()

def holdings_for_wallet(wallet: str) -> int:
    # TODO: remplacer par la vraie lecture on-chain
    return 20

def can_play(wallet: str) -> bool:
    return holdings_for_wallet(wallet) >= 1

def eligible_for_bonus(wallet: str) -> bool:
    return holdings_for_wallet(wallet) >= 20

def max_per_wallet_reached(wallet: str, bonus_type: str, season_id: str) -> bool:
    limit = MAX_PER_WALLET.get(bonus_type)
    if not limit:
        return False
    counters = get_wallet_counters(wallet, season_id)
    return (counters.get(bonus_type, 0) or 0) >= limit

# ============================================================
# Fonction helper pour app.py
# ============================================================

def get_bonus_counters(wallet: str) -> Dict[str, int]:
    """Fonction helper pour app.py"""
    season = current_season_id()
    return get_wallet_counters(wallet, season)

# ============================================================
# Schémas
# ============================================================

class ClaimBody(BaseModel):
    type: str
    wallet: str
    run_id: Optional[str] = None

class ReportBody(BaseModel):
    wallet: Optional[str] = None
    silver: Optional[int] = 0
    gold: Optional[int] = 0
    platinum: Optional[int] = 0
    special: Optional[int] = 0
    angrywhales: Optional[int] = 0
    score: Optional[int] = 0
    xp: Optional[int] = 0

# ============================================================
# Boot DB
# ============================================================

init_db()

# ============================================================
# Routes
# ============================================================

@bonus_router.get("/availability")
async def bonus_availability():
    season = current_season_id()
    get_or_create_inventory(season, DEFAULT_STOCK)
    inv = inventory_remaining(season, DEFAULT_STOCK)
    return JSONResponse({
        "silver_remaining":       max(inv.get("silver", 0), 0),
        "gold_remaining":         max(inv.get("gold", 0), 0),
        "platinum_remaining":     max(inv.get("platinum", 0), 0),
        "special_remaining":      max(inv.get("special", 0), 0),
        "angrywhales_remaining":  max(inv.get("angrywhales", 0), 0),
        "season_id": season,
    })

@bonus_router.get("/eligibility/{wallet}")
async def bonus_eligibility(wallet: str):
    w = normalize_wallet(wallet)
    if not w:
        raise HTTPException(status_code=400, detail="missing_or_invalid_wallet")

    season = current_season_id()
    get_or_create_inventory(season, DEFAULT_STOCK)

    play_ok = can_play(w)
    bonus_ok = eligible_for_bonus(w)

    inv = inventory_remaining(season, DEFAULT_STOCK)
    silver_global       = max(inv.get("silver", 0), 0)
    gold_global         = max(inv.get("gold", 0), 0)
    platinum_global     = max(inv.get("platinum", 0), 0)
    special_global      = max(inv.get("special", 0), 0)
    angrywhales_global  = max(inv.get("angrywhales", 0), 0)

    counters = get_wallet_counters(w, season)
    silver_quota_left       = max(0, (MAX_PER_WALLET["silver"]      or 10**9) - (counters.get("silver", 0) or 0))
    gold_quota_left         = max(0, (MAX_PER_WALLET["gold"]        or 10**9) - (counters.get("gold", 0) or 0))
    platinum_quota_left     = max(0, (MAX_PER_WALLET["platinum"]    or 10**9) - (counters.get("platinum", 0) or 0))
    special_quota_left      = max(0, (MAX_PER_WALLET["special"]     or 10**9) - (counters.get("special", 0) or 0))
    angrywhales_quota_left  = max(0, (MAX_PER_WALLET["angrywhales"] or 10**9) - (counters.get("angrywhales", 0) or 0))

    if not bonus_ok:
        return JSONResponse({
            "can_play": play_ok,
            "bonus_eligible": False,
            "silver_left": 0,
            "gold_left": 0,
            "platinum_left": 0,
            "special_left": 0,
            "angrywhales_left": 0,
            "season_id": season,
        })

    return JSONResponse({
        "can_play": play_ok,
        "bonus_eligible": True,
        "silver_left":       min(silver_global, silver_quota_left),
        "gold_left":         min(gold_global, gold_quota_left),
        "platinum_left":     min(platinum_global, platinum_quota_left),
        "special_left":      min(special_global, special_quota_left),
        "angrywhales_left":  min(angrywhales_global, angrywhales_quota_left),
        "season_id": season,
    })

@bonus_router.post("/claim")
async def bonus_claim(body: ClaimBody):
    w = normalize_wallet(body.wallet)
    if not w:
        raise HTTPException(status_code=400, detail="missing_or_invalid_wallet")

    # Mapping front → type DB
    if body.type == "bonus2":
        bonus_type = "silver"
        label = "SILVER"
    elif body.type == "legendary":
        bonus_type = "gold"
        label = "GOLD"
    elif body.type == "platinum":
        bonus_type = "platinum"
        label = "PLATINUM"
    elif body.type == "special":
        bonus_type = "special"
        label = "SPECIAL"
    elif body.type == "angrywhales":
        bonus_type = "angrywhales"
        label = "ANGRY WHALES"
    else:
        raise HTTPException(status_code=400, detail="invalid_bonus_type")

    season = current_season_id()
    get_or_create_inventory(season, DEFAULT_STOCK)

    if not can_play(w):
        raise HTTPException(status_code=403, detail="cannot_play")

    if not eligible_for_bonus(w):
        raise HTTPException(status_code=403, detail="not_eligible")

    if max_per_wallet_reached(w, bonus_type, season):
        raise HTTPException(status_code=403, detail=f"max_{bonus_type}_reached")

    if not has_stock(season, bonus_type, DEFAULT_STOCK):
        raise HTTPException(status_code=409, detail="out_of_stock")

    new_claim = record_claim(w, season, bonus_type, body.run_id)
    if new_claim:
        ok = decrement_stock(season, bonus_type)
        if not ok:
            raise HTTPException(status_code=409, detail="out_of_stock")
        increment_wallet_counter(w, season, bonus_type)

    counters = get_wallet_counters(w, season)

    # Email
    subject = f"[Abyss Run] Claim {label} — {w[:6]}…{w[-4:]} (season {season})"
    lines = [
        f"Season: {season}",
        f"Wallet: {w}",
        f"Bonus : {label}",
        f"Run ID: {body.run_id or '-'}",
        "",
        "Counters (this wallet / season):",
        f"  SILVER      : {counters.get('silver', 0)}",
        f"  GOLD        : {counters.get('gold', 0)}",
        f"  PLATINUM    : {counters.get('platinum', 0)}",
        f"  SPECIAL     : {counters.get('special', 0)}",
        f"  ANGRY WHALES: {counters.get('angrywhales', 0)}",
        "",
        "— Abyss Run notifier",
    ]
    send_email(subject, "\n".join(lines))

    return JSONResponse({
        "ok": True,
        "type": body.type,
        "season_id": season,
        "counters": counters
    })

@bonus_router.get("/remaining")
async def bonus_remaining():
    season = current_season_id()
    get_or_create_inventory(season, DEFAULT_STOCK)
    inv = inventory_remaining(season, DEFAULT_STOCK)
    return JSONResponse({
        "silver":      max(inv.get("silver", 0), 0),
        "gold":        max(inv.get("gold", 0), 0),
        "platinum":    max(inv.get("platinum", 0), 0),
        "special":     max(inv.get("special", 0), 0),
        "angrywhales": max(inv.get("angrywhales", 0), 0),
        "season_id": season,
    })

@bonus_router.get("/stats/{wallet}")
async def bonus_stats(wallet: str):
    w = normalize_wallet(wallet)
    if not w:
        raise HTTPException(status_code=400, detail="missing_or_invalid_wallet")
    season = current_season_id()
    get_or_create_inventory(season, DEFAULT_STOCK)
    s = get_wallet_counters(w, season)
    return JSONResponse({
        "silver":      s.get("silver", 0),
        "gold":        s.get("gold", 0),
        "platinum":    s.get("platinum", 0),
        "special":     s.get("special", 0),
        "angrywhales": s.get("angrywhales", 0),
        "season_id": season,
    })

@bonus_router.post("/report")
async def bonus_report(payload: Dict[str, Any]):
    """Rapport de fin de run."""
    season = current_season_id()
    w = normalize_wallet(payload.get("wallet"))
    silver = int(payload.get("silver", 0) or 0)
    gold = int(payload.get("gold", 0) or 0)
    platinum = int(payload.get("platinum", 0) or 0)
    special = int(payload.get("special", 0) or 0)
    angrywhales = int(payload.get("angrywhales", 0) or 0)
    score = int(payload.get("score", 0) or 0)
    xp = int(payload.get("xp", 0) or 0)

    total = silver + gold + platinum + special + angrywhales
    if total > 0 and w:
        subject = f"[Abyss Run] Run report — {w[:6]}…{w[-4:]} (season {season})"
        lines = [
            f"Season: {season}",
            f"Wallet: {w}",
            "",
            "Bonuses picked in this run:",
            f"  SILVER      : {silver}",
            f"  GOLD        : {gold}",
            f"  PLATINUM    : {platinum}",
            f"  SPECIAL     : {special}",
            f"  ANGRY WHALES: {angrywhales}",
            "",
            f"Score: {score}",
            f"XP   : {xp}",
            "",
            "— Abyss Run notifier",
        ]
        send_email(subject, "\n".join(lines))

    return JSONResponse({"ok": True})

@bonus_router.get("/status")
async def bonus_status():
    season = current_season_id()
    get_or_create_inventory(season, DEFAULT_STOCK)
    return JSONResponse({
        "available": {
            "silver":      has_stock(season, "silver", DEFAULT_STOCK),
            "gold":        has_stock(season, "gold", DEFAULT_STOCK),
            "platinum":    has_stock(season, "platinum", DEFAULT_STOCK),
            "special":     has_stock(season, "special", DEFAULT_STOCK),
            "angrywhales": has_stock(season, "angrywhales", DEFAULT_STOCK),
        },
        "season_id": season,
    })

@bonus_router.post("/reset")
async def bonus_reset():
    season = current_season_id()
    reset_season_inventory(season, DEFAULT_STOCK)
    return JSONResponse({
        "ok": True,
        "available": {
            "silver":      has_stock(season, "silver", DEFAULT_STOCK),
            "gold":        has_stock(season, "gold", DEFAULT_STOCK),
            "platinum":    has_stock(season, "platinum", DEFAULT_STOCK),
            "special":     has_stock(season, "special", DEFAULT_STOCK),
            "angrywhales": has_stock(season, "angrywhales", DEFAULT_STOCK),
        },
        "season_id": season,
    })