import uuid
from datetime import datetime, date
from typing import Optional, List, Any
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Date,
    Numeric,
    Text,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    text,
    func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from backend.database.database import Base


# =============================================================================
# 1. USER MODEL (Central Identity)
# =============================================================================
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(String(20), nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("role IN ('doctor', 'patient', 'admin')", name="chk_users_role"),
    )

    # Relationships
    doctor_profile = relationship("DoctorProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    patient_profile = relationship("PatientProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"


# =============================================================================
# 2. DOCTOR PROFILE MODEL
# =============================================================================
class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    license_number = Column(String(100), unique=True, nullable=False)
    specialization = Column(String(150), nullable=False, default="Stroke Neurology")
    hospital_affiliation = Column(String(200), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="doctor_profile")

    def __repr__(self) -> str:
        return f"<DoctorProfile id={self.id} license={self.license_number} spec={self.specialization}>"


# =============================================================================
# 3. PATIENT PROFILE MODEL
# =============================================================================
class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    mrn = Column(String(50), unique=True, nullable=False, index=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    emergency_contact = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("gender IS NULL OR gender IN ('Male', 'Female', 'Other')", name="chk_patient_gender"),
    )

    # Relationships
    user = relationship("User", back_populates="patient_profile")

    def __repr__(self) -> str:
        return f"<PatientProfile id={self.id} mrn={self.mrn}>"


# =============================================================================
# 4. DOCTOR-PATIENT ASSOCIATION MODEL
# =============================================================================
class DoctorPatient(Base):
    __tablename__ = "doctor_patient"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending", index=True)  # 'pending', 'active', 'discharged', 'declined', 'expired'
    relationship_type = Column(String(30), nullable=False, default="primary")  # 'primary', 'care_team'
    initiated_by = Column(String(20), nullable=False, default="doctor")  # 'doctor', 'patient'
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("doctor_id", "patient_id", name="uq_doctor_patient_pair"),
        CheckConstraint("status IN ('pending', 'active', 'discharged', 'declined', 'expired')", name="chk_doctor_patient_status"),
        CheckConstraint("relationship_type IN ('primary', 'care_team')", name="chk_doctor_patient_rel_type"),
        CheckConstraint("initiated_by IN ('doctor', 'patient')", name="chk_doctor_patient_initiated_by"),
    )

    # Relationships
    doctor = relationship("User", foreign_keys=[doctor_id])
    patient = relationship("User", foreign_keys=[patient_id])

    def __repr__(self) -> str:
        return f"<DoctorPatient doc={self.doctor_id} pat={self.patient_id} status={self.status} type={self.relationship_type}>"


# =============================================================================
# 5. ASSESSMENT MODEL
# =============================================================================
class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    assessment_type = Column(String(30), nullable=False, index=True)  # 'ai_system_flow' | 'regular_ml' | 'regular_ct'
    patient_vitals = Column(JSONB, nullable=True)
    ct_scan_path = Column(String(500), nullable=True)
    gatekeeper_status = Column(String(30), nullable=True)  # 'accepted' | 'rejected' | 'skipped'
    ct_diagnosis = Column(String(50), nullable=True)  # 'Normal' | 'Bleeding' | 'Ischemia'
    ct_confidence = Column(Numeric(5, 4), nullable=True)
    ml_risk_probability = Column(Numeric(5, 4), nullable=True)
    ml_risk_tier = Column(String(30), nullable=True)  # 'Low' | 'Moderate' | 'High'
    agent_findings = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("assessment_type IN ('ai_system_flow', 'regular_ml', 'regular_ct')", name="chk_assessment_type"),
        CheckConstraint("gatekeeper_status IS NULL OR gatekeeper_status IN ('accepted', 'rejected', 'skipped')", name="chk_gatekeeper_status"),
        CheckConstraint("ct_diagnosis IS NULL OR ct_diagnosis IN ('Normal', 'Bleeding', 'Ischemia', 'Rejected', 'Uncertain', 'N/A')", name="chk_ct_diagnosis"),
        CheckConstraint("ct_confidence IS NULL OR (ct_confidence >= 0 AND ct_confidence <= 1)", name="chk_ct_confidence"),
        CheckConstraint("ml_risk_probability IS NULL OR (ml_risk_probability >= 0 AND ml_risk_probability <= 1)", name="chk_ml_risk_probability"),
    )

    # Relationships
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[doctor_id])
    report = relationship("Report", back_populates="assessment", uselist=False, cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Assessment id={self.id} type={self.assessment_type} pat={self.patient_id}>"


# =============================================================================
# 6. REPORT MODEL
# =============================================================================
class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="RESTRICT"), nullable=False, unique=True, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    pdf_filename = Column(String(255), nullable=False)
    pdf_filepath = Column(String(500), nullable=False)
    report_summary = Column(JSONB, nullable=True)
    validation_status = Column(String(30), nullable=False, default="PASSED")  # 'PASSED' | 'FLAGGED' | 'PENDING_REVIEW'
    physician_signed_off = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("validation_status IN ('PASSED', 'FLAGGED', 'PENDING_REVIEW')", name="chk_reports_validation"),
    )

    # Relationships
    assessment = relationship("Assessment", back_populates="report")
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("User", foreign_keys=[doctor_id])

    def __repr__(self) -> str:
        return f"<Report id={self.id} file={self.pdf_filename} status={self.validation_status}>"


# =============================================================================
# 7. CONVERSATION MODEL (1-to-1 Doctor-Patient Thread)
# =============================================================================
class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("doctor_id", "patient_id", name="uq_conversations_doctor_patient"),
    )

    # Relationships
    doctor = relationship("User", foreign_keys=[doctor_id])
    patient = relationship("User", foreign_keys=[patient_id])
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at.asc()")

    def __repr__(self) -> str:
        return f"<Conversation id={self.id} doc={self.doctor_id} pat={self.patient_id}>"


# =============================================================================
# 8. MESSAGE MODEL
# =============================================================================
class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])

    def __repr__(self) -> str:
        return f"<Message id={self.id} convo={self.conversation_id} sender={self.sender_id}>"


# =============================================================================
# 9. NOTIFICATION MODEL
# =============================================================================
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False)  # 'new_message', 'report_ready', 'assessment_ready', etc.
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    __table_args__ = (
        CheckConstraint(
            "notification_type IN ('new_message', 'report_ready', 'assessment_ready', 'general', 'alert')",
            name="chk_notifications_type"
        ),
    )

    # Relationships
    user = relationship("User", back_populates="notifications")

    def __repr__(self) -> str:
        return f"<Notification id={self.id} user={self.user_id} title={self.title} read={self.is_read}>"
