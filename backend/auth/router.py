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
    Notification,
    AuditLog
)
from backend.auth.schemas import (
    DoctorRegisterInput,
    PatientRegisterInput,
    UserLoginInput,
    DoctorResubmitInfoInput,
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
            contact_phone=data.contact_phone.strip() if data.contact_phone else None,
            approval_status="pending"
        )
        db.add(doctor_profile)
        db.flush()

        # Audit event for application submission
        audit_event = AuditLog(
            actor_id=new_user.id,
            actor_role="doctor",
            actor_email=new_user.email,
            action="clinician_application_submitted",
            target_resource=f"doctor_profile:{doctor_profile.id}",
            outcome="SUCCESS",
            reason="Clinician registration submitted for administrative credential verification.",
            details={
                "license_number": doctor_profile.license_number,
                "specialization": doctor_profile.specialization,
                "hospital": doctor_profile.hospital_affiliation
            }
        )
        db.add(audit_event)

        db.commit()
        db.refresh(new_user)
        db.refresh(doctor_profile)
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
        role=new_user.role,
        approval_status=doctor_profile.approval_status,
        is_active=new_user.is_active
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

    approval_status = None
    if user.doctor_profile:
        approval_status = getattr(user.doctor_profile, "approval_status", "approved")

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
        role=user.role,
        approval_status=approval_status,
        is_active=user.is_active
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
            contact_phone=current_user.doctor_profile.contact_phone,
            approval_status=getattr(current_user.doctor_profile, "approval_status", "approved"),
            rejection_reason=getattr(current_user.doctor_profile, "rejection_reason", None),
            verification_reference=getattr(current_user.doctor_profile, "verification_reference", None),
            verification_notes=getattr(current_user.doctor_profile, "verification_notes", None),
            more_info_request=getattr(current_user.doctor_profile, "more_info_request", None),
            reviewed_at=getattr(current_user.doctor_profile, "reviewed_at", None)
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
        approval_status=doc_profile.approval_status if doc_profile else None,
        rejection_reason=doc_profile.rejection_reason if doc_profile else None,
        more_info_request=doc_profile.more_info_request if doc_profile else None,
        doctor_profile=doc_profile,
        patient_profile=pat_profile
    )


# =============================================================================
# 5. DOCTOR RESUBMISSION WORKFLOW
# =============================================================================
@router.post(
    "/doctor/resubmit-info",
    response_model=CurrentUserResponse,
    summary="Resubmit doctor credentials or clarifications when more information is requested"
)
def resubmit_doctor_info(
    data: DoctorResubmitInfoInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Allows a doctor whose application requires additional information
    (status 'more_info_required' or 'pending') to update their details,
    attach clarification notes, and place the application back into
    the administrative review queue with 'pending' status.
    """
    if current_user.role != "doctor" or not current_user.doctor_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered clinician accounts can resubmit credential information."
        )

    profile = current_user.doctor_profile
    if profile.approval_status not in ("more_info_required", "pending"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot resubmit credentials while account status is '{profile.approval_status}'."
        )

    # License uniqueness check if changing license number
    if data.license_number and data.license_number.strip() != profile.license_number:
        clean_license = data.license_number.strip()
        existing = db.query(DoctorProfile).filter(
            DoctorProfile.license_number == clean_license,
            DoctorProfile.id != profile.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A clinician with this license number already exists in the system."
            )
        profile.license_number = clean_license

    if data.specialization and data.specialization.strip():
        profile.specialization = data.specialization.strip()
    if data.hospital_affiliation is not None:
        profile.hospital_affiliation = data.hospital_affiliation.strip() or None
    if data.contact_phone is not None:
        profile.contact_phone = data.contact_phone.strip() or None

    # Append clarification notes to verification_notes
    existing_notes = profile.verification_notes or ""
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M UTC")
    clarification = data.clarification_notes.strip()
    profile.verification_notes = f"{existing_notes}\n[{timestamp_str}] Clinician Resubmission: {clarification}".strip()

    # Reset status to pending for administrative re-review
    profile.approval_status = "pending"

    # Log immutable audit event
    audit_event = AuditLog(
        actor_id=current_user.id,
        actor_role="doctor",
        actor_email=current_user.email,
        action="clinician_info_resubmitted",
        target_resource=f"doctor_profile:{profile.id}",
        outcome="SUCCESS",
        reason="Clinician submitted requested credential information and clarifications.",
        details={
            "license_number": profile.license_number,
            "clarification_notes": clarification
        }
    )
    db.add(audit_event)

    db.commit()
    db.refresh(current_user)
    db.refresh(profile)

    return get_current_user_profile(current_user=current_user)

