"""
Verify new clinical portal endpoints and patient admission logic
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

def test_endpoints():
    print("\n--- Testing Phase 2 Clinical Endpoints & Multi-Patient Data ---")

    # 1. Login as Dr. Sarah
    doc_login = client.post("/api/auth/login", json={
        "email": "doctor@strokeaegis.local",
        "password": "DoctorSecure2026!"
    })
    assert doc_login.status_code == 200, f"Doctor login failed: {doc_login.text}"
    doc_token = doc_login.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    print("  ✓ Doctor login successful (200 OK)")

    # 2. Get Doctor Patients (should have 4+ patients)
    res_pats = client.get("/api/clinical-portal/doctor/patients", headers=doc_headers)
    assert res_pats.status_code == 200, f"Get patients failed: {res_pats.text}"
    pats = res_pats.json()["patients"]
    print(f"  ✓ Doctor sees {len(pats)} clinical patients in roster.")
    assert len(pats) >= 4, f"Expected at least 4 patients, got {len(pats)}"

    # 3. Doctor admits a new patient directly
    admit_res = client.post("/api/clinical-portal/doctor/patients/admit", headers=doc_headers, json={
        "full_name": "Sultan Al-Olayan",
        "email": "sultan.test@strokeaegis.local",
        "password": "PatientSecure2026!",
        "gender": "Male",
        "emergency_contact": "Nora (+966-50-999-8877)"
    })
    assert admit_res.status_code == 200, f"Admit patient failed: {admit_res.text}"
    admit_data = admit_res.json()
    print(f"  ✓ Doctor admitted new patient: Sultan Al-Olayan (MRN: {admit_data['mrn']})")

    # Verify patient count incremented
    res_pats2 = client.get("/api/clinical-portal/doctor/patients", headers=doc_headers)
    assert len(res_pats2.json()["patients"]) == len(pats) + 1, "Patient count did not increment"
    print(f"  ✓ Doctor roster updated immediately: {len(res_pats2.json()['patients'])} patients.")

    # 4. Login as demo patient Ahmed
    pat_login = client.post("/api/auth/login", json={
        "email": "patient@strokeaegis.local",
        "password": "PatientSecure2026!"
    })
    assert pat_login.status_code == 200, f"Patient login failed: {pat_login.text}"
    pat_token = pat_login.json()["access_token"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}
    print("  ✓ Patient login successful (200 OK)")

    # 5. Get Patient Overview
    pat_over = client.get("/api/clinical-portal/patient/overview", headers=pat_headers)
    assert pat_over.status_code == 200, f"Patient overview failed: {pat_over.text}"
    doc_info = pat_over.json()["doctor"]
    assert doc_info is not None, "Patient has no supervising doctor!"
    assert "Sarah" in doc_info["full_name"], f"Unexpected doctor: {doc_info['full_name']}"
    print(f"  ✓ Patient overview verified: Supervising Neurologist is {doc_info['full_name']}.")

    # 6. Test Notifications Endpoint for Patient
    notif_res = client.get("/api/clinical-portal/notifications", headers=pat_headers)
    assert notif_res.status_code == 200, f"Get notifications failed: {notif_res.text}"
    notifs = notif_res.json()["notifications"]
    print(f"  ✓ Patient has {len(notifs)} notifications in PostgreSQL.")
    assert len(notifs) >= 1, "Expected at least 1 notification"

    # Mark first notification as read
    first_notif_id = notifs[0]["id"]
    mark_res = client.post(f"/api/clinical-portal/notifications/{first_notif_id}/read", headers=pat_headers)
    assert mark_res.status_code == 200, f"Mark read failed: {mark_res.text}"
    print("  ✓ Mark notification as read verified (200 OK).")

    # Mark all as read
    read_all_res = client.post("/api/clinical-portal/notifications/read-all", headers=pat_headers)
    assert read_all_res.status_code == 200
    unread_cnt = client.get("/api/clinical-portal/notifications", headers=pat_headers).json()["unread_count"]
    assert unread_cnt == 0, "Unread count should be 0"
    print("  ✓ Mark all notifications as read verified: 0 unread.")

    print("\nALL CLINICAL ENDPOINT & MULTI-PATIENT TESTS PASSED!")

if __name__ == "__main__":
    test_endpoints()
