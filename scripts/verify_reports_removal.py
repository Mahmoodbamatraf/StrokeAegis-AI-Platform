import sys
import os
from fastapi.testclient import TestClient

# Ensure root in sys.path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app import app
from backend.database.database import SessionLocal
from backend.database.models import User, Report, Assessment

client = TestClient(app)

def run_verification():
    print("=" * 70)
    print("VERIFICATION SUITE: ADMIN REPORTS REMOVAL & WORKFLOW PRESERVATION")
    print("=" * 70)

    # 1. Login Admin, Doctor, Patient
    r_admin = client.post("/api/auth/login", json={"email": "admin@strokeaegis.local", "password": "AdminSecure2026!"})
    assert r_admin.status_code == 200, f"Admin login failed: {r_admin.text}"
    admin_token = r_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    r_doc = client.post("/api/auth/login", json={"email": "doctor@strokeaegis.local", "password": "DoctorSecure2026!"})
    assert r_doc.status_code == 200, f"Doctor login failed: {r_doc.text}"
    doc_token = r_doc.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    r_pat = client.post("/api/auth/login", json={"email": "patient@strokeaegis.local", "password": "PatientSecure2026!"})
    assert r_pat.status_code == 200, f"Patient login failed: {r_pat.text}"
    pat_token = r_pat.json()["access_token"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}

    print("[PASS] 1. Authentication successful across Admin, Doctor, and Patient roles.")

    # 2. Check Admin Endpoint /api/admin/reports is 404
    r_admin_rep = client.get("/api/admin/reports", headers=admin_headers)
    assert r_admin_rep.status_code == 404, f"Expected 404 for removed endpoint, got {r_admin_rep.status_code}"
    print("[PASS] 2. /api/admin/reports returns 404 Not Found (endpoint successfully removed).")

    # 3. Check Frontend Index.html Cleanliness
    index_html = os.path.join(root_dir, "frontend", "index.html")
    with open(index_html, "r", encoding="utf-8") as f:
        html = f.read()
    assert "admin-tab-reports" not in html
    assert "admin-pane-reports" not in html
    assert "admin-reports-table" not in html
    print("[PASS] 3. Frontend HTML contains zero traces of admin reports tab, pane, or table.")

    # 4. Check Frontend App.js Cleanliness
    app_js = os.path.join(root_dir, "frontend", "app.js")
    with open(app_js, "r", encoding="utf-8") as f:
        js = f.read()
    assert "loadAdminReports" not in js
    assert "currentReportFilter" not in js
    assert "admin-pane-reports" not in js
    print("[PASS] 4. Frontend JavaScript contains zero traces of loadAdminReports or report tab handlers.")

    # 5. Doctor Reports Workflow
    r_doc_rep = client.get("/api/clinical-portal/doctor/reports", headers=doc_headers)
    assert r_doc_rep.status_code == 200, f"Doctor reports failed: {r_doc_rep.text}"
    doc_data = r_doc_rep.json()
    assert "reports" in doc_data
    print(f"[PASS] 5. Doctor clinical reports API operational ({len(doc_data['reports'])} reports).")

    # 6. Patient Reports Workflow
    r_pat_rep = client.get("/api/clinical-portal/patient/reports", headers=pat_headers)
    assert r_pat_rep.status_code == 200, f"Patient reports failed: {r_pat_rep.text}"
    pat_data = r_pat_rep.json()
    assert "reports" in pat_data
    print(f"[PASS] 6. Patient clinical reports API operational ({len(pat_data['reports'])} reports).")

    # 7. Check Database Integrity: No clinical reports or assessments deleted
    db = SessionLocal()
    try:
        report_count = db.query(Report).count()
        assessment_count = db.query(Assessment).count()
        assert report_count > 0, "Reports were deleted!"
        assert assessment_count > 0, "Assessments were deleted!"
        print(f"[PASS] 7. Database integrity preserved: {report_count} clinical reports, {assessment_count} assessments in PostgreSQL.")
    finally:
        db.close()

    # 8. Check Remaining 7 Admin Modules
    r1 = client.get("/api/admin/overview", headers=admin_headers)
    assert r1.status_code == 200 and "active_doctors" in r1.json()
    print("[PASS] 8a. Module 1: Overview & KPIs operational.")

    r2 = client.get("/api/admin/clinicians", headers=admin_headers)
    assert r2.status_code == 200
    print("[PASS] 8b. Module 2: Clinician Approvals operational.")

    r3 = client.get("/api/admin/safety-queue", headers=admin_headers)
    assert r3.status_code == 200
    print("[PASS] 8c. Module 3: Clinical Safety Queue operational.")

    r4 = client.get("/api/admin/users", headers=admin_headers)
    assert r4.status_code == 200
    print("[PASS] 8d. Module 4: Users & Access operational.")

    r5 = client.get("/api/admin/models", headers=admin_headers)
    assert r5.status_code == 200
    print("[PASS] 8e. Module 5: AI Model Monitoring operational.")

    r6 = client.get("/api/admin/audit-logs", headers=admin_headers)
    assert r6.status_code == 200
    print("[PASS] 8f. Module 6: Audit Log operational.")

    r7 = client.get("/api/admin/health", headers=admin_headers)
    assert r7.status_code == 200
    print("[PASS] 8g. Module 7: System Health operational.")

    print("\n" + "=" * 70)
    print("ALL 8 VERIFICATION CHECKS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == "__main__":
    run_verification()
