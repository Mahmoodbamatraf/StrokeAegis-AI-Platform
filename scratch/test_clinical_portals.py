"""
Automated Test Suite for StrokeAegis AI Phase 2:
Doctor Portal, Patient Portal, 1-to-1 Messaging, and Electronic Report Sign-Off
"""

import sys
from pathlib import Path
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Ensure dummy keys for test imports if needed
import os
if not os.environ.get("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = "dummy-key-for-testing"
if not os.environ.get("STROKE_AEGIS_CHATBOT_API_KEY"):
    os.environ["STROKE_AEGIS_CHATBOT_API_KEY"] = "dummy-key-for-testing"

from backend.app import app

client = TestClient(app)

def run_tests():
    print("\n========================================================")
    print("STARTING PHASE 2 CLINICAL PORTAL AUTOMATED TESTS")
    print("========================================================")

    # 1. Login as Doctor
    print("\n[TEST 1] Logging in as Demo Doctor (Dr. Sarah Al-Mansoor)...")
    res = client.post("/api/auth/login", json={
        "email": "doctor@strokeaegis.local",
        "password": "DoctorSecure2026!"
    })
    assert res.status_code == 200, f"Doctor login failed: {res.text}"
    doc_token = res.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    print("  ✓ Doctor login successful. Token acquired.")

    # 2. Doctor Stats
    print("\n[TEST 2] Fetching Doctor Workspace Stats...")
    res = client.get("/api/clinical-portal/doctor/stats", headers=doc_headers)
    assert res.status_code == 200, f"Doctor stats failed: {res.text}"
    stats = res.json()
    print(f"  ✓ Doctor stats: {stats['doctor_name']} | Patients: {stats['total_patients']} | Pending Reports: {stats['pending_reports']}")
    assert stats["total_patients"] >= 1

    # 3. Doctor Patients Directory
    print("\n[TEST 3] Fetching Doctor's Patient Directory...")
    res = client.get("/api/clinical-portal/doctor/patients", headers=doc_headers)
    assert res.status_code == 200, f"Doctor patients failed: {res.text}"
    patients = res.json()["patients"]
    assert len(patients) >= 1, "Expected at least 1 associated patient"
    ahmed = patients[0]
    ahmed_id = ahmed["id"]
    print(f"  ✓ Found patient: {ahmed['full_name']} (MRN: {ahmed['mrn']}, Status: {ahmed['status']})")
    assert "Ahmed" in ahmed["full_name"]

    # 4. Patient Clinical History
    print(f"\n[TEST 4] Fetching longitudinal history for Ahmed ({ahmed_id})...")
    res = client.get(f"/api/clinical-portal/doctor/patients/{ahmed_id}/history", headers=doc_headers)
    assert res.status_code == 200, f"History fetch failed: {res.text}"
    history = res.json()
    print(f"  ✓ Retrieved {len(history['assessments'])} assessments and {len(history['reports'])} reports.")
    assert len(history["assessments"]) >= 1

    # 5. Doctor Reports & Electronic Sign-off
    print("\n[TEST 5] Fetching Doctor Reports and testing Electronic Sign-off...")
    res = client.get("/api/clinical-portal/doctor/reports", headers=doc_headers)
    assert res.status_code == 200, f"Reports fetch failed: {res.text}"
    reports = res.json()["reports"]
    assert len(reports) >= 1, "Expected at least 1 report"
    report_to_sign = reports[0]
    report_id = report_to_sign["id"]
    print(f"  ✓ Target report: {report_id} ({report_to_sign['pdf_filename']}) - Signed: {report_to_sign['physician_signed_off']}")

    # Perform Sign-Off
    res = client.post(f"/api/clinical-portal/doctor/reports/{report_id}/sign-off", headers=doc_headers)
    assert res.status_code == 200, f"Sign-off failed: {res.text}"
    sign_result = res.json()
    assert sign_result["physician_signed_off"] is True
    print(f"  ✓ Sign-off succeeded: Signed by {sign_result['signed_by']} at {sign_result['signed_at']}")

    # 6. Login as Patient
    print("\n[TEST 6] Logging in as Demo Patient (Ahmed Al-Harthi)...")
    res = client.post("/api/auth/login", json={
        "email": "patient@strokeaegis.local",
        "password": "PatientSecure2026!"
    })
    assert res.status_code == 200, f"Patient login failed: {res.text}"
    pat_token = res.json()["access_token"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}
    print("  ✓ Patient login successful. Token acquired.")

    # 7. Patient Overview
    print("\n[TEST 7] Fetching Patient Portal Overview...")
    res = client.get("/api/clinical-portal/patient/overview", headers=pat_headers)
    assert res.status_code == 200, f"Patient overview failed: {res.text}"
    overview = res.json()
    print(f"  ✓ Patient: {overview['patient']['full_name']} | MRN: {overview['patient']['mrn']}")
    assert overview["doctor"] is not None
    print(f"  ✓ Supervising Doctor: {overview['doctor']['full_name']} ({overview['doctor']['specialization']})")

    # 8. Patient Assessments & Reports
    print("\n[TEST 8] Fetching Patient Personal Assessments & Reports...")
    res = client.get("/api/clinical-portal/patient/assessments", headers=pat_headers)
    assert res.status_code == 200, f"Patient assessments failed: {res.text}"
    pat_assessments = res.json()["assessments"]
    assert len(pat_assessments) >= 1
    print(f"  ✓ Patient has {len(pat_assessments)} historical assessments.")

    res = client.get("/api/clinical-portal/patient/reports", headers=pat_headers)
    assert res.status_code == 200, f"Patient reports failed: {res.text}"
    pat_reports = res.json()["reports"]
    assert len(pat_reports) >= 1
    print(f"  ✓ Patient has {len(pat_reports)} certified/clinical reports.")
    signed_rep = [r for r in pat_reports if r["id"] == report_id][0]
    assert signed_rep["physician_signed_off"] is True, "Report should reflect doctor sign-off!"
    print(f"  ✓ Confirmed report {report_id} is marked as signed off in Patient view!")

    # 9. Patient Download Report (IDOR protected)
    print(f"\n[TEST 9] Downloading PDF report ({report_id}) as Patient...")
    res = client.get(f"/api/clinical-portal/reports/{report_id}/download", headers=pat_headers)
    assert res.status_code == 200, f"Download failed: {res.status_code} - {res.text}"
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 1000
    print(f"  ✓ Successfully downloaded {len(res.content)} bytes of official PDF.")

    # 10. 1-to-1 Messaging Test
    print("\n[TEST 10] Testing 1-to-1 Messaging between Patient and Doctor...")
    res = client.get("/api/clinical-portal/conversations", headers=pat_headers)
    assert res.status_code == 200, f"Conversations fetch failed: {res.text}"
    convos = res.json()["conversations"]
    assert len(convos) >= 1, "Expected at least 1 active conversation"
    convo_id = convos[0]["id"]
    print(f"  ✓ Found conversation thread: {convo_id} with {convos[0]['counterparty']['full_name']}")

    # Patient sends message to Doctor
    res = client.post(f"/api/clinical-portal/conversations/{convo_id}/messages", headers=pat_headers, json={
        "content": "Good day Dr. Sarah, I noticed my blood pressure was slightly higher today (145/90). Should I adjust medication?"
    })
    assert res.status_code == 200, f"Send message failed: {res.text}"
    print("  ✓ Patient sent consultation inquiry message.")

    # Doctor reads messages
    res = client.get(f"/api/clinical-portal/conversations/{convo_id}/messages", headers=doc_headers)
    assert res.status_code == 200, f"Doctor get messages failed: {res.text}"
    doc_msgs = res.json()["messages"]
    last_msg = doc_msgs[-1]
    assert "blood pressure" in last_msg["content"]
    print(f"  ✓ Doctor received message: '{last_msg['content']}' (is_mine: {last_msg['is_mine']})")

    # Doctor replies to Patient
    res = client.post(f"/api/clinical-portal/conversations/{convo_id}/messages", headers=doc_headers, json={
        "content": "Hello Ahmed, please log readings morning and evening for 3 days. I have reviewed your latest CT report; it remains stable."
    })
    assert res.status_code == 200, f"Doctor reply failed: {res.text}"
    print("  ✓ Doctor replied successfully.")

    # 11. Security & RBAC Guards Test
    print("\n[TEST 11] Testing Security & Role Guards...")
    # Patient attempting doctor sign-off -> 403 Forbidden
    res = client.post(f"/api/clinical-portal/doctor/reports/{report_id}/sign-off", headers=pat_headers)
    assert res.status_code == 403, f"Expected 403 for patient sign-off attempt, got {res.status_code}"
    print("  ✓ Patient blocked from doctor sign-off (403 Forbidden).")

    # Patient attempting doctor stats -> 403 Forbidden
    res = client.get("/api/clinical-portal/doctor/stats", headers=pat_headers)
    assert res.status_code == 403, f"Expected 403 for patient accessing doctor stats, got {res.status_code}"
    print("  ✓ Patient blocked from doctor stats (403 Forbidden).")

    print("\n========================================================")
    print("ALL 11 CLINICAL PORTAL AUTOMATED TESTS PASSED WITH 100% SUCCESS!")
    print("========================================================\n")

if __name__ == "__main__":
    run_tests()
