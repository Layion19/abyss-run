# backend/app.py
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import json
import smtplib
from email.message import EmailMessage
import logging

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# --- Bonus router
from bonus_api import bonus_router

# --- Leaderboard DB (NOUVEAU)
from db_leaderboard import (
    init_leaderboard_db,
    submit_player_score,
    get_leaderboard,
    get_player_rank,
    get_player_stats,
    get_total_players,
    migrate_from_memory
)

# --- Bonus counters (optionnel)
try:
    from bonus_api import get_bonus_counters  # type: ignore
except Exception:
    def get_bonus_counters(wallet: str) -> Dict[str, int]:
        return {"silver": 0, "gold": 0, "platinum": 0, "special": 0, "angrywhales": 0}

# -------------------------------------------------------------------
# Config de base
# -------------------------------------------------------------------
load_dotenv()
app = FastAPI(title="Angry Whales – Abyss Run (wallet only)")
app.include_router(bonus_router)

# Initialiser la base de données leaderboard
init_leaderboard_db()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
STATIC_DIR = Path(__file__).parent / "static"
ABYSS_DIR = STATIC_DIR / "abyss"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def root_index():
    return FileResponse(ABYSS_DIR / "index.html")

@app.get("/abyss")
def serve_abyss():
    return FileResponse(ABYSS_DIR / "index.html")

# -------------------------------------------------------------------
# Modèles
# -------------------------------------------------------------------
def is_evm(a: str) -> bool:
    return isinstance(a, str) and a.startswith("0x") and len(a) >= 10

def short_addr(a: Optional[str]) -> Optional[str]:
    if not a:
        return None
    return (a[:6] + "…" + a[-4:]) if len(a) > 12 else a

class SubmitScoreIn(BaseModel):
    player_id: str = Field(..., description="adresse EVM (0x...)")
    score: int = Field(..., ge=0)
    xp: int = Field(..., ge=0)
    level: int = Field(..., ge=1)

class BonusReportIn(BaseModel):
    wallet: str
    silver: int = 0
    gold: int = 0
    platinum: int = 0
    special: int = 0
    angrywhales: int = 0
    score: int = 0
    xp: int = 0
    details: Optional[Dict[str, Any]] = None

# -------------------------------------------------------------------
# MIGRATION : Ancien système mémoire → SQLite (À EXÉCUTER UNE FOIS)
# -------------------------------------------------------------------
# Si tu as encore des données en mémoire (LEADERS), décommente cette section
# et lance le serveur UNE FOIS pour migrer les données, puis re-commente.

# LEADERS: List[Dict] = []  # Anciennes données en mémoire (si existantes)
# 
# @app.on_event("startup")
# def migrate_old_data():
#     """Migre les anciennes données en mémoire vers SQLite (à exécuter une seule fois)."""
#     if LEADERS:
#         count = migrate_from_memory(LEADERS)
#         logger.info(f"✅ Migrated {count} players from memory to SQLite")
#         LEADERS.clear()  # Vider la mémoire après migration

# -------------------------------------------------------------------
# Logging
# -------------------------------------------------------------------
LOG_PATH = Path(__file__).parent / "bonus_reports.log"
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("abyss")

# -------------------------------------------------------------------
# SMTP / EMAIL config
# -------------------------------------------------------------------
SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASS = os.environ.get("SMTP_PASS", "").strip()
EMAIL_FROM = os.environ.get("EMAIL_FROM", SMTP_USER).strip() or SMTP_USER
EMAIL_TO = os.environ.get("EMAIL_TO", EMAIL_FROM).strip() or EMAIL_FROM

def append_log_line(line: str):
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception as e:
        logger.exception("Error writing log: %s", e)

