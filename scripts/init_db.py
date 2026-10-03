"""
StrokeAegis AI — Database Initializer Script
Connects to local PostgreSQL, creates the 'strokeaegis' database if it doesn't exist,
enables extensions, and initializes all tables and triggers.
"""

import os
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from sqlalchemy import create_engine, text

from backend.database.database import (
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_DB,
    DATABASE_URL
)
from backend.database.models import Base


def ensure_database_exists():
    """Connects to default 'postgres' database to ensure 'strokeaegis' exists."""
    print(f"[Init] Connecting to PostgreSQL at {POSTGRES_HOST}:{POSTGRES_PORT} as '{POSTGRES_USER}'...")
    try:
        conn = psycopg2.connect(
            host=POSTGRES_HOST,
            port=POSTGRES_PORT,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            dbname="postgres",
            connect_timeout=5
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        # Check if database exists
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (POSTGRES_DB,))
        exists = cur.fetchone()
        if not exists:
            print(f"[Init] Database '{POSTGRES_DB}' does not exist. Creating it now...")
            cur.execute(f'CREATE DATABASE "{POSTGRES_DB}" WITH OWNER = "{POSTGRES_USER}";')
            print(f"[Init] Database '{POSTGRES_DB}' created successfully!")
        else:
            print(f"[Init] Database '{POSTGRES_DB}' already exists.")

        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[Init] ERROR connecting to postgres server: {e}")
        return False


def initialize_schema():
    """Initializes tables, triggers, and extensions on the 'strokeaegis' database."""
    print(f"[Init] Connecting to target database '{POSTGRES_DB}'...")
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

    with engine.connect() as conn:
        # 1. Enable pgcrypto extension
        print("[Init] Enabling 'pgcrypto' extension...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto;"))
        conn.commit()

        # 2. Create updated_at trigger function
        print("[Init] Setting up updated_at trigger function...")
        trigger_fn_sql = """
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
        conn.execute(text(trigger_fn_sql))
        conn.commit()

        # 3. Create all tables via SQLAlchemy metadata
        print("[Init] Creating all tables via SQLAlchemy models...")
        Base.metadata.create_all(bind=engine)
        print("[Init] Tables created successfully.")

        # 4. Attach triggers for auto updated_at
        tables_with_updated_at = [
            "users", "doctor_profiles", "patient_profiles",
            "doctor_patient", "assessments", "reports",
            "conversations", "messages"
        ]
        for tbl in tables_with_updated_at:
            conn.execute(text(f"DROP TRIGGER IF EXISTS trg_{tbl}_updated_at ON {tbl};"))
            conn.execute(text(f"""
                CREATE TRIGGER trg_{tbl}_updated_at
                    BEFORE UPDATE ON {tbl}
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
            """))
        conn.commit()
        print("[Init] Updated_at triggers attached to all tables.")

        # 5. Verify created tables
        res = conn.execute(text("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename;
        """))
        tables = [row[0] for row in res.fetchall()]
        print(f"[Init] Verified tables in '{POSTGRES_DB}':")
        for t in tables:
            print(f"       [OK] {t}")

    print("\n[Init] PostgreSQL database foundation is completely ready!")


if __name__ == "__main__":
    if ensure_database_exists():
        initialize_schema()
    else:
        sys.exit(1)
