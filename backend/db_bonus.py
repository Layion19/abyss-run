# backend/db_bonus.py
# Persistance des bonus / quotas / saisons.
# - SQLite par défaut (data/aw.db)
# - PostgreSQL si DATABASE_URL est défini
# VERSION CORRIGÉE : angrywhales sans underscore

from __future__ import annotations
import os
import time
import datetime as dt
from typing import Optional, Dict

from sqlalchemy import (
    create_engine, Column, String, Integer, DateTime, UniqueConstraint, text
)
from sqlalchemy.orm import declarative_base, sessionmaker

# ============================================================
# CONFIG BASE DE DONNÉES
# ============================================================

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
else:
    os.makedirs("data", exist_ok=True)
    engine = create_engine("sqlite:///data/aw.db", future=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()

# Types de bonus supportés (côté DB) - SANS UNDERSCORE
BONUS_TYPES = ("silver", "gold", "platinum", "special", "angrywhales")

# ============================================================
# TABLES
# ============================================================

class SeasonInventory(Base):
    __tablename__ = "season_inventory"
    season_id = Column(String, primary_key=True)

    # stocks globaux par saison
    silver = Column(Integer, nullable=False, default=0)
    gold = Column(Integer, nullable=False, default=0)
    platinum = Column(Integer, nullable=False, default=0)
    special = Column(Integer, nullable=False, default=0)
    angrywhales = Column(Integer, nullable=False, default=0)


class WalletSeasonBonus(Base):
    __tablename__ = "wallet_season_bonus"
    # composite PK
    wallet = Column(String, primary_key=True)
    season_id = Column(String, primary_key=True)

    # compteurs par wallet/saison
    silver = Column(Integer, nullable=False, default=0)
    gold = Column(Integer, nullable=False, default=0)
    platinum = Column(Integer, nullable=False, default=0)
    special = Column(Integer, nullable=False, default=0)
    angrywhales = Column(Integer, nullable=False, default=0)


class BonusClaim(Base):
    __tablename__ = "bonus_claim"
    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet = Column(String, nullable=False)
    season_id = Column(String, nullable=False)
    bonus_type = Column(String, nullable=False)
    run_id = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: dt.datetime.utcnow())
    __table_args__ = (
        UniqueConstraint("wallet", "season_id", "bonus_type", "run_id", name="uq_claim_runid"),
    )


# ============================================================
# INIT + AUTO-MIGRATION
# ============================================================

def _ensure_columns():
    """
    Ajoute/migre les colonnes 'special' et 'angrywhales'.
    Migre 'angry_whales' → 'angrywhales' si nécessaire.
    """
    with engine.connect() as conn:
        dialect = engine.dialect.name

        # ---- SeasonInventory
        if dialect == "sqlite":
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(season_inventory)")).fetchall()}
            
            # Migration: copier angry_whales → angrywhales
            if "angry_whales" in cols and "angrywhales" not in cols:
                conn.execute(text("ALTER TABLE season_inventory ADD COLUMN angrywhales INTEGER NOT NULL DEFAULT 0"))
                conn.execute(text("UPDATE season_inventory SET angrywhales = angry_whales"))
            elif "angrywhales" not in cols:
                conn.execute(text("ALTER TABLE season_inventory ADD COLUMN angrywhales INTEGER NOT NULL DEFAULT 0"))
            
            if "special" not in cols:
                conn.execute(text("ALTER TABLE season_inventory ADD COLUMN special INTEGER NOT NULL DEFAULT 0"))
        else:
            conn.execute(text("ALTER TABLE IF EXISTS season_inventory ADD COLUMN IF NOT EXISTS special INTEGER NOT NULL DEFAULT 0"))
            conn.execute(text("ALTER TABLE IF EXISTS season_inventory ADD COLUMN IF NOT EXISTS angrywhales INTEGER NOT NULL DEFAULT 0"))

        # ---- WalletSeasonBonus
        if dialect == "sqlite":
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(wallet_season_bonus)")).fetchall()}
            
            if "angry_whales" in cols and "angrywhales" not in cols:
                conn.execute(text("ALTER TABLE wallet_season_bonus ADD COLUMN angrywhales INTEGER NOT NULL DEFAULT 0"))
                conn.execute(text("UPDATE wallet_season_bonus SET angrywhales = angry_whales"))
            elif "angrywhales" not in cols:
                conn.execute(text("ALTER TABLE wallet_season_bonus ADD COLUMN angrywhales INTEGER NOT NULL DEFAULT 0"))
            
            if "special" not in cols:
                conn.execute(text("ALTER TABLE wallet_season_bonus ADD COLUMN special INTEGER NOT NULL DEFAULT 0"))
        else:
            conn.execute(text("ALTER TABLE IF EXISTS wallet_season_bonus ADD COLUMN IF NOT EXISTS special INTEGER NOT NULL DEFAULT 0"))
            conn.execute(text("ALTER TABLE IF EXISTS wallet_season_bonus ADD COLUMN IF NOT EXISTS angrywhales INTEGER NOT NULL DEFAULT 0"))

        conn.commit()


