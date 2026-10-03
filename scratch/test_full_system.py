import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.abspath("."))

from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

def run_tests():
    print("=== STARTING FULL END-TO-END SYSTEM INTEGRATION TEST ===")

    # -------------------------------------------------------------
    # Test 1: Doctor Login & Stats & Directory
    # -------------------------------------------------------------
    print("\n[1] Testing Doctor Login & Roster...")
    login_doc_resp = client.post("/api/auth/login", json={
        "email": "doctor@strokeaegis.local",
        "password": "DoctorSecure2026!"
    })
    assert login_doc_resp.status_code == 200, f"Doctor login failed: {login_doc_resp.text}"
    doc_token = login_doc_resp.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    print("✓ Doctor authenticated successfully.")

    # Doctor stats
    stats_resp = client.get("/api/clinical-portal/doctor/stats", headers=doc_headers)
    assert stats_resp.status_code == 200, f"Stats failed: {stats_resp.text}"
    stats_data = stats_resp.json()
    print(f"✓ Doctor stats retrieved: {stats_data['total_patients']} patients, {stats_data['pending_reports']} pending reports.")
    assert stats_data["total_patients"] >= 4, "Expected at least 4 seeded patients"

    # Doctor patients directory
    pat_resp = client.get("/api/clinical-portal/doctor/patients", headers=doc_headers)
    assert pat_resp.status_code == 200, f"Patients fetch failed: {pat_resp.text}"
    patients = pat_resp.json()["patients"]
    print(f"✓ Doctor roster contains {len(patients)} patients:")
    for p in patients[:3]:
        print(f"   - {p['full_name']} ({p['mrn']}) | Status: {p['status']}")

    # -------------------------------------------------------------
    # Test 2: Doctor Admits New Patient Directly
    # -------------------------------------------------------------
    print("\n[2] Testing Direct Patient Admission from Doctor Workspace...")
    import uuid
    uid = str(uuid.uuid4())[:6]
    admit_resp = client.post("/api/clinical-portal/doctor/patients/admit", headers=doc_headers, json={
        "full_name": f"Test Patient {uid}",
        "email": f"testpatient_{uid}@strokeaegis.local",
        "date_of_birth": "1975-06-15",
        "gender": "Female",
        "emergency_contact": "Brother +966-55-999-8888",
        "status": "active"
    })
    assert admit_resp.status_code == 200, f"Admit patient failed: {admit_resp.text}"
    admit_data = admit_resp.json()
    new_mrn = admit_data["patient"]["mrn"]
    print(f"✓ Patient admitted with auto-generated MRN: {new_mrn}")
    assert new_mrn.startswith("MRN-"), f"MRN format incorrect: {new_mrn}"

    # Verify patient now in doctor directory
    ref_pat_resp = client.get("/api/clinical-portal/doctor/patients", headers=doc_headers)
    ref_patients = ref_pat_resp.json()["patients"]
    assert any(p["mrn"] == new_mrn for p in ref_patients), "Newly admitted patient not found in roster!"
    print("✓ Newly admitted patient confirmed in Doctor's live roster.")

    # -------------------------------------------------------------
    # Test 3: Notifications System
    # -------------------------------------------------------------
    print("\n[3] Testing Notification Endpoints...")
    notif_resp = client.get("/api/clinical-portal/notifications", headers=doc_headers)
    assert notif_resp.status_code == 200, f"Notifs fetch failed: {notif_resp.text}"
    notifs_data = notif_resp.json()
    print(f"✓ Retrieved {len(notifs_data['notifications'])} notifications, unread: {notifs_data['unread_count']}.")
    
    # Mark read
    if notifs_data["notifications"]:
        first_notif = notifs_data["notifications"][0]
        mark_res = client.post(f"/api/clinical-portal/notifications/{first_notif['id']}/read", headers=doc_headers)
        assert mark_res.status_code == 200
        print(f"✓ Notification {first_notif['id'][:8]} marked as read.")
    
    # Mark all read
    mark_all_res = client.post("/api/clinical-portal/notifications/read-all", headers=doc_headers)
    assert mark_all_res.status_code == 200
    print("✓ All notifications marked as read.")

    # -------------------------------------------------------------
    # Test 4: Patient Login & Overview & Self-Check
    # -------------------------------------------------------------
    print("\n[4] Testing Patient Login & Self-Check Flow...")
    login_pat_resp = client.post("/api/auth/login", json={
        "email": "patient@strokeaegis.local",
        "password": "PatientSecure2026!"
    })
    assert login_pat_resp.status_code == 200, f"Patient login failed: {login_pat_resp.text}"
    pat_token = login_pat_resp.json()["access_token"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}
    print("✓ Patient authenticated successfully.")

    # Patient overview
    pat_ov_resp = client.get("/api/clinical-portal/patient/overview", headers=pat_headers)
    assert pat_ov_resp.status_code == 200, f"Patient overview failed: {pat_ov_resp.text}"
    pat_ov = pat_ov_resp.json()
    print(f"✓ Patient Overview: {pat_ov['patient']['full_name']} | Doctor: {pat_ov['doctor']['full_name'] if pat_ov['doctor'] else 'Unassigned'}")
    assert pat_ov["patient"]["mrn"] == "MRN-202609-001"

    # Patient vascular self-check (Quick Risk)
    selfcheck_resp = client.post("/api/clinical-portal/patient/quick-risk", headers=pat_headers, json={
        "age": 67.0,
        "gender": "Male",
        "hypertension": 1,
        "heart_disease": 1,
        "avg_glucose_level": 228.69,
        "bmi": 36.6,
        "smoking_status": "formerly smoked",
        "ever_married": "Yes",
        "Residence_type": "Urban"
    })
    assert selfcheck_resp.status_code == 200, f"Self-check failed: {selfcheck_resp.text}"
    sc_data = selfcheck_resp.json()
    print(f"✓ Vascular Self-Check calculated: {sc_data['result']['risk_tier']} Risk ({sc_data['result']['probability_pct']}%)")
    assert sc_data["result"]["risk_tier"] == "High"

    # Verify saved in longitudinal assessments
    ass_resp = client.get("/api/clinical-portal/patient/assessments", headers=pat_headers)
    assert ass_resp.status_code == 200
    pat_assessments = ass_resp.json()["assessments"]
    print(f"✓ Patient has {len(pat_assessments)} longitudinal assessments stored in PostgreSQL.")
    assert len(pat_assessments) >= 1

    # Patient reports
    rep_resp = client.get("/api/clinical-portal/patient/reports", headers=pat_headers)
    assert rep_resp.status_code == 200
    pat_reports = rep_resp.json()["reports"]
    print(f"✓ Patient has {len(pat_reports)} certified/pending clinical reports.")
    assert len(pat_reports) >= 1

    # -------------------------------------------------------------
    # Test 5: Patient-Doctor Real-Time Consultation Chat
    # -------------------------------------------------------------
    print("\n[5] Testing 1-to-1 Clinical Messaging between Patient and Doctor...")
    doc_conv_resp = client.get("/api/clinical-portal/conversations", headers=doc_headers)
    assert doc_conv_resp.status_code == 200
    doc_convos = doc_conv_resp.json()["conversations"]
    sarah_ahmed_convo = next((c for c in doc_convos if c["counterparty"]["email"] == "patient@strokeaegis.local"), None)
    assert sarah_ahmed_convo is not None, "Expected conversation between Dr. Sarah and Ahmed"
    convo_id = sarah_ahmed_convo["id"]

    # Patient sends message
    send_pat_msg = client.post(f"/api/clinical-portal/conversations/{convo_id}/messages", headers=pat_headers, json={
        "content": "Good morning Dr. Sarah, I noticed my blood pressure is slightly elevated today. Should I take an extra dose?"
    })
    assert send_pat_msg.status_code == 200
    print("✓ Patient successfully posted message to consultation thread.")

    # Doctor reads and replies
    send_doc_msg = client.post(f"/api/clinical-portal/conversations/{convo_id}/messages", headers=doc_headers, json={
        "content": "Good morning Ahmed. Do NOT double your dose. Please rest in a calm room for 15 minutes, re-check, and call the clinic if systolic exceeds 160."
    })
    assert send_doc_msg.status_code == 200
    print("✓ Doctor successfully replied to consultation thread.")

    # Verify thread contains both messages
    msgs_resp = client.get(f"/api/clinical-portal/conversations/{convo_id}/messages", headers=pat_headers)
    assert msgs_resp.status_code == 200
    msgs = msgs_resp.json()["messages"]
    assert len(msgs) >= 2
    print(f"✓ Consultation thread verified with {len(msgs)} total messages.")

    # -------------------------------------------------------------
    # Test 6: Auto-linkage for Newly Registered Users
    # -------------------------------------------------------------
    print("\n[6] Testing Auto-linkage for Newly Registered Users...")
    
    # New Doctor Registration
    doc_uid = str(uuid.uuid4())[:6]
    reg_doc_resp = client.post("/api/auth/register/doctor", json={
        "email": f"newdoc_{doc_uid}@strokeaegis.local",
        "password": "NewDoctorSecure2026!",
        "full_name": f"Dr. Tariq Al-Ghamdi {doc_uid}",
        "license_number": f"MD-SA-{doc_uid.upper()}",
        "specialization": "Interventional Neurology",
        "hospital_affiliation": "King Fahad Medical City"
    })
    assert reg_doc_resp.status_code in (200, 201), f"Doctor register failed: {reg_doc_resp.text}"
    new_doc_token = reg_doc_resp.json()["access_token"]
    new_doc_headers = {"Authorization": f"Bearer {new_doc_token}"}
    
    # New doctor should IMMEDIATELY have patients in roster due to auto-linkage!
    new_doc_pats = client.get("/api/clinical-portal/doctor/patients", headers=new_doc_headers).json()["patients"]
    print(f"✓ Newly registered doctor automatically linked to {len(new_doc_pats)} patients upon registration (NO EMPTY ROSTER)!")
    assert len(new_doc_pats) > 0, "Auto-linkage failed: new doctor roster is empty!"

    # New Patient Registration
    pat_uid = str(uuid.uuid4())[:6]
    reg_pat_resp = client.post("/api/auth/register/patient", json={
        "email": f"newpatient_{pat_uid}@strokeaegis.local",
        "password": "NewPatientSecure2026!",
        "full_name": f"Huda Al-Harbi {pat_uid}",
        "date_of_birth": "1982-03-20",
        "gender": "Female",
        "emergency_contact": "Husband +966-50-222-3333"
    })
    assert reg_pat_resp.status_code in (200, 201), f"Patient register failed: {reg_pat_resp.text}"
    new_pat_token = reg_pat_resp.json()["access_token"]
    new_pat_headers = {"Authorization": f"Bearer {new_pat_token}"}

    # New patient should IMMEDIATELY have supervising doctor and welcome notification
    new_pat_ov = client.get("/api/clinical-portal/patient/overview", headers=new_pat_headers).json()
    print(f"✓ Newly registered patient auto-assigned to supervising doctor: {new_pat_ov['doctor']['full_name'] if new_pat_ov['doctor'] else 'None'}")
    assert new_pat_ov["doctor"] is not None, "Auto-linkage failed: new patient has no doctor!"

    new_pat_notifs = client.get("/api/clinical-portal/notifications", headers=new_pat_headers).json()["notifications"]
    print(f"✓ Newly registered patient received {len(new_pat_notifs)} welcome notification(s).")
    assert len(new_pat_notifs) >= 1, "Welcome notification was not created!"

    print("\n========================================================")
    print("🎉 ALL END-TO-END INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉")
    print("========================================================")

if __name__ == "__main__":
    run_tests()
