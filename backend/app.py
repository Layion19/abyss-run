# backend/app.py
from __future__ import annotations

import os
import secrets
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# OAuth1 (v1.1) libs
from requests_oauthlib import OAuth1Session

# ---------------------------
#   Config & env
# ---------------------------
load_dotenv()  # charge .env (à la racine ou dans backend/)

# >>> IMPORTANT <<<  (v1.1 - plan gratuit)
TW_CONSUMER_KEY = os.getenv("TW_CONSUMER_KEY", "")
TW_CONSUMER_SECRET = os.getenv("TW_CONSUMER_SECRET", "")
TW_REDIRECT_URI = os.getenv("TW_REDIRECT_URI", "")  # ex: http://127.0.0.1:8000/auth/x/callback

if not (TW_CONSUMER_KEY and TW_CONSUMER_SECRET and TW_REDIRECT_URI):
    print("[WARN] Variables .env manquantes: TW_CONSUMER_KEY / TW_CONSUMER_SECRET / TW_REDIRECT_URI")

# stockage temporaire pour OAuth1: oauth_token -> oauth_token_secret
REQ_TOKENS: Dict[str, str] = {}
COOKIE_REQTOK = "tw_reqtok"

app = FastAPI(title="Angry Whales – Abyss Run")

# CORS (inutile en même origine, mais prêt si tu changes d’hébergement)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # mets ton domaine si tu veux restreindre
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Static
STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    return FileResponse(STATIC_DIR / "abyss" / "index.html")

# Page Abyss Run
ABYSS_DIR = STATIC_DIR / "abyss"

@app.get("/abyss")
def serve_abyss():
    return FileResponse(ABYSS_DIR / "index.html")


# ---------------------------
#   Données "in-memory"
# ---------------------------
# player_id -> {"twitter": "...", "wallet": "...", "created_at": "...", "twitter_id": "..."}
PLAYERS: Dict[str, Dict] = {}
# [{player_id, display, score, xp, level, at}]
LEADERS: List[Dict] = []


# ---------------------------
#   Schemas API
# ---------------------------
class LoginTwitterIn(BaseModel):
    twitter: str = Field(..., description="handle Twitter sans @ ou avec, ex: @lionel")

class LinkWalletIn(BaseModel):
    player_id: str
    wallet_evm: str = Field(..., description="adresse EVM (0x...)")

class SubmitScoreIn(BaseModel):
    player_id: str
    score: int = Field(..., ge=0)
    xp: int = Field(..., ge=0)
    level: int = Field(..., ge=1)


# ---------------------------
#   Health
# ---------------------------
@app.get("/api/health")
def health():
    return {"ok": True, "players": len(PLAYERS), "entries": len(LEADERS)}


# ---------------------------
#   Auth légère (XP only)
# ---------------------------
@app.post("/api/login/twitter")
def login_twitter(p: LoginTwitterIn):
    handle = p.twitter.strip()
    if handle.startswith("@"):
        handle = handle[1:]
    if not handle or " " in handle or len(handle) > 32:
        raise HTTPException(400, "twitter handle invalide")

    for pid, prof in PLAYERS.items():
        if prof.get("twitter", "").lower() == handle.lower():
            return {"ok": True, "player_id": pid, "display": f"@{handle}"}

    pid = secrets.token_hex(16)
    PLAYERS[pid] = {
        "twitter": handle,
        "wallet": None,
        "created_at": datetime.utcnow().isoformat(),
        "twitter_id": None,
    }
    return {"ok": True, "player_id": pid, "display": f"@{handle}"}


@app.post("/api/link-wallet")
def link_wallet(p: LinkWalletIn):
    prof = PLAYERS.get(p.player_id)
    if not prof:
        raise HTTPException(404, "player inconnu")
    if not (p.wallet_evm.startswith("0x") and len(p.wallet_evm) >= 10):
        raise HTTPException(400, "adresse EVM invalide")
    prof["wallet"] = p.wallet_evm
    return {"ok": True, "player_id": p.player_id, "wallet": short_addr(p.wallet_evm)}


