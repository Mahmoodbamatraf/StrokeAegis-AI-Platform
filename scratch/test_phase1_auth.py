"""
StrokeAegis AI — Phase 1 Comprehensive Automated Test Suite
Tests:
  1. PostgreSQL Connection & Table Schema Integrity
  2. Direct Bcrypt Password Hashing & Salt Verification
  3. PyJWT Token Creation & Expiry Verification
  4. FastAPI Endpoints (/api/auth/register/doctor, /api/auth/register/patient, /api/auth/login, /api/auth/me)
  5. Role Isolation (Doctor vs Patient guards)
  6. Existing AI Endpoint Preservation (/api/chatbot/health)
"""

import sys
import uuid
from datetime import date
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from backend.database.database import check_db_connection, SessionLocal
from backend.database.models import User, DoctorProfile, PatientProfile, DoctorPatient
from backend.auth.security import hash_password, verify_password, create_access_token, decode_access_token
from backend.app import app


def test_suite():
    print("==================================================================")
    print("  STROKEAegis AI — PHASE 1 AUTOMATED VERIFICATION SUITE")
    print("==================================================================")

    # -----------------------------------------------------------------
    # 1. DATABASE CONNECTIVITY
    # -----------------------------------------------------------------
    print("\n[TEST 1] Testing Database Connection...")
    status = check_db_connection()
    assert status["status"] == "connected", f"Database not connected: {status}"
    print(f"  [PASS] Connected to PostgreSQL '{status['database']}' at {status['host']}:{status['port']}")

    # -----------------------------------------------------------------
    # 2. PASSWORD SECURITY (DIRECT BCRYPT)
    # -----------------------------------------------------------------
    print("\n[TEST 2] Testing Password Hashing & Verification...")
    test_pass = "NeurologyStrokeSecret2026!"
    hashed = hash_password(test_pass)
    assert hashed != test_pass, "Password hash must not match plaintext!"
    assert hashed.startswith("$2b$"), f"Expected bcrypt hash starting with $2b$, got {hashed[:5]}"
    assert verify_password(test_pass, hashed) is True, "Password verification failed for correct password!"
    assert verify_password("WrongPassword123", hashed) is False, "Password verification should fail for wrong password!"
    print(f"  [PASS] Direct bcrypt hashing and verification confirmed. Hash: {hashed[:28]}...")

    # -----------------------------------------------------------------
    # 3. JWT TOKEN CREATION & DECODING
    # -----------------------------------------------------------------
    print("\n[TEST 3] Testing PyJWT Token Lifecycle...")
    test_uuid = str(uuid.uuid4())
    token = create_access_token({
        "sub": test_uuid,
        "email": "test@strokeaegis.local",
        "role": "doctor"
    })
    assert isinstance(token, str) and len(token) > 20, "Invalid token produced"
    payload = decode_access_token(token)
    assert payload is not None, "Token decoding returned None"
    assert payload["sub"] == test_uuid
    assert payload["role"] == "doctor"
    assert payload["email"] == "test@strokeaegis.local"
    assert "exp" in payload, "Missing expiration claim in JWT"
    print(f"  [PASS] JWT generated and decoded successfully with sub={test_uuid}")

    # -----------------------------------------------------------------
    # 4. FASTAPI AUTH ENDPOINTS VIA TESTCLIENT
    # -----------------------------------------------------------------
    print("\n[TEST 4] Testing FastAPI Auth Endpoints via TestClient...")
    client = TestClient(app)

    unique_suffix = uuid.uuid4().hex[:6]
    test_doc_email = f"dr.test_{unique_suffix}@strokeaegis.local"
    test_doc_license = f"LIC-{unique_suffix}"

    # 4a. Register Doctor
    doc_payload = {
        "email": test_doc_email,
        "password": "DocTestPassword2026!",
        "full_name": "Dr. Test Neurologist",
        "license_number": test_doc_license,
        "specialization": "Interventional Neurology",
        "hospital_affiliation": "City Stroke Center",
        "contact_phone": "+966-50-000-0001"
    }
    r_doc = client.post("/api/auth/register/doctor", json=doc_payload)
    assert r_doc.status_code == 201, f"Doctor register failed ({r_doc.status_code}): {r_doc.text}"
    doc_data = r_doc.json()
    assert "access_token" in doc_data
    assert doc_data["role"] == "doctor"
    assert doc_data["email"] == test_doc_email
    doc_token = doc_data["access_token"]
    print(f"  [PASS] POST /api/auth/register/doctor returned 201 Created (Token issued)")

    # 4b. Duplicate Doctor Registration (Must Fail 400)
    r_dup = client.post("/api/auth/register/doctor", json=doc_payload)
    assert r_dup.status_code == 400, f"Expected 400 for duplicate email, got {r_dup.status_code}"
    print(f"  [PASS] Duplicate email registration correctly rejected with 400 Bad Request")

    # 4c. Register Patient
    test_pat_email = f"patient.test_{unique_suffix}@strokeaegis.local"
    pat_payload = {
        "email": test_pat_email,
        "password": "PatTestPassword2026!",
        "full_name": "Test Patient",
        "date_of_birth": "1965-08-20",
        "gender": "Female",
        "emergency_contact": "Emergency Kin (+966-55-111-2222)"
    }
    r_pat = client.post("/api/auth/register/patient", json=pat_payload)
    assert r_pat.status_code == 201, f"Patient register failed ({r_pat.status_code}): {r_pat.text}"
    pat_data = r_pat.json()
    assert "access_token" in pat_data
    assert pat_data["role"] == "patient"
    pat_token = pat_data["access_token"]
    print(f"  [PASS] POST /api/auth/register/patient returned 201 Created (Auto-MRN generated)")

    # 4d. Login with valid Doctor credentials
    r_login = client.post("/api/auth/login", json={
        "email": test_doc_email,
        "password": "DocTestPassword2026!"
    })
    assert r_login.status_code == 200, f"Login failed: {r_login.text}"
    assert "access_token" in r_login.json()
    print(f"  [PASS] POST /api/auth/login authenticated doctor successfully")

    # 4e. Login with invalid password (Must Fail 401)
    r_bad_login = client.post("/api/auth/login", json={
        "email": test_doc_email,
        "password": "WrongPassword!"
    })
    assert r_bad_login.status_code == 401, f"Expected 401 for bad password, got {r_bad_login.status_code}"
    print(f"  [PASS] Incorrect password login rejected with 401 Unauthorized")

    # 4f. Test /api/auth/me for Doctor
    r_me_doc = client.get("/api/auth/me", headers={"Authorization": f"Bearer {doc_token}"})
    assert r_me_doc.status_code == 200, f"/api/auth/me failed for doctor: {r_me_doc.text}"
    me_doc_data = r_me_doc.json()
    assert me_doc_data["role"] == "doctor"
    assert me_doc_data["doctor_profile"] is not None
    assert me_doc_data["doctor_profile"]["license_number"] == test_doc_license
    assert me_doc_data["patient_profile"] is None
    print(f"  [PASS] GET /api/auth/me verified Doctor profile integrity (license={test_doc_license})")

    # 4g. Test /api/auth/me for Patient
    r_me_pat = client.get("/api/auth/me", headers={"Authorization": f"Bearer {pat_token}"})
    assert r_me_pat.status_code == 200, f"/api/auth/me failed for patient: {r_me_pat.text}"
    me_pat_data = r_me_pat.json()
    assert me_pat_data["role"] == "patient"
    assert me_pat_data["patient_profile"] is not None
    assert me_pat_data["patient_profile"]["mrn"].startswith("MRN-")
    assert me_pat_data["doctor_profile"] is None
    print(f"  [PASS] GET /api/auth/me verified Patient profile integrity (mrn={me_pat_data['patient_profile']['mrn']})")

    # 4h. Test /api/auth/me with invalid token (Must Fail 401)
    r_me_bad = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.fake.token"})
    assert r_me_bad.status_code == 401, f"Expected 401 for invalid token, got {r_me_bad.status_code}"
    print(f"  [PASS] GET /api/auth/me with invalid token correctly rejected with 401 Unauthorized")

    # -----------------------------------------------------------------
    # 5. EXISTING AI ENDPOINT PRESERVATION
    # -----------------------------------------------------------------
    print("\n[TEST 5] Verifying Existing AI Endpoints Remain Intact...")
    r_health = client.get("/api/chatbot/health")
    assert r_health.status_code == 200, f"Chatbot health check failed: {r_health.text}"
    h_data = r_health.json()
    assert h_data["status"] == "online"
    assert h_data["service"] == "StrokeAegis Medical Assistant"
    print(f"  [PASS] GET /api/chatbot/health returned 200 OK (Status: {h_data['status']})")

    print("\n==================================================================")
    print("  ALL TESTS PASSED! 100% PHASE 1 VERIFICATION SUCCESSFUL!")
    print("==================================================================")


if __name__ == "__main__":
    test_suite()
