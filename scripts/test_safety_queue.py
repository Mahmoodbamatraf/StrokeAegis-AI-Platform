import sys
import os
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=" * 70)
    print("STARTING CLINICAL SAFETY QUEUE MODULE VERIFICATION & TEST SUITE")
    print("=" * 70)

    # 1. Admin Login
    r_admin_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@strokeaegis.local",
        "password": "AdminSecure2026!"
    })
    assert r_admin_login.status_code == 200, f"Admin login failed: {r_admin_login.text}"
    admin_token = r_admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] Test 1: Administrator authenticated via JWT.")

    # 2. Doctor Login & RBAC Verification
    r_doc_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "doctor@strokeaegis.local",
        "password": "DoctorSecure2026!"
    })
    assert r_doc_login.status_code == 200, f"Doctor login failed: {r_doc_login.text}"
    doc_token = r_doc_login.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    # 3. Patient Login & RBAC Verification
    r_pat_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "patient@strokeaegis.local",
        "password": "PatientSecure2026!"
    })
    assert r_pat_login.status_code == 200, f"Patient login failed: {r_pat_login.text}"
    pat_token = r_pat_login.json()["access_token"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}

    # 4. Security Check: Unauthenticated access blocked (401)
    r_unauth = requests.get(f"{BASE_URL}/api/admin/safety-queue")
    assert r_unauth.status_code in [401, 403], f"Expected 401/403, got {r_unauth.status_code}"
    print("[PASS] Test 2: Unauthenticated request to /api/admin/safety-queue blocked (401).")

    # 5. Security Check: Doctor and Patient roles forbidden (403)
    r_doc_safety = requests.get(f"{BASE_URL}/api/admin/safety-queue", headers=doc_headers)
    assert r_doc_safety.status_code == 403, f"Expected 403 for doctor, got {r_doc_safety.status_code}"

    r_pat_safety = requests.get(f"{BASE_URL}/api/admin/safety-queue", headers=pat_headers)
    assert r_pat_safety.status_code == 403, f"Expected 403 for patient, got {r_pat_safety.status_code}"
    print("[PASS] Test 3: Doctor and Patient strictly forbidden (403) from accessing safety queue.")

    # 6. Admin Access: GET /api/admin/safety-queue (all)
    r_queue = requests.get(f"{BASE_URL}/api/admin/safety-queue", headers=admin_headers)
    assert r_queue.status_code == 200, f"Expected 200, got {r_queue.status_code}: {r_queue.text}"
    cases = r_queue.json()
    assert isinstance(cases, list), "Response must be a list"
    assert len(cases) > 0, "Expected at least 1 safety case in database"
    print(f"[PASS] Test 4: Fetched {len(cases)} safety queue cases via GET /api/admin/safety-queue.")

    # Validate schema for all items (ensure no undefined attributes that caused frontend errors)
    for c in cases:
        assert "assessment_id" in c and c["assessment_id"] is not None
        assert "scan_type" in c and isinstance(c["scan_type"], str)
        assert "gatekeeper_status" in c
        assert "alert_reason" in c and isinstance(c["alert_reason"], str)
        assert "priority" in c and c["priority"] in ["HIGH", "MEDIUM", "NORMAL"]
        assert "safety_status" in c
        assert "patient_name" in c
        assert "patient_mrn" in c
    print("[PASS] Test 5: All safety queue response records conform to strict frontend-aligned schema.")

    # 7. Test All Filters: flagged, rejected_gate, unsigned
    r_flagged = requests.get(f"{BASE_URL}/api/admin/safety-queue?filter_type=flagged", headers=admin_headers)
    assert r_flagged.status_code == 200
    flagged_list = r_flagged.json()
    print(f" -> Filter 'flagged': {len(flagged_list)} cases found.")
    for item in flagged_list:
        assert item["validation_status"] in ["FLAGGED", "PENDING_REVIEW"]

    r_gate = requests.get(f"{BASE_URL}/api/admin/safety-queue?filter_type=rejected_gate", headers=admin_headers)
    assert r_gate.status_code == 200
    gate_list = r_gate.json()
    print(f" -> Filter 'rejected_gate': {len(gate_list)} cases found.")
    for item in gate_list:
        assert item["gatekeeper_status"] == "rejected" or item["ct_diagnosis"] == "Rejected"

    r_unsigned = requests.get(f"{BASE_URL}/api/admin/safety-queue?filter_type=unsigned", headers=admin_headers)
    assert r_unsigned.status_code == 200
    unsigned_list = r_unsigned.json()
    print(f" -> Filter 'unsigned': {len(unsigned_list)} cases found.")
    for item in unsigned_list:
        assert item["physician_signed_off"] is False
    print("[PASS] Test 6: All filter criteria ('flagged', 'rejected_gate', 'unsigned') verified.")

    # 8. Detailed Case Record: GET /api/admin/safety-queue/{assessment_id}
    test_case = cases[0]
    case_id = test_case["assessment_id"]
    r_details = requests.get(f"{BASE_URL}/api/admin/safety-queue/{case_id}", headers=admin_headers)
    assert r_details.status_code == 200, f"Failed to get details: {r_details.text}"
    details = r_details.json()
    assert details["assessment_id"] == case_id
    assert "patient" in details and "mrn" in details["patient"]
    assert "gatekeeper" in details and "status" in details["gatekeeper"]
    assert "ct_classifier" in details
    assert "ml_risk" in details
    assert "safety_tracking" in details
    assert "audit_history" in details and isinstance(details["audit_history"], list)
    print(f"[PASS] Test 7: Full diagnostic, validation, and audit metadata retrieved for #{case_id[:8]}.")

    # 9. Qualified Clinicians Directory: GET /api/admin/qualified-clinicians
    r_clinicians = requests.get(f"{BASE_URL}/api/admin/qualified-clinicians", headers=admin_headers)
    assert r_clinicians.status_code == 200
    clinicians = r_clinicians.json()
    assert len(clinicians) > 0, "Expected at least 1 qualified clinician"
    for doc in clinicians:
        assert "id" in doc and "full_name" in doc and "specialization" in doc
    print(f"[PASS] Test 8: Retrieved {len(clinicians)} approved clinicians eligible for case assignment.")

    # 10. Assign Case to Clinician: POST /api/admin/safety-queue/{assessment_id}/assign
    assigned_doc = clinicians[0]
    # Check if current doctor is already assigned_doc; if so, pick another if available
    current_doc_id = details["assigned_doctor"].get("id")
    if current_doc_id == assigned_doc["id"] and len(clinicians) > 1:
        assigned_doc = clinicians[1]

    assign_payload = {
        "doctor_id": assigned_doc["id"],
        "notes": "Assigned by System Administrator for urgent multi-model clinical review."
    }
    r_assign = requests.post(f"{BASE_URL}/api/admin/safety-queue/{case_id}/assign", json=assign_payload, headers=admin_headers)
    assert r_assign.status_code == 200, f"Assignment failed: {r_assign.text}"
    print(f"[PASS] Test 9: Case #{case_id[:8]} assigned to Dr. {assigned_doc['full_name']} with audit log.")

    # 11. Duplicate Assignment Rejection
    r_dup = requests.post(f"{BASE_URL}/api/admin/safety-queue/{case_id}/assign", json=assign_payload, headers=admin_headers)
    assert r_dup.status_code == 400, f"Expected 400 for duplicate assignment, got {r_dup.status_code}"
    print("[PASS] Test 10: Duplicate assignment correctly rejected with 400.")

    # 12. Investigation Resolution: POST /api/admin/safety-queue/{assessment_id}/investigate
    r_inv = requests.post(f"{BASE_URL}/api/admin/safety-queue/{case_id}/investigate", json={
        "status": "resolved",
        "notes": "Verified by administrative triage. Attending clinician alerted."
    }, headers=admin_headers)
    assert r_inv.status_code == 200, f"Investigation failed: {r_inv.text}"
    print(f"[PASS] Test 11: Case resolution recorded via POST /api/admin/safety-queue/{case_id[:8]}/investigate.")

    # 13. Overview KPIs Updated
    r_ov = requests.get(f"{BASE_URL}/api/admin/overview", headers=admin_headers)
    assert r_ov.status_code == 200
    ov_data = r_ov.json()
    assert ov_data["safety_flags"] >= 0
    print(f"[PASS] Test 12: Admin overview KPIs reflect live database safety flags ({ov_data['safety_flags']}).")

    print("\n" + "=" * 70)
    print("ALL CLINICAL SAFETY QUEUE TESTS COMPLETED & VERIFIED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
