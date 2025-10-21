# backend/bonus_api.py
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Tuple

bonus_router = APIRouter(prefix="/api/bonus", tags=["bonus"])

# ============================================================
# État global en mémoire (remplace plus tard par DB/Redis)
# ============================================================

# Stocks globaux (front attend des compteurs)
GLOBAL_STOCK = {
    "silver": 20,
    "gold": 1,
}

# Compteurs par wallet (stats)
player_bonus: Dict[str, Dict[str, int]] = {}

# Idempotence optionnelle par “run”
CLAIM_KEYS: set[Tuple[str, str, str]] = set()

# (Optionnel) limites max par wallet côté serveur
MAX_PER_WALLET = {
    "silver": None,  # ex: 5 si tu veux limiter par wallet
    "gold":   None,  # ex: 1 si tu veux limiter par wallet
}

# ============================================================
# Helpers
# ============================================================
def normalize_wallet(w: Optional[str]) -> str:
    if not w or not isinstance(w, str):
        return ""
    return w.lower().strip()

def get_bonus_counters(wallet: str):
    return player_bonus.get(wallet, {"silver": 0, "gold": 0})

def _increment_bonus(wallet: str, bonus_type: str):
    if wallet not in player_bonus:
        player_bonus[wallet] = {"silver": 0, "gold": 0}
    player_bonus[wallet][bonus_type] += 1

def _decrement_global_stock(bonus_type: str):
    GLOBAL_STOCK[bonus_type] = max(0, GLOBAL_STOCK[bonus_type] - 1)

def _has_stock(bonus_type: str) -> bool:
    return (GLOBAL_STOCK.get(bonus_type, 0) or 0) > 0

def holdings_for_wallet(wallet: str) -> int:
    # TODO: remplace par ta vraie logique (RPC/indexer/DB)
    return 20  # stub: éligible bonus

def eligible_for_bonus(wallet: str) -> bool:
    return holdings_for_wallet(wallet) >= 20

def max_per_wallet_reached(wallet: str, bonus_type: str) -> bool:
    limit = MAX_PER_WALLET.get(bonus_type)
    if not limit:
        return False
    counters = get_bonus_counters(wallet)
    return counters.get(bonus_type, 0) >= limit

# ============================================================
# Schémas
# ============================================================
class ClaimBody(BaseModel):
    type: str           # "bonus2" | "legendary"
    wallet: str
    run_id: Optional[str] = None

class ReportBody(BaseModel):
    wallet: Optional[str] = None
    silver: int
    gold: int
    score: int
    xp: int

# ============================================================
# Routes compatibles avec le front
# ============================================================
@bonus_router.get("/availability")
async def bonus_availability():
    return JSONResponse({
        "silver_remaining": max(GLOBAL_STOCK.get("silver", 0), 0),
        "gold_remaining":   max(GLOBAL_STOCK.get("gold", 0), 0),
    })

@bonus_router.get("/eligibility/{wallet}")
async def bonus_eligibility(wallet: str):
    w = normalize_wallet(wallet)
    if not w:
      raise HTTPException(status_code=400, detail="missing_or_invalid_wallet")
    if not eligible_for_bonus(w):
      return JSONResponse({"silver_left": 0, "gold_left": 0})
    return JSONResponse({
      "silver_left": max(GLOBAL_STOCK.get("silver", 0), 0),
      "gold_left":   max(GLOBAL_STOCK.get("gold", 0), 0),
    })

@bonus_router.post("/claim")
async def bonus_claim(body: ClaimBody):
    w = normalize_wallet(body.wallet)
    if not w:
        raise HTTPException(status_code=400, detail="missing_or_invalid_wallet")

    if body.type == "bonus2":
        bonus_type = "silver"
    elif body.type == "legendary":
        bonus_type = "gold"
    else:
        raise HTTPException(status_code=400, detail="invalid_bonus_type")

    if body.run_id:
        key = (w, bonus_type, body.run_id)
        if key in CLAIM_KEYS:
            return JSONResponse({"ok": True, "type": body.type})
        CLAIM_KEYS.add(key)

    if not eligible_for_bonus(w):
        raise HTTPException(status_code=403, detail="not_eligible")

    if not _has_stock(bonus_type):
        raise HTTPException(status_code=409, detail="out_of_stock")

    if max_per_wallet_reached(w, bonus_type):
        raise HTTPException(status_code=403, detail=f"max_{bonus_type}_reached")

    _decrement_global_stock(bonus_type)
    _increment_bonus(w, bonus_type)
    return JSONResponse({"ok": True, "type": body.type, "counters": get_bonus_counters(w)})

@bonus_router.get("/remaining")
async def bonus_remaining():
    return JSONResponse({
        "silver": max(GLOBAL_STOCK.get("silver", 0), 0),
        "gold":   max(GLOBAL_STOCK.get("gold", 0), 0),
    })

@bonus_router.get("/stats/{wallet}")
async def bonus_stats(wallet: str):
    w = normalize_wallet(wallet)
    if not w:
        raise HTTPException(status_code=400, detail="missing_or_invalid_wallet")
    return JSONResponse(get_bonus_counters(w))

@bonus_router.post("/report")
async def bonus_report(body: ReportBody):
    # TODO: persiste en DB si besoin
    return JSONResponse({"ok": True})

# Compat anciens endpoints + reset debug
@bonus_router.get("/status")
async def bonus_status():
    return JSONResponse({
        "available": {
            "silver": _has_stock("silver"),
            "gold": _has_stock("gold"),
        }
    })

@bonus_router.post("/reset")
async def bonus_reset():
    GLOBAL_STOCK["silver"] = 20
    GLOBAL_STOCK["gold"] = 1
    # player_bonus.clear(); CLAIM_KEYS.clear()  # si tu veux
    return JSONResponse({"ok": True, "available": {
        "silver": _has_stock("silver"),
        "gold": _has_stock("gold"),
    }})
