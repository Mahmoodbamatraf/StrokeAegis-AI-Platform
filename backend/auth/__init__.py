"""
StrokeAegis Authentication & Security Subsystem
Provides password hashing, JWT generation/validation, role dependencies, and auth endpoints.
"""

from backend.auth.security import hash_password, verify_password, create_access_token, decode_access_token
from backend.auth.dependencies import get_current_user, require_doctor, require_patient
from backend.auth.router import router as auth_router

__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "get_current_user",
    "require_doctor",
    "require_patient",
    "auth_router"
]