def init_db():
    """Créer les tables si absentes + migration."""
    Base.metadata.create_all(engine)
    _ensure_columns()


# ============================================================
# INVENTORY
# ============================================================

def _normalize_defaults(defaults: Dict[str, int]) -> Dict[str, int]:
    """Garantie toutes les clés BONUS_TYPES dans defaults."""
    d = {k: int(defaults.get(k, 0) or 0) for k in BONUS_TYPES}
    return d


def get_or_create_inventory(season_id: str, defaults: Dict[str, int]) -> SeasonInventory:
    d = _normalize_defaults(defaults)
    with SessionLocal.begin() as s:
        inv = s.get(SeasonInventory, season_id)
        if not inv:
            inv = SeasonInventory(
                season_id=season_id,
                silver=d["silver"],
                gold=d["gold"],
                platinum=d["platinum"],
                special=d["special"],
                angrywhales=d["angrywhales"],
            )
            s.add(inv)
        return inv


def inventory_remaining(season_id: str, defaults: Dict[str, int]) -> Dict[str, int]:
    d = _normalize_defaults(defaults)
    with SessionLocal() as s:
        inv = s.get(SeasonInventory, season_id)
        if not inv:
            return d.copy()
        return {
            "silver": inv.silver,
            "gold": inv.gold,
            "platinum": inv.platinum,
            "special": inv.special,
            "angrywhales": inv.angrywhales,
        }


def has_stock(season_id: str, bonus_type: str, defaults: Dict[str, int]) -> bool:
    if bonus_type not in BONUS_TYPES:
        return False
    rem = inventory_remaining(season_id, defaults)
    return (rem.get(bonus_type, 0) or 0) > 0


def decrement_stock(season_id: str, bonus_type: str) -> bool:
    """Décrémente le stock global. Retourne False si déjà à 0 ou type invalide."""
    if bonus_type not in BONUS_TYPES:
        return False
    with SessionLocal.begin() as s:
        inv = s.get(SeasonInventory, season_id)
        if not inv:
            return False
        current = int(getattr(inv, bonus_type))
        if current <= 0:
            return False
        setattr(inv, bonus_type, current - 1)
        s.add(inv)
        return True


def reset_season_inventory(season_id: str, defaults: Dict[str, int]):
    """Réinitialise les stocks de la saison donnée."""
    d = _normalize_defaults(defaults)
    with SessionLocal.begin() as s:
        inv = s.get(SeasonInventory, season_id)
        if not inv:
            inv = SeasonInventory(
                season_id=season_id,
                silver=d["silver"],
                gold=d["gold"],
                platinum=d["platinum"],
                special=d["special"],
                angrywhales=d["angrywhales"],
            )
        else:
            inv.silver = d["silver"]
            inv.gold = d["gold"]
            inv.platinum = d["platinum"]
            inv.special = d["special"]
            inv.angrywhales = d["angrywhales"]
        s.add(inv)


# ============================================================
# WALLET COUNTERS
# ============================================================

def _get_wallet_row(session, wallet: str, season_id: str) -> WalletSeasonBonus | None:
    return session.get(WalletSeasonBonus, (wallet, season_id))


