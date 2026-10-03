from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


EMAIL_REGEX = r"^[^@\s]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-.]+)*$"


# =============================================================================
# REGISTRATION SCHEMAS
# =============================================================================

class DoctorRegisterInput(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX, description="Valid email address (supports .local)")
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    full_name: str = Field(..., min_length=2, max_length=150)
    license_number: str = Field(..., min_length=2, max_length=100)
    specialization: Optional[str] = Field("Stroke Neurology", max_length=150)
    hospital_affiliation: Optional[str] = Field(None, max_length=200)
    contact_phone: Optional[str] = Field(None, max_length=50)

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, v):
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("full_name", "license_number", mode="before")
    @classmethod
    def clean_strings(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("hospital_affiliation", "contact_phone", "specialization", mode="before")
    @classmethod
    def clean_optional_strings(cls, v):
        if isinstance(v, str):
            cleaned = v.strip()
            return cleaned if cleaned else None
        return v


class PatientRegisterInput(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX, description="Valid email address (supports .local)")
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    full_name: str = Field(..., min_length=2, max_length=150)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, description="'Male', 'Female', or 'Other'")
    emergency_contact: Optional[str] = Field(None, max_length=100)
    mrn: Optional[str] = Field(None, max_length=50, description="Optional. Auto-generated if omitted.")

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, v):
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("full_name", mode="before")
    @classmethod
    def clean_name(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("date_of_birth", mode="before")
    @classmethod
    def parse_dob(cls, v):
        if not v or (isinstance(v, str) and not v.strip()):
            return None
        if isinstance(v, str):
            v = v.strip()
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                try:
                    return datetime.strptime(v, fmt).date()
                except ValueError:
                    pass
            try:
                return date.fromisoformat(v)
            except ValueError:
                return None
        return v

    @field_validator("gender", mode="before")
    @classmethod
    def parse_gender(cls, v):
        if not v or (isinstance(v, str) and not v.strip()):
            return None
        v_clean = str(v).strip().capitalize()
        if v_clean in ("Male", "Female", "Other"):
            return v_clean
        return None

    @field_validator("emergency_contact", "mrn", mode="before")
    @classmethod
    def clean_optional_patient_strings(cls, v):
        if isinstance(v, str):
            cleaned = v.strip()
            return cleaned if cleaned else None
        return v


# =============================================================================
# LOGIN SCHEMA
# =============================================================================

class UserLoginInput(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX, description="User email address")
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, v):
        if isinstance(v, str):
            return v.strip().lower()
        return v


# =============================================================================
# RESPONSE SCHEMAS
# =============================================================================

class DoctorProfileResponse(BaseModel):
    id: str
    license_number: str
    specialization: str
    hospital_affiliation: Optional[str] = None
    contact_phone: Optional[str] = None

    model_config = {"from_attributes": True}


class PatientProfileResponse(BaseModel):
    id: str
    mrn: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    emergency_contact: Optional[str] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: str
    role: str


class CurrentUserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    doctor_profile: Optional[DoctorProfileResponse] = None
    patient_profile: Optional[PatientProfileResponse] = None

    model_config = {"from_attributes": True}
