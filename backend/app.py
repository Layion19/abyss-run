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

# --- Bonus router + (optionnel) lecture des compteurs de bonus
from bonus_api import bonus_router  # doit exposer les routes /api/bonus/...
try:
    # à implémenter côté bonus_api.py : def get_bonus_counters(wallet:str)->dict
    from bonus_api import get_bonus_counters  # type: ignore
except Exception:
    def get_bonus_counters(wallet: str) -> Dict[str, int]:  # fallback si non dispo
        return {"silver": 0, "gold": 0}

# -------------------------------------------------------------------
# Config de base
# -------------------------------------------------------------------
load_dotenv()
app = FastAPI(title="Angry Whales – Abyss Run (wallet only)")
app.include_router(bonus_router)  # garde tes endpoints bonus

# CORS (ok en dev, restreins en prod)
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
    # NOTE: ici player_id = adresse wallet EVM (cf. game.js)
    player_id: str = Field(..., description="adresse EVM (0x...)")
    score: int = Field(..., ge=0)
    xp: int = Field(..., ge=0)
    level: int = Field(..., ge=1)

# Nouveau modèle pour le report-bonus
class BonusReportIn(BaseModel):
    wallet: str
    silver: int = 0
    gold: int = 0
    details: Optional[Dict[str, Any]] = None

# -------------------------------------------------------------------
# Données en mémoire
# -------------------------------------------------------------------
# Liste d’entrées triables (wallet unique par entrée)
# row = {player_id, display, score, xp, level, at}
LEADERS: List[Dict] = []

# -------------------------------------------------------------------
# Logging
# -------------------------------------------------------------------
LOG_PATH = Path(__file__).parent / "bonus_reports.log"
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("abyss")

# -------------------------------------------------------------------
# SMTP / EMAIL config (lu depuis .env)
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
    Compose et envoie le mail. Retourne un dict de status.
    Si SMTP n'est pas configuré, écrit dans le log en mode 'simulé'.
    """
    timestamp = datetime.utcnow().isoformat()
    subject = f"[Abyss Run] Bonus report for {short_addr(wallet) or wallet}"
    body = [
        f"Time (UTC): {timestamp}",
        f"Wallet: {wallet}",
        f"Silver: {payload.get('silver', 0)}",
        f"Gold:   {payload.get('gold', 0)}",
        "",
        "Details:",
        json.dumps(payload.get("details", {}), ensure_ascii=False, indent=2)
    ]
    text_body = "\n".join(body)

    log_line = f"[{timestamp}] Bonus report :: Wallet={wallet} :: Silver={payload.get('silver',0)} :: Gold={payload.get('gold',0)} :: details={json.dumps(payload.get('details',{}), ensure_ascii=False)}"
    append_log_line(log_line)

    # Si SMTP non configuré -> on retourne "simulé"
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASS:
        logger.info("SMTP non-configuré, mail simulé. Log line appended.")
        return {"ok": True, "sent": False, "reason": "SMTP not configured, logged only"}

    # Compose email
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = EMAIL_FROM
        msg["To"] = EMAIL_TO
        msg.set_content(text_body)

        # Connexion SMTP (STARTTLS)
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(SMTP_USER, SMTP_PASS)
            smtp.send_message(msg)
        logger.info("Bonus report email sent to %s for wallet %s", EMAIL_TO, wallet)
        return {"ok": True, "sent": True}
    except Exception as e:
        logger.exception("Failed to send bonus report email: %s", e)
        append_log_line(f"[{timestamp}] EMAIL_SEND_FAILED :: {str(e)}")
        return {"ok": False, "sent": False, "error": str(e)}

# -------------------------------------------------------------------
# Health
# -------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"ok": True, "entries": len(LEADERS)}

# -------------------------------------------------------------------
# Scores / Leaderboard
# -------------------------------------------------------------------
@app.post("/api/submit-score")
def submit_score(p: SubmitScoreIn):
    # validation simple
    if not is_evm(p.player_id):
        raise HTTPException(400, "player_id doit être une adresse EVM (0x...)")
    if p.score > 1_000_000 or p.xp > 200_000 or p.level > 1_000:
        raise HTTPException(400, "valeurs implausibles")

    wallet = p.player_id
    new_row = {
        "player_id": wallet,
        "display": short_addr(wallet) or wallet[:6],
        "score": int(p.score),
        "xp": int(p.xp),
        "level": int(p.level),
        "at": datetime.utcnow().isoformat()
    }

    # remplace la meilleure entrée du même wallet si (xp,score) est meilleur
    idx = next((i for i, row in enumerate(LEADERS) if row["player_id"] == wallet), None)
    if idx is None:
        LEADERS.append(new_row)
    else:
        old = LEADERS[idx]
        better = (new_row["xp"], new_row["score"]) > (old["xp"], old["score"])
        if better:
            LEADERS[idx] = new_row
        else:
            # au moins garder un display propre (peut changer si tu veux afficher autre chose)
            LEADERS[idx]["display"] = new_row["display"]

    # tri : XP d'abord, puis score
    LEADERS.sort(key=lambda x: (x["xp"], x["score"]), reverse=True)
    # limite mémoire
    if len(LEADERS) > 2000:
        del LEADERS[2000:]

    return {"ok": True}

@app.get("/api/leaderboard")
def leaderboard():
    # top 50 pour l’affichage
    return {"top": LEADERS[:50], "count": len(LEADERS)}

@app.get("/api/rank/{wallet}")
def api_rank(wallet: str):
    if not LEADERS:
        return {"rank": 1}
    for i, row in enumerate(LEADERS, start=1):
        if row["player_id"].lower() == wallet.lower():
            return {"rank": i}
    return {"rank": len(LEADERS) + 1}

@app.get("/api/my-rank/{wallet}")
def api_my_rank(wallet: str):
    """Renvoie rank, meilleur XP/score/level, et compteurs de bonus (si fournis par bonus_api)."""
    if not is_evm(wallet):
        raise HTTPException(400, "wallet invalide")

    # rank
    rank = len(LEADERS) + 1 if LEADERS else 1
    best = {"xp": 0, "score": 0, "level": 1}
    for i, row in enumerate(LEADERS, start=1):
        if row["player_id"].lower() == wallet.lower():
            rank = i
            best = {"xp": row["xp"], "score": row["score"], "level": row["level"]}
            break

    # compteurs de bonus (fallback -> 0/0)
    counts = {}
    try:
        counts = get_bonus_counters(wallet) or {}
    except Exception:
        counts = {}
    silver = int(counts.get("silver", 0))
    gold = int(counts.get("gold", 0))

    return {
        "rank": rank,
        "xp": best["xp"],
        "score": best["score"],
        "level": best["level"],
        "bonus": {"silver": silver, "gold": gold},
        "wallet": wallet,
        "display": short_addr(wallet),
    }

# -------------------------------------------------------------------
# Endpoint pour recevoir le report de bonus et envoyer le mail
# -------------------------------------------------------------------
@app.post("/api/report-bonuses")
def report_bonuses(payload: BonusReportIn, background: BackgroundTasks):
    wallet = payload.wallet
    if not is_evm(wallet):
        raise HTTPException(400, "wallet invalide")

    data = {"silver": int(payload.silver), "gold": int(payload.gold), "details": payload.details or {}}
    # Envoi en tâche de fond (non-bloquant)
    background.add_task(send_bonus_report_via_smtp, wallet, data)
    return {"ok": True, "queued": True}

# -------------------------------------------------------------------
# Lancement local
# -------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
