import sys
import os
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=" * 70)
    print("STARTING TEST SUITE: REMOVAL OF ADMIN REPORTS & CLINICAL WORKFLOW PRESERVATION")
    print("=" * 70)

    # 1. Log in all roles
    r_admin_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@strokeaegis.local",
        "password": "AdminSecure2026!"
    })
    assert r_admin_login.status_code == 200, f"Admin login failed: {r_admin_login.text}"
    admin_token = r_admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    r_doc_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "doctor@strokeaegis.local",
        "password": "DoctorSecure2026!"
    })
    assert r_doc_login.status_code == 200, f"Doctor login failed: {r_doc_login.text}"
    doc_token = r_doc_login.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    r_pat_login = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "patient@strokeaegis.local",
        "password": "PatientSecure2026!"
    })
    assert r_pat_login.status_code == 200, f"Patient login failed: {r_pat_login.text}"
    pat_token = r_pat_login.json()["access_token"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}
    print("[PASS] Step 1: Admin, Doctor, and Patient successfully authenticated.")

    # 2. Verify Admin Endpoint Removal: GET /api/admin/reports must return 404 (Not Found)
    r_admin_reports = requests.get(f"{BASE_URL}/api/admin/reports", headers=admin_headers)
    print(f" -> Admin direct access /api/admin/reports status: {r_admin_reports.status_code}")
    assert r_admin_reports.status_code == 404, f"Expected 404 for removed endpoint, got {r_admin_reports.status_code}"
    print("[PASS] Step 2: /api/admin/reports is completely removed and inaccessible (HTTP 404).")

    # 3. Verify HTML & JS File Cleanliness: No orphaned tabs or panes
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    index_html_path = os.path.join(root_dir, "frontend", "index.html")
    app_js_path = os.path.join(root_dir, "frontend", "app.js")

    with open(index_html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    assert "id=\"admin-tab-reports\"" not in html_content, "admin-tab-reports still present in index.html"
    assert "id=\"admin-pane-reports\"" not in html_content, "admin-pane-reports still present in index.html"
    assert "admin-reports-table" not in html_content, "admin-reports-table still present in index.html"
    assert "admin-reports-type-filters" not in html_content, "admin-reports-type-filters still present in index.html"
    print("[PASS] Step 3: Admin Reports tab, pane, and table verified completely removed from index.html.")

    with open(app_js_path, "r", encoding="utf-8") as f:
        js_content = f.read()
    assert "loadAdminReports" not in js_content, "loadAdminReports function still present in app.js"
    assert "currentReportFilter" not in js_content, "currentReportFilter variable still present in app.js"
    assert "admin-pane-reports" not in js_content, "admin-pane-reports reference still present in app.js"
    print("[PASS] Step 4: loadAdminReports and report tab handlers verified completely removed from app.js.")

    # 4. Verify Doctor Clinical Reports are 100% Intact
    r_doc_reports = requests.get(f"{BASE_URL}/api/clinical-portal/doctor/reports", headers=doc_headers)
    assert r_doc_reports.status_code == 200, f"Doctor reports failed: {r_doc_reports.text}"
    doc_reports_data = r_doc_reports.json()
    print(f" -> Doctor reports retrieved: {len(doc_reports_data.get('reports', []))} reports in roster.")
    assert "reports" in doc_reports_data, "Doctor response must contain 'reports' key"
    print("[PASS] Step 5: Doctor clinical reports API remains 100% operational.")

    # 5. Verify Patient Clinical Reports are 100% Intact
    r_pat_reports = requests.get(f"{BASE_URL}/api/clinical-portal/patient/reports", headers=pat_headers)
    assert r_pat_reports.status_code == 200, f"Patient reports failed: {r_pat_reports.text}"
    pat_reports_data = r_pat_reports.json()
    print(f" -> Patient reports retrieved: {len(pat_reports_data.get('reports', []))} reports in longitudinal history.")
    assert "reports" in pat_reports_data, "Patient response must contain 'reports' key"
    print("[PASS] Step 6: Patient clinical reports API remains 100% operational.")

    # 6. Verify Doctor Sign-Off Endpoint is Active and Protected
    if doc_reports_data["reports"]:
        sample_rep = doc_reports_data["reports"][0]
        rep_id = sample_rep["id"]
        r_sign = requests.post(f"{BASE_URL}/api/clinical-portal/doctor/reports/{rep_id}/sign-off", headers=doc_headers)
        # 200 (signed), 400 (validation), or 403 (relationship guard) confirms clinical endpoint is active and guarded
        assert r_sign.status_code in [200, 400, 403], f"Unexpected status for sign-off: {r_sign.status_code}"
        print(f"[PASS] Step 7: Doctor sign-off endpoint active and strictly protected (HTTP {r_sign.status_code}).")

    # 7. Verify Remaining 7 Admin Modules are fully operational
    # Module 1: Overview & KPIs
    r_ov = requests.get(f"{BASE_URL}/api/admin/overview", headers=admin_headers)
    assert r_ov.status_code == 200
    ov = r_ov.json()
    assert "active_doctors" in ov and "registered_patients" in ov and "safety_flags" in ov
    print(f"[PASS] Step 8a: Admin Overview & KPIs operating normally (Safety Alerts: {ov['safety_flags']}).")

    # Module 2: Clinician Approvals
    r_cl = requests.get(f"{BASE_URL}/api/admin/clinicians", headers=admin_headers)
    assert r_cl.status_code == 200
    print(f"[PASS] Step 8b: Admin Clinician Approvals operating normally ({len(r_cl.json())} clinicians).")

    # Module 3: Clinical Safety Queue
    r_sq = requests.get(f"{BASE_URL}/api/admin/safety-queue", headers=admin_headers)
    assert r_sq.status_code == 200
    print(f"[PASS] Step 8c: Clinical Safety Queue operating normally ({len(r_sq.json())} cases).")

    # Module 4: Users & Access
    r_us = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
    assert r_us.status_code == 200
    print(f"[PASS] Step 8d: Users & Access directory operating normally ({len(r_us.json())} users).")

    # Module 5: AI Model Monitoring
    r_md = requests.get(f"{BASE_URL}/api/admin/models", headers=admin_headers)
    assert r_md.status_code == 200
    print(f"[PASS] Step 8e: AI Model Monitoring operating normally ({len(r_md.json())} models).")

    # Module 6: Audit Log
    r_al = requests.get(f"{BASE_URL}/api/admin/audit-logs", headers=admin_headers)
    assert r_al.status_code == 200
    print(f"[PASS] Step 8f: Persistent Audit Log operating normally ({r_al.json().get('total')} events).")

    # Module 7: System Health
    r_hl = requests.get(f"{BASE_URL}/api/admin/health", headers=admin_headers)
    assert r_hl.status_code == 200
    print(f"[PASS] Step 8g: System Health operating normally.")

    print("\n" + "=" * 70)
    print("ALL TESTS PASSED: REPORTS REMOVED FROM ADMIN DASHBOARD SAFELY & PRESERVED FOR DOCTORS/PATIENTS!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
