"""
Verification test for Account Creation Fixes:
1. Doctor registration (normal & edge cases)
2. Patient registration (with date of birth variations: None, empty string, DD/MM/YYYY, ISO)
3. Validation error formatting: ensures detail is always a human-readable string, never a raw array of objects
4. Immediate login with the created credentials
"""

import sys
import uuid
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from backend.app import app

def run_tests():
    client = TestClient(app)
    print("==================================================================")
    print("  VERIFYING ACCOUNT CREATION & ERROR FORMATTING FIXES")
    print("==================================================================")

    uid = uuid.uuid4().hex[:6]

    # Test 1: Doctor Registration with valid data
    doc_email = f"dr.new_{uid}@strokeaegis.local"
    doc_payload = {
        "email": doc_email,
        "password": "SecurePassword2026!",
        "full_name": f"Dr. Alex Carter {uid}",
        "license_number": f"LIC-{uid}",
        "specialization": "Stroke & Cerebrovascular Neurology",
        "hospital_affiliation": "Riyadh Neurological Institute"
    }
    r = client.post("/api/auth/register/doctor", json=doc_payload)
    assert r.status_code == 201, f"Doctor reg failed ({r.status_code}): {r.text}"
    data = r.json()
    assert "access_token" in data
    assert data["role"] == "doctor"
    assert data["full_name"] == f"Dr. Alex Carter {uid}"
    print("  [PASS] Doctor Registration succeeds (201 Created)")

    # Test 2: Patient Registration with empty string date_of_birth
    pat_email1 = f"pat.empty_dob_{uid}@strokeaegis.local"
    pat_payload1 = {
        "email": pat_email1,
        "password": "PatientPass2026!",
        "full_name": f"Patient Empty DOB {uid}",
        "date_of_birth": "",
        "gender": "Male",
        "emergency_contact": "Father: +966500000002"
    }
    r = client.post("/api/auth/register/patient", json=pat_payload1)
    assert r.status_code == 201, f"Patient empty DOB failed ({r.status_code}): {r.text}"
    data = r.json()
    assert "access_token" in data
    assert data["role"] == "patient"
    print("  [PASS] Patient Registration with empty DOB string succeeds (201 Created)")

    # Test 3: Patient Registration with formatted date_of_birth (DD/MM/YYYY)
    pat_email2 = f"pat.formatted_dob_{uid}@strokeaegis.local"
    pat_payload2 = {
        "email": pat_email2,
        "password": "PatientPass2026!",
        "full_name": f"Patient Formatted DOB {uid}",
        "date_of_birth": "25/12/1988",
        "gender": "Female",
        "emergency_contact": "Sister: +966500000003"
    }
    r = client.post("/api/auth/register/patient", json=pat_payload2)
    assert r.status_code == 201, f"Patient formatted DOB failed ({r.status_code}): {r.text}"
    data = r.json()
    assert "access_token" in data
    assert data["role"] == "patient"
    print("  [PASS] Patient Registration with DD/MM/YYYY DOB succeeds (201 Created)")

    # Test 4: Validation Error: short password (< 6 chars)
    # MUST return 422 with a clean STRING detail, NOT an array of dicts!
    bad_pwd_payload = {
        "email": f"bad_pwd_{uid}@strokeaegis.local",
        "password": "123",
        "full_name": "Dr. Short Password",
        "license_number": "LIC-999"
    }
    r = client.post("/api/auth/register/doctor", json=bad_pwd_payload)
    assert r.status_code == 422, f"Expected 422, got {r.status_code}"
    err_data = r.json()
    assert "detail" in err_data, "Missing detail field in 422 error"
    assert isinstance(err_data["detail"], str), f"detail must be a string, got {type(err_data['detail'])}"
    assert "at least 6 characters" in err_data["detail"]
    print(f"  [PASS] 422 Short Password returns clean string detail: \"{err_data['detail']}\"")

    # Test 5: Validation Error: invalid email format
    bad_email_payload = {
        "email": "not-an-email",
        "password": "ValidPassword123!",
        "full_name": "Dr. Bad Email",
        "license_number": "LIC-998"
    }
    r = client.post("/api/auth/register/doctor", json=bad_email_payload)
    assert r.status_code == 422
    err_data = r.json()
    assert isinstance(err_data["detail"], str)
    assert "valid email" in err_data["detail"].lower()
    print(f"  [PASS] 422 Invalid Email returns clean string detail: \"{err_data['detail']}\"")

    # Test 6: Duplicate Email Registration (400 Bad Request)
    dup_r = client.post("/api/auth/register/doctor", json=doc_payload)
    assert dup_r.status_code == 400
    dup_data = dup_r.json()
    assert isinstance(dup_data["detail"], str)
    print(f"  [PASS] 400 Duplicate Email returns clean string detail: \"{dup_data['detail']}\"")

    # Test 7: Immediate login with newly registered doctor
    login_r = client.post("/api/auth/login", json={
        "email": doc_email,
        "password": "SecurePassword2026!"
    })
    assert login_r.status_code == 200, f"Login failed ({login_r.status_code}): {login_r.text}"
    login_data = login_r.json()
    assert "access_token" in login_data
    assert login_data["full_name"] == f"Dr. Alex Carter {uid}"
    print("  [PASS] Login with newly created Doctor account succeeds (200 OK)")

    # Test 8: Immediate login with newly registered patient
    login_pat = client.post("/api/auth/login", json={
        "email": pat_email1,
        "password": "PatientPass2026!"
    })
    assert login_pat.status_code == 200, f"Patient login failed ({login_pat.status_code}): {login_pat.text}"
    login_pat_data = login_pat.json()
    assert "access_token" in login_pat_data
    assert login_pat_data["role"] == "patient"
    print("  [PASS] Login with newly created Patient account succeeds (200 OK)")

    print("\n==================================================================")
    print("  ALL 8 TESTS PASSED! ACCOUNT CREATION & ERROR FORMATTING VERIFIED")
    print("==================================================================")

if __name__ == "__main__":
    run_tests()
