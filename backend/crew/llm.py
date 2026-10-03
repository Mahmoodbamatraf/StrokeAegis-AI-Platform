"""
StrokeAegis AI — CrewAI LLM Configuration
Initializes Google Gemini via LiteLLM using the user-provided Google AI Studio API key.
"""

import os
import logging
from crewai import LLM

logger = logging.getLogger("strokeaegis.crew.llm")
logger.setLevel(logging.INFO)

DEFAULT_API_KEY = os.environ.get("GEMINI_API_KEY", "")
PRIMARY_MODEL = "gemini/gemini-3.6-flash"
FALLBACK_MODEL = "gemini/gemini-3.5-flash"


def get_llm(model_name: str = None, temperature: float = 0.1) -> LLM:
    """
    Returns a configured CrewAI LLM instance backed by Google Gemini.
    """
    api_key = os.environ.get("GEMINI_API_KEY") or DEFAULT_API_KEY
    # Ensure environment variable is set for LiteLLM
    os.environ["GEMINI_API_KEY"] = api_key

    chosen_model = model_name or os.environ.get("GEMINI_MODEL") or PRIMARY_MODEL

    try:
        llm = LLM(
            model=chosen_model,
            api_key=api_key,
            temperature=temperature
        )
        return llm
    except Exception as e:
        logger.warning(f"Error initializing primary model {chosen_model}: {e}. Trying fallback {FALLBACK_MODEL}...")
        return LLM(
            model=FALLBACK_MODEL,
            api_key=api_key,
            temperature=temperature
        )
