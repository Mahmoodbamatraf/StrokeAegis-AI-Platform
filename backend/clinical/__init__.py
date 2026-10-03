"""
StrokeAegis Clinical Module
Handles Doctor/Patient portal APIs, assessment persistence, report sign-offs, and 1-to-1 messaging.
"""

from backend.clinical.router import router as clinical_router

__all__ = ["clinical_router"]