def get_wallet_counters(wallet: str, season_id: str) -> Dict[str, int]:
    with SessionLocal() as s:
        row = _get_wallet_row(s, wallet, season_id)
        if not row:
            return {k: 0 for k in BONUS_TYPES}
        return {
            "silver": row.silver,
            "gold": row.gold,
            "platinum": row.platinum,
            "special": row.special,
            "angrywhales": row.angrywhales,
        }


def increment_wallet_counter(wallet: str, season_id: str, bonus_type: str):
    if bonus_type not in BONUS_TYPES:
        return
    with SessionLocal.begin() as s:
        row = _get_wallet_row(s, wallet, season_id)
        if not row:
            row = WalletSeasonBonus(
                wallet=wallet,
                season_id=season_id,
                silver=0, gold=0, platinum=0, special=0, angrywhales=0
            )
        current = int(getattr(row, bonus_type) or 0)
        setattr(row, bonus_type, current + 1)
        s.add(row)


# ============================================================
# CLAIMS (IDEMPOTENCE)
# ============================================================

def record_claim(wallet: str, season_id: str, bonus_type: str, run_id: Optional[str]) -> bool:
    """
    Enregistre un claim. Retourne True si nouveau, False si doublon (idempotent).
    """
    if bonus_type not in BONUS_TYPES:
        return False
    with SessionLocal.begin() as s:
        if run_id:
            claim = BonusClaim(wallet=wallet, season_id=season_id, bonus_type=bonus_type, run_id=run_id)
            s.add(claim)
            try:
                s.flush()
                return True
            except Exception:
                s.rollback()
                return False
        else:
            claim = BonusClaim(wallet=wallet, season_id=season_id, bonus_type=bonus_type, run_id=None)
            s.add(claim)
            return True


# ============================================================
# SAISON UTIL
# ============================================================

SEASON_RESET_DAY = 25

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

import os
import time
import datetime as dt
from typing import Optional, Dict

from sqlalchemy import (
    create_engine, Column, String, Integer, DateTime, UniqueConstraint, text
)
from sqlalchemy.orm import declarative_base, sessionmaker

# ============================================================
# CONFIG BASE DE DONNÉES
# ============================================================

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
else:
    os.makedirs("data", exist_ok=True)
    engine = create_engine("sqlite:///data/aw.db", future=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()

# Types de bonus supportés (côté DB) - SANS UNDERSCORE pour angrywhales
BONUS_TYPES = ("silver", "gold", "platinum", "special", "angrywhales")

# ============================================================
# TABLES
# ============================================================

class SeasonInventory(Base):
    __tablename__ = "season_inventory"
    season_id = Column(String, primary_key=True)

    # stocks globaux par saison
    silver = Column(Integer, nullable=False, default=0)
    gold = Column(Integer, nullable=False, default=0)
    platinum = Column(Integer, nullable=False, default=0)
    special = Column(Integer, nullable=False, default=0)
    angrywhales = Column(Integer, nullable=False, default=0)  # SANS UNDERSCORE


class WalletSeasonBonus(Base):
    __tablename__ = "wallet_season_bonus"
    # composite PK
    wallet = Column(String, primary_key=True)
    season_id = Column(String, primary_key=True)

    # compteurs par wallet/saison
    silver = Column(Integer, nullable=False, default=0)
    gold = Column(Integer, nullable=False, default=0)
    platinum = Column(Integer, nullable=False, default=0)
    special = Column(Integer, nullable=False, default=0)
    angrywhales = Column(Integer, nullable=False, default=0)  # SANS UNDERSCORE


class BonusClaim(Base):
    __tablename__ = "bonus_claim"
    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet = Column(String, nullable=False)
    season_id = Column(String, nullable=False)
    bonus_type = Column(String, nullable=False)  # ex: "silver" | "gold" | "platinum" | "special" | "angrywhales"
    run_id = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: dt.datetime.utcnow())
    __table_args__ = (
        # Unicité (= idempotence) par (wallet, saison, type, run_id)
        UniqueConstraint("wallet", "season_id", "bonus_type", "run_id", name="uq_claim_runid"),
    )


# ============================================================
# INIT + AUTO-MIGRATION (ajout/renommage colonnes)
# ============================================================

