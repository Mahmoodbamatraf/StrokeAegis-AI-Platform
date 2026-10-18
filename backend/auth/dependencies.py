from typing import Optional
from uuid import UUID
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.database.database import get_db
from backend.database.models import User
from backend.auth.security import decode_access_token

# OAuth2 scheme with Bearer token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    token_header: Optional[str] = Depends(oauth2_scheme),
    token_query: Optional[str] = Query(None, alias="token"),
    db: Session = Depends(get_db)
) -> User:
    """
    FastAPI dependency that extracts and validates the JWT Bearer token
    from either the Authorization header or the query parameter (?token=...),
    loading the active User entity from the database.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = token_header or token_query
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id_str: Optional[str] = payload.get("sub")
    if not user_id_str:
        raise credentials_exception

    user = None
    try:
        user_uuid = UUID(user_id_str)
        user = db.query(User).filter(User.id == user_uuid).first()
    except ValueError:
        user = db.query(User).filter(User.email == user_id_str.lower().strip()).first()

    if not user:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account."
        )

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency that enforces administrator role access.
    Raises 403 Forbidden for non-administrators.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privileges required."
        )
    return current_user


def require_doctor(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency that enforces doctor role access and verifies approved clinical status.
    Raises 403 Forbidden for patients, non-doctors, or unapproved doctors.
    """
    if current_user.role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Doctor role required."
        )
    if current_user.doctor_profile:
        status_val = getattr(current_user.doctor_profile, "approval_status", "approved")
        if status_val == "pending":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clinician credentials under review. Access to clinical workspace will be activated upon administrative verification."
            )
        elif status_val == "more_info_required":
            detail_msg = "Clinician credential verification requires additional information."
            if current_user.doctor_profile.more_info_request:
                detail_msg += f" Details requested: {current_user.doctor_profile.more_info_request}"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail_msg
            )
        elif status_val == "suspended":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clinician account is currently suspended. Please contact clinical administration."
            )
        elif status_val == "rejected":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clinician application was not approved. Please contact clinical administration."
            )
        elif status_val != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clinician account is not approved for clinical workspace access."
            )
    return current_user


def require_patient(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency that enforces patient role access.
    Raises 403 Forbidden for doctors or non-patients.
    """
    if current_user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patient role required."
        )
    return current_user


def get_current_user_optional(
    token_header: Optional[str] = Depends(oauth2_scheme),
    token_query: Optional[str] = Query(None, alias="token"),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Optional authentication dependency: returns User if valid token is provided
    (via Authorization header or ?token= query parameter), or None if not authenticated.
    """
    token = token_header or token_query
    if not token:
        return None

    payload = decode_access_token(token)
    if not payload:
        return None

    user_id_str: Optional[str] = payload.get("sub")
    if not user_id_str:
        return None

    user = None
    try:
        user_uuid = UUID(user_id_str)
        user = db.query(User).filter(User.id == user_uuid).first()
    except ValueError:
        user = db.query(User).filter(User.email == user_id_str.lower().strip()).first()

    if user and user.is_active:
        return user
    return None