@app.get("/api/me/{player_id}")
def me(player_id: str):
    prof = PLAYERS.get(player_id)
    if not prof:
        raise HTTPException(404, "player inconnu")
    return {
        "player_id": player_id,
        "twitter": f"@{prof['twitter']}" if prof.get("twitter") else None,
        "wallet": short_addr(prof["wallet"]) if prof.get("wallet") else None,
        "created_at": prof["created_at"],
    }


# ---------------------------
#   Scores / Leaderboard
# ---------------------------
def _display_name_for(pid: str) -> str:
    prof = PLAYERS.get(pid) or {}
    if prof.get("twitter"):
        return f"@{prof['twitter']}"
    if prof.get("wallet"):
        return short_addr(prof["wallet"]) or pid[:6]
    return pid[:6]

@app.post("/api/submit-score")
def submit_score(p: SubmitScoreIn):
    if p.player_id not in PLAYERS:
        raise HTTPException(404, "player inconnu")

    # petits garde-fous
    if p.score > 1_000_000 or p.xp > 200_000 or p.level > 1_000:
        raise HTTPException(400, "valeurs implausibles")

    # On conserve le meilleur enregistrement par joueur (tri XP puis score)
    existing_idx: Optional[int] = next((i for i, row in enumerate(LEADERS) if row["player_id"] == p.player_id), None)

    new_row = {
        "player_id": p.player_id,
        "display": _display_name_for(p.player_id),
        "score": int(p.score),
        "xp": int(p.xp),
        "level": int(p.level),
        "at": datetime.utcnow().isoformat()
    }

    if existing_idx is None:
        LEADERS.append(new_row)
    else:
        old = LEADERS[existing_idx]
        # remplace si meilleur (XP prioritaire, puis score)
        better = (new_row["xp"], new_row["score"]) > (old["xp"], old["score"])
        if better:
            LEADERS[existing_idx] = new_row
        else:
            # sinon on met juste à jour l’affichage (handle peut avoir changé)
            LEADERS[existing_idx]["display"] = new_row["display"]

    LEADERS.sort(key=lambda x: (x["xp"], x["score"]), reverse=True)
    # Optionnel: limite mémoire
    if len(LEADERS) > 2000:
        del LEADERS[2000:]

    return {"ok": True}

@app.get("/api/leaderboard")
def leaderboard():
    top = LEADERS[:50]
    return {"top": top, "count": len(LEADERS)}

@app.get("/api/rank/{player_id}")
def api_rank(player_id: str):
    if not LEADERS:
        return {"rank": 1}
    for i, row in enumerate(LEADERS, start=1):
        if row["player_id"] == player_id:
            return {"rank": i}
    return {"rank": len(LEADERS) + 1}


# ---------------------------
#   OAuth X (Twitter) — V1.1 (gratuit)
# ---------------------------
# Endpoints v1.1
REQ_TOKEN_URL = "https://api.twitter.com/oauth/request_token"
AUTH_URL      = "https://api.twitter.com/oauth/authorize"
ACC_TOKEN_URL = "https://api.twitter.com/oauth/access_token"
VERIFY_URL    = "https://api.twitter.com/1.1/account/verify_credentials.json"