def _ensure_columns():
    """
    Ajoute les colonnes 'special' et 'angrywhales' si elles n'existent pas encore.
    Renomme 'angry_whales' → 'angrywhales' si nécessaire (migration douce).
    """
    with engine.connect() as conn:
        dialect = engine.dialect.name

        # ---- SeasonInventory
        if dialect == "sqlite":
            # Lire le schéma
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(season_inventory)")).fetchall()}
            
            # Migration: renommer angry_whales → angrywhales si existe
            if "angry_whales" in cols and "angrywhales" not in cols:
                # SQLite ne supporte pas RENAME COLUMN directement, on copie les données
                conn.execute(text("ALTER TABLE season_inventory ADD COLUMN angrywhales INTEGER NOT NULL DEFAULT 0"))
                conn.execute(text("UPDATE season_inventory SET angrywhales = angry_whales"))
                # Note: on garde l'ancienne colonne pour éviter les erreurs (tu peux la supprimer manuellement plus tard)
            elif "angrywhales" not in cols:
                conn.execute(text("ALTER TABLE season_inventory ADD COLUMN angrywhales INTEGER NOT NULL DEFAULT 0"))
            
            if "special" not in cols:
                conn.execute(text("ALTER TABLE season_inventory ADD COLUMN special INTEGER NOT NULL DEFAULT 0"))
        else:
            # Postgres
            conn.execute(text("ALTER TABLE IF EXISTS season_inventory ADD COLUMN IF NOT EXISTS special INTEGER NOT NULL DEFAULT 0"))
            conn.execute(text("ALTER TABLE IF EXISTS season_inventory ADD COLUMN IF NOT EXISTS angrywhales INTEGER NOT NULL DEFAULT 0"))

        # ---- WalletSeasonBonus
        if dialect == "sqlite":
            cols = {row[1] for row in conn.execute(text("PRAGMA table_info(wallet_season_bonus)")).fetchall()}
            
            # Migration: renommer angry_whales → angrywhales
            if "angry_whales" in cols and "angrywhales" not in cols:
                conn.execute(text("ALTER TABLE wallet_season_bonus ADD COLUMN angrywhales INTEGER NOT NULL DEFAULT 0"))
                conn.execute(text("UPDATE wallet_season_bonus SET angrywhales = angry_whales"))
            elif "angrywhales" not in cols:
                conn.execute(text("ALTER TABLE wallet_season_bonus ADD COLUMN angrywhales INTEGER NOT NULL DEFAULT 0"))
            
            if "special" not in cols:
                conn.execute(text("ALTER TABLE wallet_season_bonus ADD COLUMN special INTEGER NOT NULL DEFAULT 0"))
        else:
            conn.execute(text("ALTER TABLE IF EXISTS wallet_season_bonus ADD COLUMN IF NOT EXISTS special INTEGER NOT NULL DEFAULT 0"))
            conn.execute(text("ALTER TABLE IF EXISTS wallet_season_bonus ADD COLUMN IF NOT EXISTS angrywhales INTEGER NOT NULL DEFAULT 0"))

        conn.commit()


def init_db():
    """Créer les tables si absentes + ajouter/migrer colonnes."""
    Base.metadata.create_all(engine)
    _ensure_columns()


# ============================================================
# INVENTORY
# ============================================================

def _normalize_defaults(defaults: Dict[str, int]) -> Dict[str, int]:
    """Garantie toutes les clés BONUS_TYPES dans defaults."""
    d = {k: int(defaults.get(k, 0) or 0) for k in BONUS_TYPES}
    return d


def get_or_create_inventory(season_id: str, defaults: Dict[str, int]) -> SeasonInventory:
    d = _normalize_defaults(defaults)
    with SessionLocal.begin() as s:
        inv = s.get(SeasonInventory, season_id)
        if not inv:
            inv = SeasonInventory(
                season_id=season_id,
                silver=d["silver"],
                gold=d["gold"],
                platinum=d["platinum"],
                special=d["special"],
                angrywhales=d["angrywhales"],
            )
            s.add(inv)
        return inv


