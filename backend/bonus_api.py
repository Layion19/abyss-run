# backend/bonus_api.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict
import os
import time
import datetime as dt

# Import absolu (on lance depuis backend/)
from db_bonus import (
    init_db, get_or_create_inventory, inventory_remaining, has_stock, decrement_stock,
    get_wallet_counters, increment_wallet_counter, record_claim, reset_season_inventory
)

bonus_router = APIRouter(prefix="/api/bonus", tags=["bonus"])

# ============================================================
# SAISONS — Reset mensuel chaque 25 du mois (00:00:00 UTC)
# ============================================================

SEASON_RESET_DAY = 25  # reset le 25

def current_season_id(now_ts: Optional[int] = None) -> str:
    """
    Saison = [25 du mois N, 25 du mois N+1)
    ID lisible: YYYY-MM (mois du reset de départ)
    """
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
# Config quotas + stocks par défaut
# ============================================================

# Quotas PAR WALLET et PAR SAISON
MAX_PER_WALLET = {
    "silver": 5,
    "gold": 1,
    "platinum": 1,
    "special": 1,         # <= demandé
    "angry_whales": 1,    # <= demandé (1 par wallet / saison)
}

# Overrides possibles via variables d'env si besoin
PLATINUM_STOCK_DEFAULT = int(os.getenv("PLATINUM_STOCK", "1"))
SILVER_STOCK_DEFAULT   = int(os.getenv("SILVER_STOCK", "20"))
GOLD_STOCK_DEFAULT     = int(os.getenv("GOLD_STOCK", "1"))
SPECIAL_STOCK_DEFAULT  = int(os.getenv("SPECIAL_STOCK", "4"))     # 4 Specials visibles côté index
AW_STOCK_DEFAULT       = int(os.getenv("AW_STOCK", "5"))           # 5 Angry Whales visibles côté index

DEFAULT_STOCK = {
    "silver": SILVER_STOCK_DEFAULT,
    "gold": GOLD_STOCK_DEFAULT,
    "platinum": PLATINUM_STOCK_DEFAULT,
    "special": SPECIAL_STOCK_DEFAULT,
    "angry_whales": AW_STOCK_DEFAULT,
}

# ============================================================
# Helpers éligibilité (stub à remplacer par ta vraie lecture on-chain)
# ============================================================

def normalize_wallet(w: Optional[str]) -> str:
    if not w or not isinstance(w, str):
        return ""
    return w.lower().strip()

def holdings_for_wallet(wallet: str) -> int:
    # TODO: remplacer par la vraie lecture on-chain / indexer
    return 20  # stub

def can_play(wallet: str) -> bool:
    return holdings_for_wallet(wallet) >= 1

def eligible_for_bonus(wallet: str) -> bool:
    # Condition globale d'éligibilité bonus (>= 20 NFTs pour l’instant)
    return holdings_for_wallet(wallet) >= 20

def max_per_wallet_reached(wallet: str, bonus_type: str, season_id: str) -> bool:
    limit = MAX_PER_WALLET.get(bonus_type)
    if not limit:
        return False
    counters = get_wallet_counters(wallet, season_id)
    return (counters.get(bonus_type, 0) or 0) >= limit

# ============================================================
# Schémas
# ============================================================

class ClaimBody(BaseModel):
    # Types front:
    #   - "bonus2"        → silver
    #   - "legendary"     → gold
    #   - "platinum"      → platinum
    #   - "special"       → special          (nouveau)
    #   - "angry_whales"  → angry_whales    (nouveau)
    type: str
    wallet: str
    run_id: Optional[str] = None