@app.get("/auth/x/login")
def auth_x_login():
    if not (TW_CONSUMER_KEY and TW_CONSUMER_SECRET and TW_REDIRECT_URI):
        raise HTTPException(500, "Config OAuth v1.1 manquante (TW_CONSUMER_KEY / SECRET / REDIRECT_URI).")

    # 1) Obtenir un request token
    oauth = OAuth1Session(
        client_key=TW_CONSUMER_KEY,
        client_secret=TW_CONSUMER_SECRET,
        callback_uri=TW_REDIRECT_URI,
    )
    try:
        fetch = oauth.fetch_request_token(REQ_TOKEN_URL)
    except Exception as e:
        raise HTTPException(400, f"fetch_request_token failed: {e}")

    oauth_token = fetch.get("oauth_token")
    oauth_token_secret = fetch.get("oauth_token_secret")
    if not (oauth_token and oauth_token_secret):
        raise HTTPException(400, "request_token incomplet")

    # Mémorise le secret côté serveur + cookie côté client (fallback)
    REQ_TOKENS[oauth_token] = oauth_token_secret

    redirect_url = oauth.authorization_url(AUTH_URL)
    resp = RedirectResponse(redirect_url)
    resp.set_cookie(COOKIE_REQTOK, value=oauth_token, max_age=600, httponly=True, samesite="lax", path="/", secure=False)
    return resp


@app.get("/auth/x/callback")
def auth_x_callback(request: Request):
    # Twitter renvoie ?oauth_token=...&oauth_verifier=...
    oauth_token = request.query_params.get("oauth_token")
    oauth_verifier = request.query_params.get("oauth_verifier")
    if not (oauth_token and oauth_verifier):
        raise HTTPException(400, "Paramètres OAuth manquants.")

    # Récupère le secret associé
    token_secret = REQ_TOKENS.pop(oauth_token, None)
    if not token_secret:
        # Session trop ancienne
        raise HTTPException(400, "Session OAuth expirée (token_secret manquant). Relance la connexion.")

    # 2) Échanger contre un access token
    oauth = OAuth1Session(
        client_key=TW_CONSUMER_KEY,
        client_secret=TW_CONSUMER_SECRET,
        resource_owner_key=oauth_token,
        resource_owner_secret=token_secret,
        verifier=oauth_verifier,
    )
    try:
        tokens = oauth.fetch_access_token(ACC_TOKEN_URL)
    except Exception as e:
        raise HTTPException(400, f"fetch_access_token failed: {e}")

    access_token = tokens.get("oauth_token")
    access_secret = tokens.get("oauth_token_secret")
    screen_name = tokens.get("screen_name")
    user_id = tokens.get("user_id")

    if not (access_token and access_secret and screen_name and user_id):
        raise HTTPException(400, "access_token incomplet")

    # 3) (Optionnel) Vérifier/compléter via verify_credentials
    try:
        oauth_authed = OAuth1Session(
            client_key=TW_CONSUMER_KEY,
            client_secret=TW_CONSUMER_SECRET,
            resource_owner_key=access_token,
            resource_owner_secret=access_secret,
        )
        r = oauth_authed.get(VERIFY_URL, params={"include_email": "false", "skip_status": "true"})
        if r.status_code == 200:
            data = r.json()
            user_id = str(data.get("id", user_id))
    except Exception:
        pass

    username = screen_name  # sans @
    twitter_id = user_id

    # upsert joueur
    for pid, prof in PLAYERS.items():
        if prof.get("twitter_id") == twitter_id or prof.get("twitter", "").lower() == username.lower():
            prof["twitter_id"] = twitter_id
            prof["twitter"] = username
            resp = RedirectResponse(f"/abyss?player_id={pid}&handle=%40{username}")
            resp.delete_cookie(COOKIE_REQTOK, path="/")
            return resp

    pid = secrets.token_hex(16)
    PLAYERS[pid] = {
        "twitter": username,
        "twitter_id": twitter_id,
        "wallet": None,
        "created_at": datetime.utcnow().isoformat(),
    }

    resp = RedirectResponse(f"/abyss?player_id={pid}&handle=%40{username}")
    resp.delete_cookie(COOKIE_REQTOK, path="/")
    return resp


# ---------------------------
#   Utils
# ---------------------------
def short_addr(a: Optional[str]) -> Optional[str]:
    if not a:
        return None
    return (a[:6] + "…" + a[-4:]) if len(a) > 12 else a


# Lancement direct: python backend/app.py
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
