"""
StrokeAegis AI — Medical RAG Service Client & Adapter
Integrates directly with the existing 501 indexed guideline chunks in Qdrant and SQLite audit DB.
"""

import os
import sys
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

logger = logging.getLogger("strokeaegis.rag_client")
logger.setLevel(logging.INFO)

# Path to existing Medical RAG project
RAG_PROJECT_PATH = Path(r"C:\Users\PC\.gemini\antigravity\scratch\strokeaegis-rag").resolve()
DB_FILE_PATH = (RAG_PROJECT_PATH / "strokeaegis_rag.db").resolve()
QDRANT_DATA_PATH = (RAG_PROJECT_PATH / "qdrant_data").resolve()

# Ensure absolute SQLite URL is set so audit logging connects regardless of working directory
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = f"sqlite:///{DB_FILE_PATH.as_posix()}"

# Add RAG project root to sys.path if not present
if str(RAG_PROJECT_PATH) not in sys.path:
    sys.path.insert(0, str(RAG_PROJECT_PATH))

_rag_service_instance = None


def get_rag_service():
    """
    Returns a singleton instance of MedicalRAGService from the existing RAG project.
    """
    global _rag_service_instance
    if _rag_service_instance is None:
        try:
            logger.info("Initializing MedicalRAGService singleton...")
            from app.rag.service import MedicalRAGService
            _rag_service_instance = MedicalRAGService()
            logger.info("MedicalRAGService initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize MedicalRAGService: {e}", exc_info=True)
            raise e
    return _rag_service_instance


def query_medical_rag(
    query: str,
    agent: Optional[str] = None,
    condition: Optional[str] = None,
    topic: Optional[str] = None,
    source: Optional[str] = None,
    year: Optional[int] = None,
    top_k: int = 5
) -> List[Dict[str, Any]]:
    """
    Executes a clinically grounded vector retrieval against the existing Medical RAG database.
    Returns structured guideline evidence with full citation attribution.
    """
    try:
        service = get_rag_service()
        response = service.retrieve(
            query=query,
            agent=agent,
            condition=condition,
            topic=topic,
            source=source,
            year=year,
            top_k=top_k
        )

        formatted_results = []
        for r in response.results:
            formatted_results.append({
                "source": r.source,
                "guideline": r.guideline,
                "year": r.year,
                "page": r.page,
                "section": r.section or "Clinical Recommendation",
                "subsection": r.subsection or "",
                "document_id": r.document_id,
                "chunk_id": r.chunk_id,
                "score": round(float(r.score), 4),
                "text": r.text.strip(),
                "citation": f"{r.source} {r.guideline} ({r.year or 'Guidelines'}), Section: {r.section or 'General'}, p.{r.page or 'N/A'}"
            })

        logger.info(f"Retrieved {len(formatted_results)} evidence chunks for query: '{query[:40]}...' (agent={agent})")
        return formatted_results

    except Exception as e:
        logger.warning(f"Medical RAG retrieval encountered error: {e}. Providing safe fallback.")
        return []
