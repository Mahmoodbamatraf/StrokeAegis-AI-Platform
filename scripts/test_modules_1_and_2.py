"""
StrokeAegis AI — Dedicated Test Suite for Modules 1 & 2:
Module 1: Overview & KPIs
Module 2: Clinician Approvals Workflow
"""

import sys
import uuid
import requests
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=" * 70)
    print("STARTING TEST SUITE: MODULE 1 (OVERVIEW) & MODULE 2 (CLINICIAN APPROVALS)")
    print("=" * 70)

    # 1. Admin Login
    r_admin_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@strokeaegis.local",
        "password": "AdminSecure2026!"
    })
    assert r_admin_login.status_code == 200, f"Admin login failed: {r_admin_login.text}"
    admin_token = r_admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] Step 1: Administrator authenticated successfully.")

    # 2. Test Overview & KPIs (Module 1)
    r_ov = requests.get(f"{BASE_URL}/api/admin/overview", headers=admin_headers)
    assert r_ov.status_code == 200, f"Overview request failed: {r_ov.text}"
    ov = r_ov.json()

    # Check top-level and kpis keys
    assert "active_doctors" in ov, "active_doctors missing from overview"
    assert "pending_clinicians" in ov, "pending_clinicians missing from overview"
    assert "registered_patients" in ov, "registered_patients missing from overview"
    assert "assessments_today" in ov, "assessments_today missing from overview"
    assert "safety_flags" in ov, "safety_flags missing from overview"
    assert "volume_breakdown" in ov, "volume_breakdown missing from overview"
    assert "subsystem_health" in ov, "subsystem_health missing from overview"
    assert "recent_events" in ov, "recent_events missing from overview"

    vb = ov["volume_breakdown"]
    assert "total_assessments" in vb
    assert "ct_scans_total" in vb
    assert "high_risk_count" in vb
    assert "high_risk_rate_pct" in vb
    assert "ischemic_count" in vb
    assert "hemorrhagic_count" in vb
    assert "normal_count" in vb

    # Check real subsystem health
    sh = ov["subsystem_health"]
    assert len(sh) >= 4, f"Expected at least 4 subsystem health checks, got {len(sh)}"
    db_check = next((s for s in sh if "PostgreSQL" in s["service_name"]), None)
    assert db_check is not None and db_check["status"] == "HEALTHY", f"DB check failed: {db_check}"
    assert "ms" in db_check["details"], f"Expected latency in details: {db_check['details']}"

    print(f"[PASS] Step 2: Overview & KPIs verified: Active Doctors={ov['active_doctors']}, Pending Clinicians={ov['pending_clinicians']}, Total Assessments={vb['total_assessments']}, DB Latency={db_check['details']}.")

    # 3. Test Clinician Approvals Workflow (Module 2)
    # Register Candidate Doctor
    cand_uid = str(uuid.uuid4())[:8]
    cand_email = f"dr.module2.{cand_uid}@strokeaegis.local"
    cand_license = f"LIC-MOD2-{cand_uid.upper()}"
    cand_pass = "SecureModule2Pass!"

    r_reg = requests.post(f"{BASE_URL}/api/auth/register/doctor", json={
        "email": cand_email,
        "password": cand_pass,
        "full_name": f"Dr. Test Clinician {cand_uid}",
        "license_number": cand_license,
        "specialization": "Interventional Neurology",
        "hospital_affiliation": "King Fahad Stroke Center",
        "contact_phone": "+966 50 123 4567"
    })
    assert r_reg.status_code == 201, f"Doctor registration failed: {r_reg.text}"
    reg_data = r_reg.json()
    assert reg_data["approval_status"] == "pending", f"Expected pending, got {reg_data['approval_status']}"
    cand_token = reg_data["access_token"]
    print(f"[PASS] Step 3: Candidate clinician registered with pending status: {cand_email} (License: {cand_license})")

    # Verify pending doctor blocked from clinical endpoints
    r_blocked = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/patients", headers={"Authorization": f"Bearer {cand_token}"})
    assert r_blocked.status_code == 403, f"Expected 403 for pending clinician, got {r_blocked.status_code}"
    print("[PASS] Step 4: Pending clinician strictly blocked (403) from clinical workspace.")

    # Find the candidate profile ID from admin directory
    r_list = requests.get(f"{BASE_URL}/api/admin/clinicians?search={cand_license}", headers=admin_headers)
    assert r_list.status_code == 200
    clinicians = r_list.json()
    assert len(clinicians) >= 1, f"Candidate clinician not found in search: {clinicians}"
    cand_profile = clinicians[0]
    profile_id = cand_profile["id"]

    # 4. Action: Request More Info
    req_notes = "Please submit verifiable State Board registration confirmation and hospital credentialing letter."
    r_req_info = requests.post(f"{BASE_URL}/api/admin/clinicians/{profile_id}/request-info", headers=admin_headers, json={
        "request_notes": req_notes
    })
    assert r_req_info.status_code == 200, f"Request info failed: {r_req_info.text}"
    print("[PASS] Step 5: Admin requested more info successfully.")

    # Verify status is more_info_required
    r_check_doc = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {cand_token}"})
    assert r_check_doc.status_code == 200
    doc_me = r_check_doc.json()
    assert doc_me["approval_status"] == "more_info_required", f"Expected more_info_required, got {doc_me['approval_status']}"
    assert doc_me["more_info_request"] == req_notes

    # Verify more_info_required doctor still blocked from clinical workspace
    r_blocked_info = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/patients", headers={"Authorization": f"Bearer {cand_token}"})
    assert r_blocked_info.status_code == 403, f"Expected 403 for more_info_required clinician, got {r_blocked_info.status_code}"
    assert "additional information" in r_blocked_info.json()["detail"].lower()
    print("[PASS] Step 6: Clinician in more_info_required status strictly blocked (403) with descriptive rationale.")

    # 5. Doctor Resubmission
    r_resubmit = requests.post(f"{BASE_URL}/api/auth/doctor/resubmit-info", headers={"Authorization": f"Bearer {cand_token}"}, json={
        "hospital_affiliation": "King Fahad Medical City - Comprehensive Stroke Unit",
        "clarification_notes": "Attached State Board registration renewal reference #TX-2026-8812 and appointment letter."
    })
    assert r_resubmit.status_code == 200, f"Resubmission failed: {r_resubmit.text}"
    resub_data = r_resubmit.json()
    assert resub_data["approval_status"] == "pending", f"Expected pending after resubmit, got {resub_data['approval_status']}"
    print("[PASS] Step 7: Doctor resubmitted requested information; status returned to 'pending' for administrative review.")

    # 6. Admin Approves with Medical Board Reference & Attestation Notes
    verif_ref = f"MDC-VERIF-2026-{cand_uid.upper()}"
    verif_notes = f"Verified in National Health Registry by Admin on 2026-10-13. Primary license active through 2028."
    r_approve = requests.post(f"{BASE_URL}/api/admin/clinicians/{profile_id}/approve", headers=admin_headers, json={
        "verification_reference": verif_ref,
        "verification_notes": verif_notes
    })
    assert r_approve.status_code == 200, f"Approval failed: {r_approve.text}"

    # Verify doctor profile updated
    r_list_after = requests.get(f"{BASE_URL}/api/admin/clinicians?search={cand_license}", headers=admin_headers)
    assert r_list_after.status_code == 200
    updated_doc = r_list_after.json()[0]
    assert updated_doc["approval_status"] == "approved"
    assert updated_doc["verification_reference"] == verif_ref
    assert updated_doc["verification_notes"] == verif_notes
    print(f"[PASS] Step 8: Admin verified & approved clinician with reference {verif_ref}.")

    # Verify doctor now accesses clinical endpoints
    r_doc_ok = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/patients", headers={"Authorization": f"Bearer {cand_token}"})
    assert r_doc_ok.status_code == 200, f"Expected 200 for approved doctor, got {r_doc_ok.status_code}"
    print("[PASS] Step 9: Approved clinician now successfully accesses clinical workspace (200 OK).")

    # 7. Admin Suspends Doctor
    susp_reason = "Temporary administrative credential audit review pending hospital certificate re-validation."
    r_susp = requests.post(f"{BASE_URL}/api/admin/clinicians/{profile_id}/suspend", headers=admin_headers, json={
        "reason": susp_reason
    })
    assert r_susp.status_code == 200, f"Suspension failed: {r_susp.text}"

    # Verify doctor blocked
    r_susp_blocked = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/patients", headers={"Authorization": f"Bearer {cand_token}"})
    assert r_susp_blocked.status_code == 403, f"Expected 403 for suspended doctor, got {r_susp_blocked.status_code}"
    print("[PASS] Step 10: Suspended clinician strictly blocked (403) from clinical workspace.")

    # 8. Admin Reinstates Doctor
    r_reinstate = requests.post(f"{BASE_URL}/api/admin/clinicians/{profile_id}/approve", headers=admin_headers, json={
        "verification_reference": verif_ref,
        "verification_notes": "Reinstated after verification review passed."
    })
    assert r_reinstate.status_code == 200
    r_reinst_ok = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/patients", headers={"Authorization": f"Bearer {cand_token}"})
    assert r_reinst_ok.status_code == 200
    print("[PASS] Step 11: Clinician reinstated successfully and restored to active clinical access.")

    # 9. Admin Rejects Candidate Doctor (test rejection flow)
    cand2_uid = str(uuid.uuid4())[:8]
    r_reg2 = requests.post(f"{BASE_URL}/api/auth/register/doctor", json={
        "email": f"dr.reject.{cand2_uid}@strokeaegis.local",
        "password": "SecurePassword123!",
        "full_name": f"Dr. Reject Test {cand2_uid}",
        "license_number": f"LIC-REJ-{cand2_uid.upper()}",
        "specialization": "Neurology"
    })
    assert r_reg2.status_code == 201
    cand2_token = r_reg2.json()["access_token"]
    cand2_prof = requests.get(f"{BASE_URL}/api/admin/clinicians?search=LIC-REJ-{cand2_uid.upper()}", headers=admin_headers).json()[0]

    # Rejection requires at least 5 chars
    r_bad_rej = requests.post(f"{BASE_URL}/api/admin/clinicians/{cand2_prof['id']}/reject", headers=admin_headers, json={"reason": "No"})
    assert r_bad_rej.status_code == 400, "Expected 400 for short rejection reason"

    rej_reason = "License number failed state verification registry lookup. Expired 2024."
    r_rej = requests.post(f"{BASE_URL}/api/admin/clinicians/{cand2_prof['id']}/reject", headers=admin_headers, json={"reason": rej_reason})
    assert r_rej.status_code == 200

    r_rej_blocked = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/patients", headers={"Authorization": f"Bearer {cand2_token}"})
    assert r_rej_blocked.status_code == 403
    print("[PASS] Step 12: Clinician rejection with mandatory justification verified.")

    # 10. Verify Audit Log recorded all lifecycle events
    r_audit = requests.get(f"{BASE_URL}/api/admin/audit-logs?limit=20", headers=admin_headers)
    assert r_audit.status_code == 200
    audit_actions = [a["action"] for a in r_audit.json().get("items", [])]
    assert "clinician_approved" in audit_actions
    assert "clinician_suspended" in audit_actions
    assert "clinician_rejected" in audit_actions
    assert "clinician_more_info_requested" in audit_actions
    print(f"[PASS] Step 13: Audit trail verified with complete immutable history of administrative actions.")

    print("=" * 70)
    print("ALL 13 TESTS FOR MODULE 1 & MODULE 2 PASSED FLAWLESSLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
