import random
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database.database import get_db
from backend.database.models import (
    User,
    DoctorProfile,
    PatientProfile,
    DoctorPatient,
    Conversation,
    Message,
    Notification
)
from backend.auth.schemas import (
    DoctorRegisterInput,
    PatientRegisterInput,
    UserLoginInput,
    TokenResponse,
    CurrentUserResponse,
    DoctorProfileResponse,
    PatientProfileResponse
)
from backend.auth.security import hash_password, verify_password, create_access_token
from backend.auth.dependencies import get_current_user

router = APIRouter()


def _generate_mrn(db: Session) -> str:
    """Generates a unique, collision-resistant Medical Record Number (MRN)."""
    date_prefix = datetime.now().strftime("%Y%m%d")
    for _ in range(10):
        candidate = f"MRN-{date_prefix}-{random.randint(1000, 9999)}"
        exists = db.query(PatientProfile).filter(PatientProfile.mrn == candidate).first()
        if not exists:
            return candidate
    return f"MRN-{date_prefix}-{random.randint(10000, 99999)}"


# =============================================================================
# 1. DOCTOR REGISTRATION
# =============================================================================
@router.post(
    "/register/doctor",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Doctor account"
)
def register_doctor(data: DoctorRegisterInput, db: Session = Depends(get_db)):
    """
    Creates a new user with role 'doctor' and creates an associated doctor_profile
    within an atomic database transaction.
    """
    # Check email uniqueness
    existing_user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    # Check license uniqueness
    existing_license = db.query(DoctorProfile).filter(
        DoctorProfile.license_number == data.license_number.strip()
    ).first()
    if existing_license:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A doctor with this license number already exists."
        )

    # Atomic transaction
    try:
        new_user = User(
            email=data.email.lower().strip(),
            password_hash=hash_password(data.password),
            full_name=data.full_name.strip(),
            role="doctor",
            is_active=True
        )
        db.add(new_user)
        db.flush()  # Populates new_user.id

        doctor_profile = DoctorProfile(
            user_id=new_user.id,
            license_number=data.license_number.strip(),
            specialization=data.specialization.strip() if data.specialization else "Stroke Neurology",
            hospital_affiliation=data.hospital_affiliation.strip() if data.hospital_affiliation else None,
            contact_phone=data.contact_phone.strip() if data.contact_phone else None
        )
        db.add(doctor_profile)

        db.commit()
        db.refresh(new_user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed due to database error: {exc}"
        )

    token = create_access_token({
        "sub": str(new_user.id),
        "email": new_user.email,
        "role": new_user.role,
        "full_name": new_user.full_name
    })

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=str(new_user.id),
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role
    )


# =============================================================================
# 2. PATIENT REGISTRATION
# =============================================================================
@router.post(
    "/register/patient",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Patient account"
)
def register_patient(data: PatientRegisterInput, db: Session = Depends(get_db)):
    """
    Creates a new user with role 'patient' and creates an associated patient_profile
    with an auto-generated MRN if none provided, inside an atomic transaction.
    """
    # Check email uniqueness
    existing_user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    # Determine MRN
    if data.mrn and data.mrn.strip():
        mrn = data.mrn.strip()
        existing_mrn = db.query(PatientProfile).filter(PatientProfile.mrn == mrn).first()
        if existing_mrn:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A patient with this Medical Record Number (MRN) already exists."
            )
    else:
        mrn = _generate_mrn(db)

    # Atomic transaction
    try:
        new_user = User(
            email=data.email.lower().strip(),
            password_hash=hash_password(data.password),
            full_name=data.full_name.strip(),
            role="patient",
            is_active=True
        )
        db.add(new_user)
        db.flush()

        patient_profile = PatientProfile(
            user_id=new_user.id,
            mrn=mrn,
            date_of_birth=data.date_of_birth,
            gender=data.gender,
            emergency_contact=data.emergency_contact.strip() if data.emergency_contact else None
        )
        db.add(patient_profile)

        db.commit()
        db.refresh(new_user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed due to database error: {exc}"
        )

    token = create_access_token({
        "sub": str(new_user.id),
        "email": new_user.email,
        "role": new_user.role,
        "full_name": new_user.full_name
    })

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=str(new_user.id),
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role
    )


# =============================================================================
# 3. USER LOGIN
# =============================================================================
@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate User (Doctor or Patient) and return JWT"
)
def login(data: UserLoginInput, db: Session = Depends(get_db)):
    """
    Verifies user credentials, confirms active status, and returns a signed JWT.
    """
    user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact administration."
        )

    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "full_name": user.full_name
    })

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role
    )


# =============================================================================
# 4. CURRENT USER ME ENDPOINT
# =============================================================================
@router.get(
    "/me",
    response_model=CurrentUserResponse,
    summary="Get profile of currently authenticated user"
)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Returns profile information for the authenticated user based on their JWT token.
    """
    doc_profile = None
    pat_profile = None

    if current_user.doctor_profile:
        doc_profile = DoctorProfileResponse(
            id=str(current_user.doctor_profile.id),
            license_number=current_user.doctor_profile.license_number,
            specialization=current_user.doctor_profile.specialization,
            hospital_affiliation=current_user.doctor_profile.hospital_affiliation,
            contact_phone=current_user.doctor_profile.contact_phone
        )

    if current_user.patient_profile:
        pat_profile = PatientProfileResponse(
            id=str(current_user.patient_profile.id),
            mrn=current_user.patient_profile.mrn,
            date_of_birth=current_user.patient_profile.date_of_birth,
            gender=current_user.patient_profile.gender,
            emergency_contact=current_user.patient_profile.emergency_contact
        )

    return CurrentUserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        doctor_profile=doc_profile,
        patient_profile=pat_profile
    )