def send_bonus_report_via_smtp(wallet: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compose et envoie le mail avec XP + Bonus.
    """
    timestamp = datetime.utcnow().isoformat()
    subject = f"[Abyss Run] Game Report for {short_addr(wallet) or wallet}"
    
    # Récupérer les stats du joueur
    stats = get_player_stats(wallet)
    player_xp = stats.get("xp", 0) if stats else 0
    player_score = stats.get("score", 0) if stats else 0
    player_level = stats.get("level", 1) if stats else 1
    
    body = [
        f"Time (UTC): {timestamp}",
        f"Wallet: {wallet}",
        "",
        "=== PLAYER STATS ===",
        f"XP:    {player_xp}",
        f"Score: {player_score}",
        f"Level: {player_level}",
        "",
        "=== BONUSES CLAIMED THIS RUN ===",
        f"Special:      {payload.get('special', 0)}",
        f"Silver:       {payload.get('silver', 0)}",
        f"Gold:         {payload.get('gold', 0)}",
        f"Platinum:     {payload.get('platinum', 0)}",
        f"Angry Whales: {payload.get('angrywhales', 0)}",
        "",
        "Details:",
        json.dumps(payload.get("details", {}), ensure_ascii=False, indent=2),
        "",
        "— Abyss Run notifier"
    ]
    text_body = "\n".join(body)

    log_line = f"[{timestamp}] Report :: Wallet={wallet} :: XP={player_xp} :: Score={player_score} :: Bonuses={json.dumps({k:v for k,v in payload.items() if k in ['silver','gold','platinum','special','angrywhales']})}"
    append_log_line(log_line)

    if not SMTP_HOST or not SMTP_USER or not SMTP_PASS:
        logger.info("SMTP non-configuré, mail simulé. Log line appended.")
        return {"ok": True, "sent": False, "reason": "SMTP not configured, logged only"}

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = EMAIL_FROM
        msg["To"] = EMAIL_TO
        msg.set_content(text_body)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(SMTP_USER, SMTP_PASS)
            smtp.send_message(msg)
        logger.info("Game report email sent to %s for wallet %s", EMAIL_TO, wallet)
        return {"ok": True, "sent": True}
    except Exception as e:
        logger.exception("Failed to send game report email: %s", e)
        append_log_line(f"[{timestamp}] EMAIL_SEND_FAILED :: {str(e)}")
        return {"ok": False, "sent": False, "error": str(e)}

# -------------------------------------------------------------------
# Health
# -------------------------------------------------------------------
@app.get("/api/health")
def health():
    total = get_total_players()
    return {"ok": True, "total_players": total}

# -------------------------------------------------------------------
# Scores / Leaderboard (UTILISE MAINTENANT SQLite)
# -------------------------------------------------------------------
@app.post("/api/submit-score")
def submit_score(p: SubmitScoreIn):
    """Enregistre le score d'un joueur (permanent, jamais reset)."""
    if not is_evm(p.player_id):
        raise HTTPException(400, "player_id doit être une adresse EVM (0x...)")
    if p.score > 1_000_000 or p.xp > 200_000 or p.level > 1_000:
        raise HTTPException(400, "valeurs implausibles")

    wallet = p.player_id
    is_new_record = submit_player_score(wallet, p.xp, p.score, p.level)
    
    return {"ok": True, "new_record": is_new_record}

@app.get("/api/leaderboard")
def leaderboard():
    """Retourne le top 100 joueurs."""
    top = get_leaderboard(limit=100)
    return {"top": top, "count": len(top)}

@app.get("/api/rank/{wallet}")
def api_rank(wallet: str):
    """Retourne le rang d'un joueur."""
    rank = get_player_rank(wallet)
    return {"rank": rank}

@app.get("/api/my-rank/{wallet}")
def api_my_rank(wallet: str):
    """Renvoie rank, XP/score/level, et compteurs de bonus."""
    if not is_evm(wallet):
        raise HTTPException(400, "wallet invalide")

    rank = get_player_rank(wallet)
    stats = get_player_stats(wallet)
    
    if not stats:
        # Joueur n'a jamais joué
        return {
            "rank": rank,
            "xp": 0,
            "score": 0,
            "level": 1,
            "bonus": {"silver": 0, "gold": 0, "platinum": 0, "special": 0, "angrywhales": 0},
            "wallet": wallet,
            "display": short_addr(wallet),
        }

    # Compteurs de bonus
    counts = {}
    try:
        counts = get_bonus_counters(wallet) or {}
    except Exception:
        counts = {}

    return {
        "rank": rank,
        "xp": stats["xp"],
        "score": stats["score"],
        "level": stats["level"],
        "bonus": {
            "silver": int(counts.get("silver", 0)),
            "gold": int(counts.get("gold", 0)),
            "platinum": int(counts.get("platinum", 0)),
            "special": int(counts.get("special", 0)),
            "angrywhales": int(counts.get("angrywhales", 0))
        },
        "wallet": wallet,
        "display": stats["display"],
    }

# -------------------------------------------------------------------
# Endpoint pour recevoir le report de bonus et envoyer le mail
# -------------------------------------------------------------------
@app.post("/api/report-bonuses")
def report_bonuses(payload: BonusReportIn, background: BackgroundTasks):
    """Envoie un email récapitulatif avec XP + Bonus."""
    wallet = payload.wallet
    if not is_evm(wallet):
        raise HTTPException(400, "wallet invalide")

    data = {
        "silver": int(payload.silver),
        "gold": int(payload.gold),
        "platinum": int(payload.platinum),
        "special": int(payload.special),
        "angrywhales": int(payload.angrywhales),
        "score": int(payload.score),
        "xp": int(payload.xp),
        "details": payload.details or {}
    }
    
    # Envoi en tâche de fond (non-bloquant)
    background.add_task(send_bonus_report_via_smtp, wallet, data)
    return {"ok": True, "queued": True}

# -------------------------------------------------------------------
# Lancement local
# -------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)