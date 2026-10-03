"""
StrokeAegis AI — Comprehensive Multi-Patient Clinical Demo Seed Script
Seeds:
  1. Demo Doctor (Dr. Sarah Al-Mansoor)
  2. Four Diverse Clinical Patients:
     - Ahmed Al-Harthi (High Risk Ischemia, Certified Report)
     - Fatima Al-Zahrani (High Risk Hemorrhagic Bleeding, Pending Review)
     - Khalid Al-Otaibi (Low Risk Normal Scan, Self-Check Complete)
     - Mariam Al-Dosari (Moderate Risk Ischemia, Active Consultation)
  3. Doctor-Patient associations linking all patients to doctors
  4. Clinical assessments, reports, 1-to-1 conversations, messages, and notifications
This script is completely IDEMPOTENT (safe to execute multiple times).
"""

import os
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy.orm import Session
from backend.database.database import SessionLocal
from backend.database.models import (
    User,
    DoctorProfile,
    PatientProfile,
    DoctorPatient,
    Conversation,
    Message,
    Notification,
    Assessment,
    Report
)
from backend.auth.security import hash_password


def seed_demo_data():
    db: Session = SessionLocal()
    print("[Seed] Starting StrokeAegis multi-patient clinical database seeding...")

    try:
        # =====================================================================
        # 1. Seed Demo Doctor: Dr. Sarah Al-Mansoor
        # =====================================================================
        doctor_email = "doctor@strokeaegis.local"
        doctor_user = db.query(User).filter(User.email == doctor_email).first()

        if not doctor_user:
            print(f"[Seed] Creating demo doctor: {doctor_email}")
            doctor_user = User(
                email=doctor_email,
                password_hash=hash_password("DoctorSecure2026!"),
                full_name="Dr. Sarah Al-Mansoor",
                role="doctor",
                is_active=True
            )
            db.add(doctor_user)
            db.flush()

            doctor_profile = DoctorProfile(
                user_id=doctor_user.id,
                license_number="MD-SA-98234",
                specialization="Stroke Neurology & Neurocritical Care",
                hospital_affiliation="King Faisal Specialist Hospital & Research Centre",
                contact_phone="+966-50-123-4567"
            )
            db.add(doctor_profile)
            db.commit()
            print("       [OK] Demo doctor Dr. Sarah Al-Mansoor created.")
        else:
            print(f"[Seed] Demo doctor '{doctor_email}' exists.")

        # Collect all doctors in the database to link patients to them
        all_doctors = db.query(User).filter(User.role == "doctor").all()

        # =====================================================================
        # 2. Seed Diverse Demo Patients
        # =====================================================================
        patients_data = [
            {
                "email": "patient@strokeaegis.local",
                "password": "PatientSecure2026!",
                "full_name": "Ahmed Al-Harthi",
                "mrn": "MRN-202609-001",
                "dob": date(1959, 4, 12),
                "gender": "Male",
                "emergency_contact": "Fatima Al-Harthi (+966-55-987-6543)",
                "assessment": {
                    "type": "ai_system_flow",
                    "vitals": {
                        "gender": "Male", "age": 67.0, "hypertension": 1, "heart_disease": 1,
                        "ever_married": "Yes", "work_type": "Private", "Residence_type": "Urban",
                        "avg_glucose_level": 228.69, "bmi": 36.6, "smoking_status": "formerly smoked"
                    },
                    "gate": "accepted",
                    "diagnosis": "Ischemia",
                    "confidence": 0.9420,
                    "risk_prob": 0.7845,
                    "risk_tier": "High",
                    "findings": {
                        "consensus": "Acute cerebral ischemia in left MCA territory requiring urgent intervention.",
                        "action_plan": "1. Urgent CT angiogram. 2. Evaluate for IV thrombolysis / thrombectomy eligibility. 3. Continuous BP telemetry."
                    }
                },
                "report": {
                    "filename": "SA-2026-0DC110.pdf",
                    "signed_off": True,
                    "summary": {
                        "diagnosis": "Ischemia", "confidence": 0.942, "risk_tier": "High", "risk_probability": 0.7845
                    }
                },
                "welcome_msg": "Hello Ahmed, your baseline neurological profile is active under my supervision. Please reach out here if you experience sudden numbness, facial droop, or speech difficulty."
            },
            {
                "email": "fatima@strokeaegis.local",
                "password": "PatientSecure2026!",
                "full_name": "Fatima Al-Zahrani",
                "mrn": "MRN-202609-002",
                "dob": date(1967, 8, 23),
                "gender": "Female",
                "emergency_contact": "Tariq Al-Zahrani (+966-50-222-3344)",
                "assessment": {
                    "type": "ai_system_flow",
                    "vitals": {
                        "gender": "Female", "age": 59.0, "hypertension": 1, "heart_disease": 0,
                        "ever_married": "Yes", "work_type": "Self-employed", "Residence_type": "Urban",
                        "avg_glucose_level": 195.4, "bmi": 32.1, "smoking_status": "never smoked"
                    },
                    "gate": "accepted",
                    "diagnosis": "Bleeding",
                    "confidence": 0.9150,
                    "risk_prob": 0.6520,
                    "risk_tier": "High",
                    "findings": {
                        "consensus": "Acute hyperdense intraparenchymal hemorrhage detected in right basal ganglia.",
                        "action_plan": "1. Stat neurosurgical consult. 2. Immediate systolic BP reduction < 140 mmHg. 3. Reversal of any anticoagulation."
                    }
                },
                "report": {
                    "filename": "SA-2026-FATIMA-BLEED.pdf",
                    "signed_off": False,
                    "summary": {
                        "diagnosis": "Bleeding", "confidence": 0.915, "risk_tier": "High", "risk_probability": 0.6520
                    }
                },
                "welcome_msg": "Good day Fatima, your CT neuroimaging has been processed. We are monitoring your blood pressure closely. Please let me know immediately if you develop headaches."
            },
            {
                "email": "khalid@strokeaegis.local",
                "password": "PatientSecure2026!",
                "full_name": "Khalid Al-Otaibi",
                "mrn": "MRN-202609-003",
                "dob": date(1978, 2, 14),
                "gender": "Male",
                "emergency_contact": "Reem Al-Otaibi (+966-56-777-8899)",
                "assessment": {
                    "type": "regular_ml",
                    "vitals": {
                        "gender": "Male", "age": 48.0, "hypertension": 0, "heart_disease": 0,
                        "ever_married": "Yes", "work_type": "Govt_job", "Residence_type": "Urban",
                        "avg_glucose_level": 92.5, "bmi": 24.8, "smoking_status": "never smoked"
                    },
                    "gate": None,
                    "diagnosis": "Normal",
                    "confidence": 0.9850,
                    "risk_prob": 0.1420,
                    "risk_tier": "Low",
                    "findings": {
                        "consensus": "Optimal baseline vascular health with no acute ischemic or hemorrhagic lesions.",
                        "action_plan": "Routine annual screening and maintenance of active lifestyle."
                    }
                },
                "report": None,
                "welcome_msg": "Welcome Khalid. Your self-check assessment shows low stroke probability. Continue maintaining healthy diet and regular cardiovascular exercise."
            },
            {
                "email": "mariam@strokeaegis.local",
                "password": "PatientSecure2026!",
                "full_name": "Mariam Al-Dosari",
                "mrn": "MRN-202609-004",
                "dob": date(1963, 11, 5),
                "gender": "Female",
                "emergency_contact": "Saud Al-Dosari (+966-54-111-2233)",
                "assessment": {
                    "type": "ai_system_flow",
                    "vitals": {
                        "gender": "Female", "age": 63.0, "hypertension": 1, "heart_disease": 0,
                        "ever_married": "Yes", "work_type": "Private", "Residence_type": "Rural",
                        "avg_glucose_level": 142.8, "bmi": 27.5, "smoking_status": "never smoked"
                    },
                    "gate": "accepted",
                    "diagnosis": "Ischemia",
                    "confidence": 0.8870,
                    "risk_prob": 0.4280,
                    "risk_tier": "Moderate",
                    "findings": {
                        "consensus": "Subacute lacunar infarct in posterior limb of internal capsule.",
                        "action_plan": "1. Dual antiplatelet therapy evaluation. 2. High-intensity statin therapy. 3. Outpatient carotid Doppler."
                    }
                },
                "report": {
                    "filename": "SA-2026-MARIAM-LACUNAR.pdf",
                    "signed_off": True,
                    "summary": {
                        "diagnosis": "Ischemia", "confidence": 0.887, "risk_tier": "Moderate", "risk_probability": 0.4280
                    }
                },
                "welcome_msg": "Hello Mariam, your clinical findings have been reviewed and certified. Please review the care recommendations in your reports tab."
            }
        ]

        # Ensure sample PDFs exist on disk
        reports_dir = PROJECT_ROOT / "backend" / "generated_reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        sample_source_pdf = reports_dir / "SA-2026-0DC110.pdf"

        # Create placeholder sample PDF if not exists
        if not sample_source_pdf.exists():
            sample_source_pdf.write_bytes(b"%PDF-1.4 Mock Hospital Grade Clinical Decision Report StrokeAegis AI\n%%EOF")

        for pdata in patients_data:
            p_user = db.query(User).filter(User.email == pdata["email"]).first()
            if not p_user:
                print(f"[Seed] Creating patient: {pdata['full_name']} ({pdata['email']})")
                p_user = User(
                    email=pdata["email"],
                    password_hash=hash_password(pdata["password"]),
                    full_name=pdata["full_name"],
                    role="patient",
                    is_active=True
                )
                db.add(p_user)
                db.flush()

                p_profile = PatientProfile(
                    user_id=p_user.id,
                    mrn=pdata["mrn"],
                    date_of_birth=pdata["dob"],
                    gender=pdata["gender"],
                    emergency_contact=pdata["emergency_contact"]
                )
                db.add(p_profile)
                db.commit()
                print(f"       [OK] Patient profile created with MRN: {pdata['mrn']}")
            else:
                print(f"[Seed] Patient '{pdata['email']}' already exists.")

            # Link patient to demo doctor (Dr. Sarah Al-Mansoor)
            assoc = db.query(DoctorPatient).filter(
                DoctorPatient.doctor_id == doctor_user.id,
                DoctorPatient.patient_id == p_user.id
            ).first()
            if not assoc:
                assoc = DoctorPatient(
                    doctor_id=doctor_user.id,
                    patient_id=p_user.id,
                    status="active",
                    relationship_type="primary",
                    initiated_by="doctor"
                )
                db.add(assoc)
                db.commit()

            # Ensure 1-to-1 conversation exists with demo doctor
            convo = db.query(Conversation).filter(
                Conversation.doctor_id == doctor_user.id,
                Conversation.patient_id == p_user.id
            ).first()
            if not convo:
                convo = Conversation(
                    doctor_id=doctor_user.id,
                    patient_id=p_user.id
                )
                db.add(convo)
                db.flush()

                msg = Message(
                    conversation_id=convo.id,
                    sender_id=doctor_user.id,
                    content=pdata["welcome_msg"],
                    is_read=False
                )
                db.add(msg)
                db.commit()

            # Seed Assessment if not exists
            existing_ass = db.query(Assessment).filter(Assessment.patient_id == p_user.id).first()
            if not existing_ass and pdata.get("assessment"):
                ass_info = pdata["assessment"]
                ass = Assessment(
                    patient_id=p_user.id,
                    doctor_id=doctor_user.id,
                    assessment_type=ass_info["type"],
                    patient_vitals=ass_info["vitals"],
                    gatekeeper_status=ass_info["gate"],
                    ct_diagnosis=ass_info["diagnosis"],
                    ct_confidence=ass_info["confidence"],
                    ml_risk_probability=ass_info["risk_prob"],
                    ml_risk_tier=ass_info["risk_tier"],
                    agent_findings=ass_info["findings"]
                )
                db.add(ass)
                db.flush()

                # Seed Report if specified
                if pdata.get("report"):
                    rep_info = pdata["report"]
                    pdf_target = reports_dir / rep_info["filename"]
                    if not pdf_target.exists():
                        try:
                            from backend.reports.pdf_generator import generate_clinical_pdf
                            gen_data = {
                                "report_id": rep_info["filename"].replace(".pdf", ""),
                                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                "patient": {
                                    "full_name": pdata["full_name"],
                                    "mrn": pdata["mrn"],
                                    "gender": pdata["gender"],
                                    "age": int(ass_info["vitals"].get("age", 60)),
                                    "bmi": ass_info["vitals"].get("bmi", 26.5),
                                    "smoking_status": ass_info["vitals"].get("smoking_status", "never smoked"),
                                    "hypertension": ass_info["vitals"].get("hypertension", 0),
                                    "heart_disease": ass_info["vitals"].get("heart_disease", 0),
                                    "avg_glucose_level": ass_info["vitals"].get("avg_glucose_level", 110.0),
                                    "Residence_type": ass_info["vitals"].get("Residence_type", "Urban")
                                },
                                "attending_physician": {
                                    "full_name": doctor_user.full_name,
                                    "specialty": "Stroke Neurology & Neurocritical Care",
                                    "license_id": "SCFHS-2024-884910",
                                    "certification_status": "CERTIFIED & SIGNED" if rep_info["signed_off"] else "PENDING REVIEW"
                                },
                                "risk_assessment": {
                                    "stroke_probability_pct": round(float(ass_info["risk_prob"]) * 100, 1),
                                    "risk_tier": ass_info["risk_tier"],
                                    "risk_tier_description": f"Vascular hazard evaluation calibrated by machine learning ensemble."
                                },
                                "ct_analysis": {
                                    "gate": {"accepted": ass_info["gate"] == "accepted", "confidence_pct": 99.2},
                                    "diagnosis": {
                                        "prediction": ass_info["diagnosis"],
                                        "confidence_pct": round(float(ass_info["confidence"]) * 100, 1),
                                        "gradcam": {"anatomical_quadrant": f"CT Neuroimaging: {ass_info['diagnosis']}"}
                                    }
                                },
                                "overall_clinical_summary": ass_info["findings"]["consensus"],
                                "key_recommendations": [ass_info["findings"]["action_plan"]]
                            }
                            generate_clinical_pdf(gen_data)
                        except Exception as e:
                            print(f"[Seed] Fallback PDF creation: {e}")
                            if sample_source_pdf.exists():
                                pdf_target.write_bytes(sample_source_pdf.read_bytes())

                    rep = Report(
                        assessment_id=ass.id,
                        patient_id=p_user.id,
                        doctor_id=doctor_user.id,
                        pdf_filename=rep_info["filename"],
                        pdf_filepath=str(pdf_target),
                        report_summary=rep_info["summary"],
                        validation_status="PASSED",
                        physician_signed_off=rep_info["signed_off"]
                    )
                    db.add(rep)

                # Seed Welcome Notification
                notif = Notification(
                    user_id=p_user.id,
                    title="Welcome to StrokeAegis Clinical Care",
                    message=f"You are admitted under the neurological care of {doctor_user.full_name}. Review your health profile and messages.",
                    notification_type="general",
                    is_read=False
                )
                db.add(notif)
                db.commit()

        print("\n==================================================================")
        print("MULTI-PATIENT CLINICAL SEEDING COMPLETED SUCCESSFULLY!")
        print("Seeded 1 Doctor and 4 Patients with active associations & history:")
        for p in patients_data:
            print(f"  • {p['full_name']:<20} | {p['email']:<28} | MRN: {p['mrn']}")
        print("==================================================================")

    except Exception as exc:
        db.rollback()
        print(f"[Seed] ERROR during seeding: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
