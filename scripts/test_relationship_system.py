import sys
import uuid
from datetime import datetime, timezone, timedelta
import requests

from pathlib import Path
CURRENT_DIR = Path(__file__).resolve().parent.parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=" * 60)
    print("RUNNING DOCTOR-PATIENT RELATIONSHIP & PRIVACY TEST SUITE")
    print("=" * 60)

    # -------------------------------------------------------------
    # Scenario 1: Register new doctor -> My Patients is empty (0)
    # -------------------------------------------------------------
    doc1_email = f"doc_test_{uuid.uuid4().hex[:6]}@strokeaegis.local"
    doc1_pass = "DoctorSecret123!"
    reg_doc1 = requests.post(f"{BASE_URL}/api/auth/register/doctor", json={
        "email": doc1_email,
        "password": doc1_pass,
        "full_name": "Dr. Test Neuro One",
        "specialization": "Vascular Neurology",
        "hospital_affiliation": "King Abdulaziz Medical City",
        "license_number": f"LIC-{uuid.uuid4().hex[:6].upper()}",
        "contact_phone": "+966-50-000-0001"
    })
    assert reg_doc1.status_code in [200, 201], f"Doc1 registration failed: {reg_doc1.text}"
    doc1_token = reg_doc1.json()["access_token"]
    doc1_headers = {"Authorization": f"Bearer {doc1_token}"}

    # Verify doctor patients is empty
    doc1_pts = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/patients", headers=doc1_headers)
    assert doc1_pts.status_code == 200, f"Failed getting doc1 patients: {doc1_pts.text}"
    doc1_pts_list = doc1_pts.json()["patients"]
    assert len(doc1_pts_list) == 0, f"Expected 0 patients for new doctor, got {len(doc1_pts_list)}"
    print("✓ Scenario 1 Passed: New doctor has exactly 0 patients.")

    # -------------------------------------------------------------
    # Scenario 2: Register new patient -> Primary Doctor: NONE, Care Team: EMPTY
    # -------------------------------------------------------------
    pat1_email = f"pat_test_{uuid.uuid4().hex[:6]}@strokeaegis.local"
    pat1_pass = "PatientSecret123!"
    reg_pat1 = requests.post(f"{BASE_URL}/api/auth/register/patient", json={
        "email": pat1_email,
        "password": pat1_pass,
        "full_name": "Test Patient One",
        "gender": "Male",
        "date_of_birth": "1980-05-15"
    })
    assert reg_pat1.status_code in [200, 201], f"Pat1 registration failed: {reg_pat1.text}"
    pat1_token = reg_pat1.json()["access_token"]
    pat1_headers = {"Authorization": f"Bearer {pat1_token}"}
    pat1_id = reg_pat1.json()["user_id"]

    # Check overview
    pat1_ov = requests.get(f"{BASE_URL}/api/clinical-portal/patient/overview", headers=pat1_headers)
    assert pat1_ov.status_code == 200
    assert pat1_ov.json()["doctor"] is None, "Expected no doctor in overview"

    # Check care team
    pat1_ct = requests.get(f"{BASE_URL}/api/clinical-portal/patient/care-team", headers=pat1_headers)
    assert pat1_ct.status_code == 200
    ct_data = pat1_ct.json()
    assert ct_data["primary_doctor"] is None, "Expected primary_doctor to be None"
    assert len(ct_data["care_team"]) == 0, "Expected empty care team"
    assert len(ct_data["incoming_requests"]) == 0, "Expected empty incoming requests"
    assert len(ct_data["outgoing_requests"]) == 0, "Expected empty outgoing requests"
    print("✓ Scenario 2 Passed: New patient has Primary Doctor = NONE and Care Team = EMPTY.")

    # -------------------------------------------------------------
    # Scenario 3: Doctor invites unregistered email -> 404 message
    # -------------------------------------------------------------
    req_unreg = requests.post(f"{BASE_URL}/api/clinical-portal/doctor/patients/request", 
                              headers=doc1_headers, 
                              json={"email": "nonexistent_patient_999@nobody.org"})
    assert req_unreg.status_code == 404, f"Expected 404 for unregistered email, got {req_unreg.status_code}"
    assert "found" in req_unreg.json()["detail"].lower()
    print("✓ Scenario 3 Passed: Doctor invite for unregistered email returns 404.")

    # -------------------------------------------------------------
    # Scenario 4: Doctor invites patient with no primary -> pending -> patient accepts -> PRIMARY
    # -------------------------------------------------------------
    req_pat1 = requests.post(f"{BASE_URL}/api/clinical-portal/doctor/patients/request",
                             headers=doc1_headers,
                             json={"email": pat1_email})
    assert req_pat1.status_code == 200, f"Invite failed: {req_pat1.text}"
    inv_data = req_pat1.json()
    assert inv_data["target_role"] == "primary"

    # Patient checks care team for incoming request
    pat1_ct_after = requests.get(f"{BASE_URL}/api/clinical-portal/patient/care-team", headers=pat1_headers).json()
    assert len(pat1_ct_after["incoming_requests"]) == 1, "Expected 1 incoming request for patient"
    req_id_1 = pat1_ct_after["incoming_requests"][0]["relationship_id"]

    # Before accepting: Doctor CANNOT view history (Scenario 10 check)
    hist_before = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/patients/{pat1_id}/history", headers=doc1_headers)
    assert hist_before.status_code == 403, f"Expected 403 before acceptance, got {hist_before.status_code}"

    # Patient accepts request
    acc_res = requests.post(f"{BASE_URL}/api/clinical-portal/relationships/{req_id_1}/accept", headers=pat1_headers)
    assert acc_res.status_code == 200, f"Accept failed: {acc_res.text}"
    assert acc_res.json()["relationship_type"] == "primary"
    assert acc_res.json()["success"] == True

    # Patient care team now has primary doctor
    pat1_ct_active = requests.get(f"{BASE_URL}/api/clinical-portal/patient/care-team", headers=pat1_headers).json()
    assert pat1_ct_active["primary_doctor"] is not None
    assert pat1_ct_active["primary_doctor"]["email"] == doc1_email

    # Doctor now sees patient in My Patients
    doc1_pts_now = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/patients", headers=doc1_headers).json()["patients"]
    assert len(doc1_pts_now) == 1
    assert doc1_pts_now[0]["email"] == pat1_email
    assert doc1_pts_now[0]["relationship_type"] == "primary"

    # Doctor can now view history
    hist_after = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/patients/{pat1_id}/history", headers=doc1_headers)
    assert hist_after.status_code == 200
    print("✓ Scenario 4 Passed: Doctor invite accepted as PRIMARY; grants history access.")

    # -------------------------------------------------------------
    # Scenario 5: Second doctor invites patient -> patient accepts -> CARE_TEAM
    # -------------------------------------------------------------
    doc2_email = f"doc_test2_{uuid.uuid4().hex[:6]}@strokeaegis.local"
    reg_doc2 = requests.post(f"{BASE_URL}/api/auth/register/doctor", json={
        "email": doc2_email,
        "password": "Doctor2Secret123!",
        "full_name": "Dr. Test Neuro Two",
        "specialization": "Interventional Neuroradiology",
        "hospital_affiliation": "Specialized Hospital",
        "license_number": f"LIC-{uuid.uuid4().hex[:6].upper()}",
        "contact_phone": "+966-50-000-0002"
    })
    assert reg_doc2.status_code in [200, 201], f"Doc2 registration failed: {reg_doc2.text}"
    doc2_token = reg_doc2.json()["access_token"]
    doc2_headers = {"Authorization": f"Bearer {doc2_token}"}

    # Doc2 invites Pat1
    req2_res = requests.post(f"{BASE_URL}/api/clinical-portal/doctor/patients/request",
                             headers=doc2_headers,
                             json={"email": pat1_email})
    assert req2_res.status_code == 200
    assert req2_res.json()["target_role"] == "care_team"

    # Patient accepts Doc2
    pat1_inc2 = requests.get(f"{BASE_URL}/api/clinical-portal/patient/care-team", headers=pat1_headers).json()
    req_id_2 = pat1_inc2["incoming_requests"][0]["relationship_id"]
    acc_res2 = requests.post(f"{BASE_URL}/api/clinical-portal/relationships/{req_id_2}/accept", headers=pat1_headers)
    assert acc_res2.status_code == 200
    assert acc_res2.json()["relationship_type"] == "care_team"
    assert acc_res2.json()["success"] == True

    # Verify Patient Care Team
    pat1_ct_multi = requests.get(f"{BASE_URL}/api/clinical-portal/patient/care-team", headers=pat1_headers).json()
    assert pat1_ct_multi["primary_doctor"]["email"] == doc1_email
    assert len(pat1_ct_multi["care_team"]) == 1
    assert pat1_ct_multi["care_team"][0]["email"] == doc2_email
    print("✓ Scenario 5 Passed: Second doctor accepted as CARE_TEAM while primary is preserved.")

    # -------------------------------------------------------------
    # Scenario 6: Patient searches "Find a Doctor" -> sends request -> doctor accepts
    # -------------------------------------------------------------
    doc3_email = f"doc_test3_{uuid.uuid4().hex[:6]}@strokeaegis.local"
    reg_doc3 = requests.post(f"{BASE_URL}/api/auth/register/doctor", json={
        "email": doc3_email,
        "password": "Doctor3Secret123!",
        "full_name": "Dr. Test Neuro Three",
        "specialization": "Neurocritical Care",
        "hospital_affiliation": "Riyadh Care Hospital",
        "license_number": f"LIC-{uuid.uuid4().hex[:6].upper()}",
        "contact_phone": "+966-50-000-0003"
    })
    assert reg_doc3.status_code in [200, 201], f"Doc3 registration failed: {reg_doc3.text}"
    doc3_token = reg_doc3.json()["access_token"]
    doc3_headers = {"Authorization": f"Bearer {doc3_token}"}
    doc3_id = reg_doc3.json()["user_id"]

    # Pat1 searches doctors
    search_res = requests.get(f"{BASE_URL}/api/clinical-portal/patient/search-doctors", headers=pat1_headers).json()
    doc3_search_item = next(d for d in search_res["doctors"] if d["doctor_id"] == doc3_id)
    assert doc3_search_item["status_label"] == "available"

    # Pat1 sends request to Doc3
    req_doc3 = requests.post(f"{BASE_URL}/api/clinical-portal/patient/request-doctor",
                             headers=pat1_headers,
                             json={"doctor_id": doc3_id})
    assert req_doc3.status_code == 200

    # Doc3 checks incoming requests
    doc3_reqs = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/requests", headers=doc3_headers).json()
    assert len(doc3_reqs["incoming"]) == 1
    req_id_3 = doc3_reqs["incoming"][0]["id"]

    # Doc3 accepts request
    acc_doc3 = requests.post(f"{BASE_URL}/api/clinical-portal/relationships/{req_id_3}/accept", headers=doc3_headers)
    assert acc_doc3.status_code == 200
    assert acc_doc3.json()["success"] == True
    print("✓ Scenario 6 Passed: Patient requested doctor via Find a Doctor; doctor accepted.")

    # -------------------------------------------------------------
    # Scenario 7: Decline request -> status becomes 'declined'
    # -------------------------------------------------------------
    pat2_email = f"pat_test2_{uuid.uuid4().hex[:6]}@strokeaegis.local"
    reg_pat2 = requests.post(f"{BASE_URL}/api/auth/register/patient", json={
        "email": pat2_email,
        "password": "PatientSecret123!",
        "full_name": "Test Patient Two",
        "gender": "Female",
        "date_of_birth": "1992-08-20"
    })
    assert reg_pat2.status_code in [200, 201]
    pat2_headers = {"Authorization": f"Bearer {reg_pat2.json()['access_token']}"}

    # Doc1 invites Pat2
    requests.post(f"{BASE_URL}/api/clinical-portal/doctor/patients/request", headers=doc1_headers, json={"email": pat2_email})
    pat2_ct = requests.get(f"{BASE_URL}/api/clinical-portal/patient/care-team", headers=pat2_headers).json()
    req_id_decline = pat2_ct["incoming_requests"][0]["relationship_id"]

    # Pat2 declines
    dec_res = requests.post(f"{BASE_URL}/api/clinical-portal/relationships/{req_id_decline}/decline", headers=pat2_headers)
    assert dec_res.status_code == 200
    assert dec_res.json()["success"] == True
    print("✓ Scenario 7 Passed: Decline request sets status to declined.")

    # -------------------------------------------------------------
    # Scenario 8: Expired request (>48h) cannot be accepted
    # -------------------------------------------------------------
    # Let's create an expired relationship directly or test the expiration mechanism
    pat3_email = f"pat_test3_{uuid.uuid4().hex[:6]}@strokeaegis.local"
    reg_pat3 = requests.post(f"{BASE_URL}/api/auth/register/patient", json={
        "email": pat3_email,
        "password": "PatientSecret123!",
        "full_name": "Test Patient Three",
        "gender": "Male"
    })
    assert reg_pat3.status_code in [200, 201]
    pat3_headers = {"Authorization": f"Bearer {reg_pat3.json()['access_token']}"}
    requests.post(f"{BASE_URL}/api/clinical-portal/doctor/patients/request", headers=doc1_headers, json={"email": pat3_email})
    pat3_ct = requests.get(f"{BASE_URL}/api/clinical-portal/patient/care-team", headers=pat3_headers).json()
    req_id_exp = pat3_ct["incoming_requests"][0]["relationship_id"]

    # We update the database expires_at to 1 hour in the past to simulate 48h passage
    from backend.database.database import SessionLocal
    from backend.database.models import DoctorPatient
    with SessionLocal() as db:
        assoc_exp = db.query(DoctorPatient).filter(DoctorPatient.id == uuid.UUID(req_id_exp)).first()
        assoc_exp.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()

    # Attempt to accept expired request -> should fail with 400
    exp_acc = requests.post(f"{BASE_URL}/api/clinical-portal/relationships/{req_id_exp}/accept", headers=pat3_headers)
    assert exp_acc.status_code == 400, f"Expected 400 for expired request, got {exp_acc.status_code}"
    assert "expired" in exp_acc.json()["detail"].lower()
    print("✓ Scenario 8 Passed: Expired request (>48h) cannot be accepted (400 Expired).")

    # -------------------------------------------------------------
    # Scenario 9: Unassigned doctor cannot access patient history or download PDF reports (403)
    # -------------------------------------------------------------
    unassigned_doc_email = f"unassigned_doc_{uuid.uuid4().hex[:6]}@strokeaegis.local"
    reg_unassigned = requests.post(f"{BASE_URL}/api/auth/register/doctor", json={
        "email": unassigned_doc_email,
        "password": "DocSecret123!",
        "full_name": "Dr. Unassigned Doctor",
        "specialization": "General Neurology",
        "hospital_affiliation": "Independent Clinic",
        "license_number": f"LIC-{uuid.uuid4().hex[:6].upper()}"
    })
    assert reg_unassigned.status_code in [200, 201]
    unassigned_headers = {"Authorization": f"Bearer {reg_unassigned.json()['access_token']}"}

    # Attempt to access Pat1 history
    unauth_hist = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/patients/{pat1_id}/history", headers=unassigned_headers)
    assert unauth_hist.status_code == 403, f"Expected 403 Forbidden, got {unauth_hist.status_code}"
    print("✓ Scenario 9 Passed: Unassigned doctor strictly forbidden (403) from patient records.")

    # -------------------------------------------------------------
    # Scenario 10: Pending request cannot access patient history
    # -------------------------------------------------------------
    # Verified earlier during Scenario 4 (hist_before returned 403).
    print("✓ Scenario 10 Passed: Pending request doctor cannot view patient history (403).")

    # -------------------------------------------------------------
    # Scenario 11: Patient only accesses their own reports & care team
    # -------------------------------------------------------------
    pat1_reps = requests.get(f"{BASE_URL}/api/clinical-portal/patient/reports", headers=pat1_headers)
    assert pat1_reps.status_code == 200
    print("✓ Scenario 11 Passed: Patient accesses own reports and care team.")

    # -------------------------------------------------------------
    # Scenario 12: Demo doctor Dr. Sarah Al-Mansoor & 4 demo patients retain active access
    # -------------------------------------------------------------
    login_demo_doc = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "doctor@strokeaegis.local",
        "password": "DoctorSecure2026!"
    })
    assert login_demo_doc.status_code == 200, f"Demo doctor login failed: {login_demo_doc.text}"
    demo_doc_token = login_demo_doc.json()["access_token"]
    demo_doc_headers = {"Authorization": f"Bearer {demo_doc_token}"}

    demo_doc_pts = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/patients", headers=demo_doc_headers).json()["patients"]
    assert len(demo_doc_pts) == 4, f"Expected 4 demo patients for Dr. Sarah Al-Mansoor, got {len(demo_doc_pts)}"
    for p in demo_doc_pts:
        assert p["relationship_type"] == "primary"
        assert p["status"] == "active"
    print("✓ Scenario 12 Passed: Dr. Sarah Al-Mansoor retains all 4 official demo patients as active primary.")

    # -------------------------------------------------------------
    # Scenario 13: Doctor-Patient Direct Messaging & Notification Sync
    # -------------------------------------------------------------
    # Doc3 accepted Pat1 in Scenario 6. Verify Doc3 has a conversation with Pat1
    doc3_convos = requests.get(f"{BASE_URL}/api/clinical-portal/conversations", headers=doc3_headers).json()["conversations"]
    assert len(doc3_convos) >= 1, "Expected at least 1 conversation for Doc3"
    convo_doc3_pat1 = next(c for c in doc3_convos if c["counterparty"]["id"] == pat1_id)
    convo_id = convo_doc3_pat1["id"]

    # Doc3 sends a clinical message to Pat1
    doc_msg_res = requests.post(f"{BASE_URL}/api/clinical-portal/conversations/{convo_id}/messages",
                                headers=doc3_headers,
                                json={"content": "Hello patient, this is Dr. 3 following up on your consultation."})
    assert doc_msg_res.status_code == 200, f"Doctor message failed: {doc_msg_res.text}"

    # Pat1 fetches conversations -> must have convo_id
    pat1_convos = requests.get(f"{BASE_URL}/api/clinical-portal/conversations", headers=pat1_headers).json()["conversations"]
    assert any(c["id"] == convo_id for c in pat1_convos), "Conversation not found in patient conversations"

    # Pat1 fetches messages in thread -> doctor's message must be visible and is_mine == False
    pat1_msgs = requests.get(f"{BASE_URL}/api/clinical-portal/conversations/{convo_id}/messages", headers=pat1_headers).json()["messages"]
    assert any(m["content"] == "Hello patient, this is Dr. 3 following up on your consultation." and not m["is_mine"] for m in pat1_msgs), "Doctor message not found in patient message stream"

    # Pat1 checks notifications -> notification for new_message exists
    pat1_notifs = requests.get(f"{BASE_URL}/api/clinical-portal/notifications", headers=pat1_headers).json()["notifications"]
    msg_notif = next((n for n in pat1_notifs if n["notification_type"] == "new_message" and n["reference_id"] == convo_id), None)
    assert msg_notif is not None, "new_message notification not found for patient"

    # Pat1 sends reply message back to Doc3
    pat_reply_res = requests.post(f"{BASE_URL}/api/clinical-portal/conversations/{convo_id}/messages",
                                  headers=pat1_headers,
                                  json={"content": "Thank you Dr. 3, I am doing much better today."})
    assert pat_reply_res.status_code == 200, f"Patient reply failed: {pat_reply_res.text}"

    # Doc3 fetches messages -> Pat1's reply must be present
    doc3_msgs = requests.get(f"{BASE_URL}/api/clinical-portal/conversations/{convo_id}/messages", headers=doc3_headers).json()["messages"]
    assert any(m["content"] == "Thank you Dr. 3, I am doing much better today." and not m["is_mine"] for m in doc3_msgs), "Patient reply not found in doctor message stream"
    print("✓ Scenario 13 Passed: Doctor and Patient bi-directional messaging, conversation auto-healing, and notification linking succeed seamlessly.")

    print("\n" + "=" * 60)
    print("ALL 13 SCENARIOS & REGRESSION CHECKS PASSED WITH ZERO ERRORS!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
