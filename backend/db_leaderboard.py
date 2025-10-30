# backend/db_leaderboard.py
# Stockage PERMANENT de l'XP, Score et Level des joueurs
# Base SQLite séparée (data/leaderboard.db)

from __future__ import annotations
import os
from typing import List, Dict, Optional
from datetime import datetime

from sqlalchemy import create_engine, Column, String, Integer, DateTime, desc
from sqlalchemy.orm import declarative_base, sessionmaker

# ============================================================
# CONFIG BASE DE DONNÉES
# ============================================================

os.makedirs("data", exist_ok=True)
engine = create_engine("sqlite:///data/leaderboard.db", future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()

# ============================================================
# TABLE PLAYERS (XP permanent)
# ============================================================

class Player(Base):
    __tablename__ = "players"
    
    wallet = Column(String, primary_key=True)  # adresse EVM (0x...)
    display = Column(String, nullable=True)    # nom court (0x1234...5678)
    
    # Meilleurs scores
    xp = Column(Integer, nullable=False, default=0)
    score = Column(Integer, nullable=False, default=0)
    level = Column(Integer, nullable=False, default=1)
    
    # Dates
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

# ============================================================
# INIT DB
# ============================================================

def init_leaderboard_db():
    """Créer la table si elle n'existe pas."""
    Base.metadata.create_all(engine)

# ============================================================
# FONCTIONS CRUD
# ============================================================

def normalize_wallet(wallet: str) -> str:
    """Normalise l'adresse wallet en lowercase."""
    return wallet.lower().strip()

def short_display(wallet: str) -> str:
    """Génère un display court : 0x1234...5678"""
    if len(wallet) > 12:
        return wallet[:6] + "…" + wallet[-4:]
    return wallet

def submit_player_score(wallet: str, xp: int, score: int, level: int) -> bool:
    """
    Enregistre ou met à jour le meilleur score d'un joueur.
    Retourne True si c'est un nouveau record, False sinon.
    """
    wallet = normalize_wallet(wallet)
    
    with SessionLocal.begin() as session:
        player = session.get(Player, wallet)
        
        if not player:
            # Nouveau joueur
            player = Player(
                wallet=wallet,
                display=short_display(wallet),
                xp=xp,
                score=score,
                level=level
            )
            session.add(player)
            return True
        else:
            # Joueur existant : mise à jour si meilleur
            old_xp, old_score = player.xp, player.score
            new_better = (xp, score) > (old_xp, old_score)
            
            if new_better:
                player.xp = xp
                player.score = score
                player.level = level
                player.updated_at = datetime.utcnow()
                session.add(player)
                return True
            
            return False

def get_leaderboard(limit: int = 100) -> List[Dict]:
    """
    Retourne le leaderboard trié par XP puis Score.
    Format : [{"player_id": "0x...", "display": "...", "xp": ..., "score": ..., "level": ...}, ...]
    """
    with SessionLocal() as session:
        players = session.query(Player).order_by(
            desc(Player.xp),
            desc(Player.score)
        ).limit(limit).all()
        
        return [
            {
                "player_id": p.wallet,
                "display": p.display,
                "xp": p.xp,
                "score": p.score,
                "level": p.level,
                "at": p.updated_at.isoformat() if p.updated_at else None
            }
            for p in players
        ]

def get_player_rank(wallet: str) -> int:
    """
    Retourne le rang du joueur (1 = premier).
    Si le joueur n'existe pas, retourne le nombre total + 1.
    """
    wallet = normalize_wallet(wallet)
    
    with SessionLocal() as session:
        # Compter combien de joueurs ont un meilleur score
        better_count = session.query(Player).filter(
            (Player.xp > session.query(Player.xp).filter(Player.wallet == wallet).scalar_subquery()) |
            (
                (Player.xp == session.query(Player.xp).filter(Player.wallet == wallet).scalar_subquery()) &
                (Player.score > session.query(Player.score).filter(Player.wallet == wallet).scalar_subquery())
            )
        ).count()
        
        # Si le joueur n'existe pas
        player = session.get(Player, wallet)
        if not player:
            total = session.query(Player).count()
            return total + 1
        
        return better_count + 1

def get_player_stats(wallet: str) -> Optional[Dict]:
    """
    Retourne les stats d'un joueur : xp, score, level.
    Retourne None si le joueur n'existe pas.
    """
    wallet = normalize_wallet(wallet)
    
    with SessionLocal() as session:
        player = session.get(Player, wallet)
        if not player:
            return None
        
        return {
            "wallet": player.wallet,
            "display": player.display,
            "xp": player.xp,
            "score": player.score,
            "level": player.level,
            "created_at": player.created_at.isoformat() if player.created_at else None,
            "updated_at": player.updated_at.isoformat() if player.updated_at else None
        }

def get_total_players() -> int:
    """Retourne le nombre total de joueurs enregistrés."""
    with SessionLocal() as session:
        return session.query(Player).count()

# ============================================================
# MIGRATION : Importer depuis une liste en mémoire
# ============================================================

def migrate_from_memory(leaders_list: List[Dict]):
    """
    Importe les données depuis LEADERS (mémoire) vers la base SQLite.
    Format attendu : [{"player_id": "0x...", "xp": ..., "score": ..., "level": ...}, ...]
    """
    count = 0
    with SessionLocal.begin() as session:
        for entry in leaders_list:
            wallet = normalize_wallet(entry.get("player_id", ""))
            if not wallet or not wallet.startswith("0x"):
                continue
            
            xp = int(entry.get("xp", 0))
            score = int(entry.get("score", 0))
            level = int(entry.get("level", 1))
            
            player = session.get(Player, wallet)
            
            if not player:
                # Nouveau joueur
                player = Player(
                    wallet=wallet,
                    display=short_display(wallet),
                    xp=xp,
                    score=score,
                    level=level
                )
                session.add(player)
                count += 1
            else:
                # Mise à jour si meilleur
                if (xp, score) > (player.xp, player.score):
                    player.xp = xp
                    player.score = score
                    player.level = level
                    player.updated_at = datetime.utcnow()
                    session.add(player)
                    count += 1
    
    return count