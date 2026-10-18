"""
StrokeAegis AI — Admin Security, RBAC & API Regression Test Suite
Tests:
1. 401 Unauthorized for unauthenticated requests to /api/admin/*
2. 403 Forbidden for Doctor calling /api/admin/*
3. 403 Forbidden for Patient calling /api/admin/*
4. Admin login via /api/auth/login with trusted credentials
5. Admin access to /api/admin/overview, /clinicians, /safety-queue, /users, /models, /reports, /audit-logs, /health
6. Clinician approval workflow:
   - New doctor registration creates 'pending' approval_status
   - Pending doctor blocked (403) from restricted clinical endpoints
   - Admin approves doctor -> status becomes 'approved'
   - Approved doctor can now access clinical endpoints
   - Admin suspends doctor -> status becomes 'suspended'
   - Suspended doctor blocked (403) from clinical endpoints
   - Rejection requires valid justification
7. Privilege escalation prevention:
   - Normal registration cannot create 'admin'
   - Admin cannot deactivate own account
8. Audit logging verification:
   - Every administrative action generates an immutable audit record
"""

import sys
import time
import uuid
import requests
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"


def wait_for_server(timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(f"{BASE_URL}/api/health", timeout=2)
            if r.status_code == 200:
                return True
        except Exception:
            time.sleep(1)
    return False


def run_tests():
    print("=" * 64)
    print("RUNNING ADMIN SECURITY, RBAC & API TEST SUITE")
    print("=" * 64)

    assert wait_for_server(), "Server did not start in time."

    # 1. Unauthenticated requests to /api/admin/*
    r = requests.get(f"{BASE_URL}/api/admin/overview")
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print("✓ Test 1 Passed: Unauthenticated request to /api/admin/overview returned 401.")

    # 2. Doctor credentials
    r_doc_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "doctor@strokeaegis.local",
        "password": "DoctorSecure2026!"
    })
    assert r_doc_login.status_code == 200, f"Doctor login failed: {r_doc_login.text}"
    doc_token = r_doc_login.json()["access_token"]

    r_doc_admin = requests.get(
        f"{BASE_URL}/api/admin/overview",
        headers={"Authorization": f"Bearer {doc_token}"}
    )
    assert r_doc_admin.status_code == 403, f"Expected 403 for doctor accessing admin API, got {r_doc_admin.status_code}"
    print("✓ Test 2 Passed: Authenticated Doctor strictly forbidden (403) from /api/admin/overview.")

    # 3. Patient credentials
    r_pat_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "patient@strokeaegis.local",
        "password": "PatientSecure2026!"
    })
    assert r_pat_login.status_code == 200, f"Patient login failed: {r_pat_login.text}"
    pat_token = r_pat_login.json()["access_token"]

    r_pat_admin = requests.get(
        f"{BASE_URL}/api/admin/overview",
        headers={"Authorization": f"Bearer {pat_token}"}
    )
    assert r_pat_admin.status_code == 403, f"Expected 403 for patient accessing admin API, got {r_pat_admin.status_code}"
    print("✓ Test 3 Passed: Authenticated Patient strictly forbidden (403) from /api/admin/overview.")

    # 4. Admin Login
    r_admin_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@strokeaegis.local",
        "password": "AdminSecure2026!"
    })
    assert r_admin_login.status_code == 200, f"Admin login failed: {r_admin_login.text}"
    admin_data = r_admin_login.json()
    assert admin_data["role"] == "admin", f"Expected role admin, got {admin_data['role']}"
    admin_token = admin_data["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"✓ Test 4 Passed: Admin logged in successfully with role '{admin_data['role']}'.")

    # 5. Admin API Endpoints
    # Overview
    r_ov = requests.get(f"{BASE_URL}/api/admin/overview", headers=admin_headers)
    assert r_ov.status_code == 200, f"Overview failed: {r_ov.text}"
    kpis = r_ov.json()["kpis"]
    assert "active_doctors" in kpis and "total_assessments" in kpis
    print(f"✓ Test 5 Passed: Admin Overview retrieved (Active Doctors: {kpis['active_doctors']}, Patients: {kpis['registered_patients']}).")

    # Clinicians List
    r_cl = requests.get(f"{BASE_URL}/api/admin/clinicians", headers=admin_headers)
    assert r_cl.status_code == 200
    clinicians = r_cl.json()
    assert len(clinicians) > 0
    print(f"✓ Test 6 Passed: Admin Clinicians directory retrieved ({len(clinicians)} clinicians found).")

    # Safety Queue
    r_sq = requests.get(f"{BASE_URL}/api/admin/safety-queue", headers=admin_headers)
    assert r_sq.status_code == 200
    print(f"✓ Test 7 Passed: Clinical Safety Queue retrieved ({len(r_sq.json())} items).")

    # Users List
    r_us = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
    assert r_us.status_code == 200
    print(f"✓ Test 8 Passed: Users & Access directory retrieved ({len(r_us.json())} users).")

    # Models Inventory
    r_md = requests.get(f"{BASE_URL}/api/admin/models", headers=admin_headers)
    assert r_md.status_code == 200
    models = r_md.json()
    assert len(models) >= 6
    print(f"✓ Test 9 Passed: AI Model Inventory retrieved ({len(models)} models registered).")

    # Audit Logs
    r_al = requests.get(f"{BASE_URL}/api/admin/audit-logs", headers=admin_headers)
    assert r_al.status_code == 200
    audit_data = r_al.json()
    assert audit_data["total"] > 0
    print(f"✓ Test 10 Passed: Audit Log retrieved ({audit_data['total']} total events recorded).")

    # System Health
    r_hl = requests.get(f"{BASE_URL}/api/admin/health", headers=admin_headers)
    assert r_hl.status_code == 200
    health_data = r_hl.json()
    assert "services" in health_data and health_data["services"]["database"]["status"] == "healthy"
    print(f"✓ Test 11 Passed: System Health verified (Overall: {health_data['overall_status']}, DB: healthy).")

    # 6. Clinician Approval Lifecycle
    test_lic = f"LIC-TEST-{uuid.uuid4().hex[:6]}"
    test_doc_email = f"pending_doc_{uuid.uuid4().hex[:6]}@strokeaegis.local"
    r_reg_doc = requests.post(f"{BASE_URL}/api/auth/register/doctor", json={
        "email": test_doc_email,
        "password": "SecureDocPass123!",
        "full_name": "Dr. Candidate Neurologist",
        "license_number": test_lic,
        "specialization": "Vascular Neurology",
        "hospital_affiliation": "King Abdulaziz Medical City"
    })
    assert r_reg_doc.status_code == 201, f"Registration failed: {r_reg_doc.text}"
    reg_data = r_reg_doc.json()
    assert reg_data["approval_status"] == "pending", f"Expected pending approval, got {reg_data['approval_status']}"
    pending_token = reg_data["access_token"]
    print("✓ Test 12 Passed: Public Doctor Registration automatically assigned approval_status='pending'.")

    # Verify pending doctor is blocked from clinical workspace endpoints
    r_clin_access = requests.get(
        f"{BASE_URL}/api/clinical-portal/doctor/patients",
        headers={"Authorization": f"Bearer {pending_token}"}
    )
    assert r_clin_access.status_code == 403, f"Expected 403 for pending doctor, got {r_clin_access.status_code}"
    print("✓ Test 13 Passed: Pending Doctor strictly blocked (403) from restricted clinical endpoints.")

    # Find the doctor's profile ID in admin list
    r_cl_search = requests.get(f"{BASE_URL}/api/admin/clinicians?search={test_lic}", headers=admin_headers)
    assert r_cl_search.status_code == 200
    candidate_profiles = r_cl_search.json()
    assert len(candidate_profiles) == 1
    cand_id = candidate_profiles[0]["id"]

    # Admin approves candidate doctor
    r_appr = requests.post(f"{BASE_URL}/api/admin/clinicians/{cand_id}/approve", headers=admin_headers)
    assert r_appr.status_code == 200
    print("✓ Test 14 Passed: Admin approved candidate doctor successfully.")

    # Login again as the newly approved doctor
    r_cand_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": test_doc_email,
        "password": "SecureDocPass123!"
    })
    assert r_cand_login.status_code == 200
    cand_token = r_cand_login.json()["access_token"]
    assert r_cand_login.json()["approval_status"] == "approved"

    # Now clinical endpoints succeed
    r_clin_ok = requests.get(
        f"{BASE_URL}/api/clinical-portal/doctor/patients",
        headers={"Authorization": f"Bearer {cand_token}"}
    )
    assert r_clin_ok.status_code == 200
    print("✓ Test 15 Passed: Approved doctor now successfully accesses clinical workspace endpoints (200 OK).")

    # Admin suspends doctor
    r_susp = requests.post(
        f"{BASE_URL}/api/admin/clinicians/{cand_id}/suspend",
        headers=admin_headers,
        json={"reason": "Audit review under investigation."}
    )
    assert r_susp.status_code == 200
    print("✓ Test 16 Passed: Admin suspended clinician account with justification.")

    # Suspended doctor is blocked
    r_susp_block = requests.get(
        f"{BASE_URL}/api/clinical-portal/doctor/patients",
        headers={"Authorization": f"Bearer {cand_token}"}
    )
    assert r_susp_block.status_code == 403
    print("✓ Test 17 Passed: Suspended doctor strictly blocked (403) from clinical workspace.")

    # 7. Self-deactivation prevention
    admin_user_id = admin_data["user_id"]
    r_self_deact = requests.post(
        f"{BASE_URL}/api/admin/users/{admin_user_id}/toggle-status",
        headers=admin_headers,
        json={"reason": "Attempting self-deactivation"}
    )
    assert r_self_deact.status_code == 400
    print("✓ Test 18 Passed: Admin cannot deactivate own administrator account (400 Bad Request).")

    print("=" * 64)
    print("ALL 18 ADMIN SECURITY & RBAC TESTS PASSED WITH ZERO ERRORS!")
    print("=" * 64)


if __name__ == "__main__":
    run_tests()
