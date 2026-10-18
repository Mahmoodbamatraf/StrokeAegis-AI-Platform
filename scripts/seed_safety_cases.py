"""
Script to seed realistic benchmark Clinical Safety Queue cases in PostgreSQL
- Case 1: Non-Brain CT Gatekeeper Rejection (ConvNeXt-Tiny safety gatekeeper rejected non-brain artifact)
- Case 2: Clinical Safety Validation FLAGGED (Medical Validation Agent flagged contraindication)
- Case 3: Low-Confidence CT Classification (Review Zone: 58.2% confidence)
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from backend.database.database import SessionLocal
from backend.database.models import User, PatientProfile, Assessment, Report

def seed_safety_cases():
    db = SessionLocal()
    try:
        # 1. Get or find patient
        patient = db.query(User).filter(User.email == "patient@strokeaegis.local").first()
        if not patient:
            patient = db.query(User).filter(User.role == "patient").first()
        if not patient:
            print("No patient user found to attach safety cases.")
            return

        # 2. Check if cases already exist
        existing_gate = db.query(Assessment).filter(Assessment.gatekeeper_status == "rejected").first()
        if not existing_gate:
            print("Seeding Case 1: Gatekeeper Rejection (Non-Brain Slice)...")
            case1 = Assessment(
                id=uuid.uuid4(),
                patient_id=patient.id,
                doctor_id=None,
                assessment_type="ai_system_flow",
                patient_vitals={
                    "age": 64, "gender": "Male", "hypertension": 1, "heart_disease": 0,
                    "avg_glucose_level": 142.5, "bmi": 28.4, "smoking_status": "formerly smoked"
                },
                ct_scan_path="uploads/ct_scans/nonbrain_sample_gate.png",
                gatekeeper_status="rejected",
                ct_diagnosis="Rejected",
                ct_confidence=Decimal("0.9942"),
                ml_risk_probability=Decimal("0.4210"),
                ml_risk_tier="Moderate",
                agent_findings={
                    "gatekeeper": {
                        "status": "rejected",
                        "model": "ConvNeXt-Tiny-Gatekeeper-v1.4",
                        "anatomical_validity": False,
                        "rejection_reason": "Non-brain anatomical artifact detected. Image slice rejected at door gate to prevent erroneous classification."
                    }
                },
                safety_status="awaiting_assignment",
                safety_notes="Automated CT gatekeeper rejected scan slice. Re-upload or clinical scan verification required.",
                created_at=datetime.now(timezone.utc) - timedelta(hours=3)
            )
            db.add(case1)
            db.commit()
            print("Case 1 created:", case1.id)
        else:
            print("Case 1 (Gatekeeper rejection) already present:", existing_gate.id)

        existing_flag = db.query(Report).filter(Report.validation_status == "FLAGGED").first()
        if not existing_flag:
            print("Seeding Case 2: Validation FLAGGED Case...")
            case2_id = uuid.uuid4()
            case2 = Assessment(
                id=case2_id,
                patient_id=patient.id,
                doctor_id=None,
                assessment_type="ai_system_flow",
                patient_vitals={
                    "age": 72, "gender": "Female", "hypertension": 1, "heart_disease": 1,
                    "avg_glucose_level": 210.0, "bmi": 31.2, "smoking_status": "never smoked"
                },
                ct_scan_path="uploads/ct_scans/hemorrhage_sample_flag.png",
                gatekeeper_status="accepted",
                ct_diagnosis="Bleeding",
                ct_confidence=Decimal("0.9250"),
                ml_risk_probability=Decimal("0.8450"),
                ml_risk_tier="High",
                agent_findings={
                    "medical_validation": {
                        "status": "FLAGGED",
                        "validation_issues": [
                            "CRITICAL CONTRADICTION: Acute Intracranial Hemorrhage confirmed on CT slice, but vascular recommendations suggested antiplatelet regimen. Immediate Attending Neurologist review required."
                        ]
                    }
                },
                safety_status="under_review",
                safety_notes="Validation agent flagged critical contraindication between CT hemorrhage findings and medication protocol.",
                created_at=datetime.now(timezone.utc) - timedelta(hours=5)
            )
            db.add(case2)
            db.flush()

            rep2 = Report(
                id=uuid.uuid4(),
                assessment_id=case2.id,
                patient_id=patient.id,
                doctor_id=None,
                pdf_filename="SA-2026-FLAG-HEM.pdf",
                pdf_filepath="reports/SA-2026-FLAG-HEM.pdf",
                validation_status="FLAGGED",
                physician_signed_off=False,
                report_summary={
                    "validation_notes": "Clinical validation agent flagged acute contradiction. Report withheld from final sign-off until neurologist reassessment."
                },
                created_at=datetime.now(timezone.utc) - timedelta(hours=5)
            )
            db.add(rep2)
            db.commit()
            print("Case 2 created:", case2.id)
        else:
            print("Case 2 (Validation FLAGGED) already present:", existing_flag.id)

        # Case 3: Low confidence review-zone case
        existing_lowconf = db.query(Assessment).filter(Assessment.ct_confidence != None, Assessment.ct_confidence < Decimal("0.65")).first()
        if not existing_lowconf:
            print("Seeding Case 3: Low CT Confidence Review-Zone Case...")
            case3 = Assessment(
                id=uuid.uuid4(),
                patient_id=patient.id,
                doctor_id=None,
                assessment_type="ai_system_flow",
                patient_vitals={
                    "age": 58, "gender": "Male", "hypertension": 1, "heart_disease": 0,
                    "avg_glucose_level": 115.0, "bmi": 26.1, "smoking_status": "currently smokes"
                },
                ct_scan_path="uploads/ct_scans/uncertain_infarct_zone.png",
                gatekeeper_status="accepted",
                ct_diagnosis="Ischemia",
                ct_confidence=Decimal("0.5840"),
                ml_risk_probability=Decimal("0.6120"),
                ml_risk_tier="Moderate",
                agent_findings={
                    "ct_classifier": {
                        "uncertainty_zone": True,
                        "confidence": 0.5840,
                        "rationale": "Early hypoattenuation subtle; falls within model confidence review zone (<65%)."
                    }
                },
                safety_status="awaiting_assignment",
                safety_notes="Low classification confidence (58.4%). Neurologist visual review and second-slice CT review recommended.",
                created_at=datetime.now(timezone.utc) - timedelta(hours=7)
            )
            db.add(case3)
            db.commit()
            print("Case 3 created:", case3.id)
        else:
            print("Case 3 (Low confidence) already present:", existing_lowconf.id)

        print("Safety cases seed completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_safety_cases()
