import os
import logging
from pathlib import Path
from typing import Generator, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

logger = logging.getLogger("strokeaegis.database")

# Ensure .env is loaded
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
env_path = PROJECT_ROOT / '.env'
if env_path.exists():
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

# Configuration parameters
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "633401")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "127.0.0.1")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "strokeaegis")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)

# SQLAlchemy 2.0 Engine with robust connection pooling
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,      # Automatically verify connections are alive before using them
    pool_size=10,             # Keep up to 10 persistent connections
    max_overflow=20,         # Allow up to 20 additional connections under burst load
    pool_recycle=3600        # Recycle connections after 1 hour
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Declarative Base for ORM models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a transactional database session
    and guarantees proper closing upon request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> Dict[str, Any]:
    """
    Verifies database connectivity and returns metadata.
    """
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            version = result.scalar()
            return {
                "status": "connected",
                "database": POSTGRES_DB,
                "host": POSTGRES_HOST,
                "port": POSTGRES_PORT,
                "version": version
            }
    except Exception as exc:
        logger.error(f"Database connection failed: {exc}")
        return {
            "status": "disconnected",
            "error": str(exc),
            "database": POSTGRES_DB,
            "host": POSTGRES_HOST,
            "port": POSTGRES_PORT
        }
