# backend/reset_bonus.py
import os
import sqlite3

# Chemin vers la base (même dossier que ce script)
DB_PATH = os.path.join(os.path.dirname(__file__), "db_bonus.py")

def table_exists(cur, name):
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?;", (name,))
    return cur.fetchone() is not None

def col_exists(cur, table, col):
    cur.execute(f"PRAGMA table_info({table});")
    return any(r[1] == col for r in cur.fetchall())

def main():
    if not os.path.exists(DB_PATH):
        print(f"[!] DB introuvable: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1) Remise à zéro des compteurs par wallet (toutes saisons)
    if table_exists(cur, "wallet_counters"):
        # Vérifie les colonnes attendues, puis reset
        cols = ["silver", "gold", "platinum", "special", "angry_whales"]
        missing = [c for c in cols if not col_exists(cur, "wallet_counters", c)]
        if missing:
            print(f"[!] Colonnes manquantes dans wallet_counters: {missing}")
        else:
            cur.execute("""
                UPDATE wallet_counters
                SET silver=0, gold=0, platinum=0, special=0, angry_whales=0
            """)
            print(f"[OK] Compteurs remis à zéro pour {cur.rowcount} lignes (toutes saisons).")
    else:
        print("[!] Table wallet_counters introuvable.")

    # 2) (Optionnel) on purge la table des claims/idempotence si elle existe
    if table_exists(cur, "claims"):
        cur.execute("DELETE FROM claims;")
        print(f"[OK] Table claims vidée.")

    conn.commit()
    conn.close()
    print(f"[DONE] Reset terminé sur {DB_PATH}")

if __name__ == "__main__":
    main()