def inventory_remaining(season_id: str, defaults: Dict[str, int]) -> Dict[str, int]:
    d = _normalize_defaults(defaults)
    with SessionLocal() as s:
        inv = s.get(SeasonInventory, season_id)
        if not inv:
            return d.copy()
        return {
            "silver": inv.silver,
            "gold": inv.gold,
            "platinum": inv.platinum,
            "special": inv.special,
            "angrywhales": inv.angrywhales,
        }


def has_stock(season_id: str, bonus_type: str, defaults: Dict[str, int]) -> bool:
    if bonus_type not in BONUS_TYPES:
        return False
    rem = inventory_remaining(season_id, defaults)
    return (rem.get(bonus_type, 0) or 0) > 0


def decrement_stock(season_id: str, bonus_type: str) -> bool:
    """Décrémente le stock global. Retourne False si déjà à 0 ou type invalide."""
    if bonus_type not in BONUS_TYPES:
        return False
    with SessionLocal.begin() as s:
        inv = s.get(SeasonInventory, season_id)
        if not inv:
            return False
        current = int(getattr(inv, bonus_type))
        if current <= 0:
            return False
        setattr(inv, bonus_type, current - 1)
        s.add(inv)
        return True


def reset_season_inventory(season_id: str, defaults: Dict[str, int]):
    """Réinitialise les stocks de la saison donnée."""
    d = _normalize_defaults(defaults)
    with SessionLocal.begin() as s:
        inv = s.get(SeasonInventory, season_id)
        if not inv:
            inv = SeasonInventory(
                season_id=season_id,
                silver=d["silver"],
                gold=d["gold"],
                platinum=d["platinum"],
                special=d["special"],
                angrywhales=d["angrywhales"],
            )
        else:
            inv.silver = d["silver"]
            inv.gold = d["gold"]
            inv.platinum = d["platinum"]
            inv.special = d["special"]
            inv.angrywhales = d["angrywhales"]
        s.add(inv)


# ============================================================
# WALLET COUNTERS
# ============================================================

def _get_wallet_row(session, wallet: str, season_id: str) -> WalletSeasonBonus | None:
    # Pour composite PK, passer un tuple (ordre des PK: wallet, season_id)
    return session.get(WalletSeasonBonus, (wallet, season_id))


def get_wallet_counters(wallet: str, season_id: str) -> Dict[str, int]:
    with SessionLocal() as s:
        row = _get_wallet_row(s, wallet, season_id)
        if not row:
            return {k: 0 for k in BONUS_TYPES}
        return {
            "silver": row.silver,
            "gold": row.gold,
            "platinum": row.platinum,
            "special": row.special,
            "angrywhales": row.angrywhales,
        }


def increment_wallet_counter(wallet: str, season_id: str, bonus_type: str):
    if bonus_type not in BONUS_TYPES:
        return
    with SessionLocal.begin() as s:
        row = _get_wallet_row(s, wallet, season_id)
        if not row:
            row = WalletSeasonBonus(
                wallet=wallet,
                season_id=season_id,
                silver=0, gold=0, platinum=0, special=0, angrywhales=0
            )
        current = int(getattr(row, bonus_type) or 0)
        setattr(row, bonus_type, current + 1)
        s.add(row)


# ============================================================
# CLAIMS (IDEMPOTENCE)
# ============================================================

def record_claim(wallet: str, season_id: str, bonus_type: str, run_id: Optional[str]) -> bool:
    """
    Enregistre un claim. Retourne True si nouveau, False si doublon (idempotent).
    """
    if bonus_type not in BONUS_TYPES:
        return False
    with SessionLocal.begin() as s:
        if run_id:
            claim = BonusClaim(wallet=wallet, season_id=season_id, bonus_type=bonus_type, run_id=run_id)
            s.add(claim)
            try:
                s.flush()  # force la contrainte unique
                return True
            except Exception:
                s.rollback()
                return False
        else:
            # Sans run_id : on autorise plusieurs claims (contrôlés par quotas ailleurs)
            claim = BonusClaim(wallet=wallet, season_id=season_id, bonus_type=bonus_type, run_id=None)
            s.add(claim)
            return True


# ============================================================
# SAISON UTIL
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