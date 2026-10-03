-- =============================================================================
-- StrokeAegis AI — Production PostgreSQL Initial Schema
-- Version: 1.0.0
-- Target: PostgreSQL 14+ (Compatible with PostgreSQL 18.x)
-- Purpose: Complete clinical database schema supporting Doctors, Patients,
--          Assessments, Reports, Conversations, Messages, and Notifications.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------
-- pgcrypto provides cryptographic hashing and gen_random_uuid() for robust UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 2. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 3. USERS TABLE
-- Central identity table for both doctors and patients. Passwords stored via bcrypt.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_role CHECK (role IN ('doctor', 'patient', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. DOCTOR PROFILES TABLE
-- 1-to-1 extension of users table for clinical practitioners.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    license_number VARCHAR(100) NOT NULL,
    specialization VARCHAR(150) NOT NULL DEFAULT 'Stroke Neurology',
    hospital_affiliation VARCHAR(200),
    contact_phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_doctor_profiles_user UNIQUE (user_id),
    CONSTRAINT uq_doctor_profiles_license UNIQUE (license_number),
    CONSTRAINT fk_doctor_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_doctor_profiles_user ON doctor_profiles(user_id);

DROP TRIGGER IF EXISTS trg_doctor_profiles_updated_at ON doctor_profiles;
CREATE TRIGGER trg_doctor_profiles_updated_at
    BEFORE UPDATE ON doctor_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 5. PATIENT PROFILES TABLE
-- 1-to-1 extension of users table for registered patients.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    mrn VARCHAR(50) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(20),
    emergency_contact VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_patient_profiles_user UNIQUE (user_id),
    CONSTRAINT uq_patient_profiles_mrn UNIQUE (mrn),
    CONSTRAINT chk_patient_gender CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Other')),
    CONSTRAINT fk_patient_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_patient_profiles_user ON patient_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_mrn ON patient_profiles(mrn);

DROP TRIGGER IF EXISTS trg_patient_profiles_updated_at ON patient_profiles;
CREATE TRIGGER trg_patient_profiles_updated_at
    BEFORE UPDATE ON patient_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 6. DOCTOR-PATIENT ASSOCIATION TABLE
-- Links a doctor to a patient with status tracking.
-- Unique constraint prevents duplicate relationships between same pair.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_patient (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_doctor_patient_pair UNIQUE (doctor_id, patient_id),
    CONSTRAINT chk_doctor_patient_status CHECK (status IN ('pending', 'active', 'discharged')),
    CONSTRAINT fk_doctor_patient_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_doctor_patient_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_doctor_patient_doctor ON doctor_patient(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_patient ON doctor_patient(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_status ON doctor_patient(status);

DROP TRIGGER IF EXISTS trg_doctor_patient_updated_at ON doctor_patient;
CREATE TRIGGER trg_doctor_patient_updated_at
    BEFORE UPDATE ON doctor_patient
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 7. ASSESSMENTS TABLE
-- Stores full diagnostic runs (AI System Wizard, ML Risk, CT Scan analysis).
-- Patient ownership is mandatory. Doctor ID is optional for self-assessments.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    doctor_id UUID,
    assessment_type VARCHAR(30) NOT NULL,
    patient_vitals JSONB,
    ct_scan_path VARCHAR(500),
    gatekeeper_status VARCHAR(30),
    ct_diagnosis VARCHAR(50),
    ct_confidence NUMERIC(5, 4),
    ml_risk_probability NUMERIC(5, 4),
    ml_risk_tier VARCHAR(30),
    agent_findings JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_assessment_type CHECK (assessment_type IN ('ai_system_flow', 'regular_ml', 'regular_ct')),
    CONSTRAINT chk_gatekeeper_status CHECK (gatekeeper_status IS NULL OR gatekeeper_status IN ('accepted', 'rejected', 'skipped')),
    CONSTRAINT chk_ct_diagnosis CHECK (ct_diagnosis IS NULL OR ct_diagnosis IN ('Normal', 'Bleeding', 'Ischemia', 'Rejected', 'Uncertain', 'N/A')),
    CONSTRAINT chk_ct_confidence CHECK (ct_confidence IS NULL OR (ct_confidence >= 0 AND ct_confidence <= 1)),
    CONSTRAINT chk_ml_risk_probability CHECK (ml_risk_probability IS NULL OR (ml_risk_probability >= 0 AND ml_risk_probability <= 1)),
    CONSTRAINT fk_assessments_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_assessments_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assessments_patient ON assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_assessments_doctor ON assessments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_type ON assessments(assessment_type);

DROP TRIGGER IF EXISTS trg_assessments_updated_at ON assessments;
CREATE TRIGGER trg_assessments_updated_at
    BEFORE UPDATE ON assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 8. REPORTS TABLE
-- Clinical PDF report metadata and sign-off status linked to an assessment.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    doctor_id UUID,
    pdf_filename VARCHAR(255) NOT NULL,
    pdf_filepath VARCHAR(500) NOT NULL,
    report_summary JSONB,
    validation_status VARCHAR(30) NOT NULL DEFAULT 'PASSED',
    physician_signed_off BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reports_assessment UNIQUE (assessment_id),
    CONSTRAINT chk_reports_validation CHECK (validation_status IN ('PASSED', 'FLAGGED', 'PENDING_REVIEW')),
    CONSTRAINT fk_reports_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reports_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reports_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_patient ON reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_reports_doctor ON reports(doctor_id);
CREATE INDEX IF NOT EXISTS idx_reports_assessment ON reports(assessment_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

DROP TRIGGER IF EXISTS trg_reports_updated_at ON reports;
CREATE TRIGGER trg_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 9. CONVERSATIONS TABLE
-- 1-to-1 secure message thread between a Doctor and a Patient.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_conversations_doctor_patient UNIQUE (doctor_id, patient_id),
    CONSTRAINT fk_conversations_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_conversations_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_conversations_doctor ON conversations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_patient ON conversations(patient_id);

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON conversations;
CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 10. MESSAGES TABLE
-- Individual messages inside a 1-to-1 doctor-patient conversation.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);

DROP TRIGGER IF EXISTS trg_messages_updated_at ON messages;
CREATE TRIGGER trg_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 11. NOTIFICATIONS TABLE
-- Real-time / persistent notifications for users (e.g., report ready, new message).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    reference_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_notifications_type CHECK (notification_type IN ('new_message', 'report_ready', 'assessment_ready', 'general', 'alert')),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