class ReportBody(BaseModel):
    wallet: Optional[str] = None
    silver: int
    gold: int
    score: int
    xp: int

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
        "silver_remaining":     max(inv.get("silver", 0), 0),
        "gold_remaining":       max(inv.get("gold", 0), 0),
        "platinum_remaining":   max(inv.get("platinum", 0), 0),
        "special_remaining":    max(inv.get("special", 0), 0),
        "angry_whales_remaining": max(inv.get("angry_whales", 0), 0),
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
    # Restant global
    silver_global       = max(inv.get("silver", 0), 0)
    gold_global         = max(inv.get("gold", 0), 0)
    platinum_global     = max(inv.get("platinum", 0), 0)
    special_global      = max(inv.get("special", 0), 0)
    angry_whales_global = max(inv.get("angry_whales", 0), 0)

    # Restant côté wallet (quota saison)
    counters = get_wallet_counters(w, season)
    silver_quota_left       = max(0, (MAX_PER_WALLET["silver"]       or 10**9) - (counters.get("silver", 0) or 0))
    gold_quota_left         = max(0, (MAX_PER_WALLET["gold"]         or 10**9) - (counters.get("gold", 0) or 0))
    platinum_quota_left     = max(0, (MAX_PER_WALLET["platinum"]     or 10**9) - (counters.get("platinum", 0) or 0))
    special_quota_left      = max(0, (MAX_PER_WALLET["special"]      or 10**9) - (counters.get("special", 0) or 0))
    angry_whales_quota_left = max(0, (MAX_PER_WALLET["angry_whales"] or 10**9) - (counters.get("angry_whales", 0) or 0))

    if not bonus_ok:
        return JSONResponse({
            "can_play": play_ok,
            "bonus_eligible": False,
            "silver_left": 0,
            "gold_left": 0,
            "platinum_left": 0,
            "special_left": 0,
            "angry_whales_left": 0,
            "season_id": season,
        })

    return JSONResponse({
        "can_play": play_ok,
        "bonus_eligible": True,
        "silver_left":       min(silver_global,       silver_quota_left),
        "gold_left":         min(gold_global,         gold_quota_left),
        "platinum_left":     min(platinum_global,     platinum_quota_left),
        "special_left":      min(special_global,      special_quota_left),
        "angry_whales_left": min(angry_whales_global, angry_whales_quota_left),
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
    elif body.type == "legendary":
        bonus_type = "gold"
    elif body.type == "platinum":
        bonus_type = "platinum"
    elif body.type == "special":
        bonus_type = "special"
    elif body.type == "angry_whales":
        bonus_type = "angry_whales"
    else:
        raise HTTPException(status_code=400, detail="invalid_bonus_type")

    season = current_season_id()
    get_or_create_inventory(season, DEFAULT_STOCK)

    # 1) accès jeu
    if not can_play(w):
        raise HTTPException(status_code=403, detail="cannot_play")

    # 2) éligibilité bonus
    if not eligible_for_bonus(w):
        raise HTTPException(status_code=403, detail="not_eligible")

    # 3) quota wallet
    if max_per_wallet_reached(w, bonus_type, season):
        raise HTTPException(status_code=403, detail=f"max_{bonus_type}_reached")

    # 4) stock global
    if not has_stock(season, bonus_type, DEFAULT_STOCK):
        raise HTTPException(status_code=409, detail="out_of_stock")

    # 5) idempotence + décrément + compteur
    new_claim = record_claim(w, season, bonus_type, body.run_id)
    if new_claim:
        ok = decrement_stock(season, bonus_type)
        if not ok:
            # Si un autre process a pris le dernier slot juste avant
            raise HTTPException(status_code=409, detail="out_of_stock")
        increment_wallet_counter(w, season, bonus_type)

    counters = get_wallet_counters(w, season)
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
        "silver":       max(inv.get("silver", 0), 0),
        "gold":         max(inv.get("gold", 0), 0),
        "platinum":     max(inv.get("platinum", 0), 0),
        "special":      max(inv.get("special", 0), 0),
        "angry_whales": max(inv.get("angry_whales", 0), 0),
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
        "silver": s.get("silver", 0),
        "gold": s.get("gold", 0),
        "platinum": s.get("platinum", 0),
        "special": s.get("special", 0),
        "angry_whales": s.get("angry_whales", 0),
        "season_id": season,
    })

@bonus_router.post("/report")
async def bonus_report(_: dict):
    # À brancher si tu veux logguer score/xp/bonus en DB
    return JSONResponse({"ok": True})

@bonus_router.get("/status")
async def bonus_status():
    season = current_season_id()
    get_or_create_inventory(season, DEFAULT_STOCK)
    return JSONResponse({
        "available": {
            "silver":       has_stock(season, "silver", DEFAULT_STOCK),
            "gold":         has_stock(season, "gold", DEFAULT_STOCK),
            "platinum":     has_stock(season, "platinum", DEFAULT_STOCK),
            "special":      has_stock(season, "special", DEFAULT_STOCK),
            "angry_whales": has_stock(season, "angry_whales", DEFAULT_STOCK),
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
            "silver":       has_stock(season, "silver", DEFAULT_STOCK),
            "gold":         has_stock(season, "gold", DEFAULT_STOCK),
            "platinum":     has_stock(season, "platinum", DEFAULT_STOCK),
            "special":      has_stock(season, "special", DEFAULT_STOCK),
            "angry_whales": has_stock(season, "angry_whales", DEFAULT_STOCK),
        },
        "season_id": season,
    })
