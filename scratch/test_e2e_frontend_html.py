"""
Verify Frontend HTML, assets, and UI element linkages for Phase 2 Portals
"""
import sys
from pathlib import Path
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import os
if not os.environ.get("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = "dummy-key-for-testing"
if not os.environ.get("STROKE_AEGIS_CHATBOT_API_KEY"):
    os.environ["STROKE_AEGIS_CHATBOT_API_KEY"] = "dummy-key-for-testing"

from backend.app import app

client = TestClient(app)

def test_frontend():
    print("\n--- Verifying Frontend Delivery & Element IDs ---")

    # 1. Fetch HTML index
    res = client.get("/")
    assert res.status_code == 200, f"Index failed: {res.status_code}"
    html = res.text
    print("  ✓ GET / returns 200 OK")

    # 2. Check Doctor Portal elements
    assert 'id="screen-doctor-portal"' in html, "Missing #screen-doctor-portal"
    assert 'id="doc-stat-patients"' in html, "Missing #doc-stat-patients"
    assert 'id="doc-stat-pending"' in html, "Missing #doc-stat-pending"
    assert 'id="tbody-doc-patients"' in html, "Missing #tbody-doc-patients"
    assert 'id="tbody-doc-reports"' in html, "Missing #tbody-doc-reports"
    assert 'id="doc-chatbox"' in html, "Missing #doc-chatbox"
    assert 'id="modal-patient-history"' in html, "Missing #modal-patient-history"
    print("  ✓ Doctor Portal HTML structure verified.")

    # 3. Check Patient Portal elements
    assert 'id="screen-patient-portal"' in html, "Missing #screen-patient-portal"
    assert 'id="pat-selfcheck-form"' in html, "Missing #pat-selfcheck-form"
    assert 'id="pat-timeline-list"' in html, "Missing #pat-timeline-list"
    assert 'id="pat-reports-grid"' in html, "Missing #pat-reports-grid"
    assert 'id="pat-doctor-card"' in html, "Missing #pat-doctor-card"
    assert 'id="pat-chat-stream"' in html, "Missing #pat-chat-stream"
    print("  ✓ Patient Portal HTML structure verified.")

    # 4. Check guest explore removal
    assert 'Explore AI Clinical System as Guest' not in html, "Guest explore link was not removed!"
    print("  ✓ Guest explore link confirmed completely removed.")

    # 5. Check CSS delivery
    css_res = client.get("/styles.css")
    assert css_res.status_code == 200, "styles.css not served"
    assert ".portal-hero" in css_res.text
    assert ".messaging-grid" in css_res.text
    print("  ✓ styles.css verified with Phase 2 portal styles.")

    # 6. Check JS delivery
    js_res = client.get("/app.js")
    assert js_res.status_code == 200, "app.js not served"
    assert "initClinicalPortals" in js_res.text
    assert "showDoctorPortal" in js_res.text
    assert "showPatientPortal" in js_res.text
    print("  ✓ app.js verified with Clinical Portals logic.")

    print("\n--- ALL FRONTEND INTEGRATION CHECKS PASSED ---")

if __name__ == "__main__":
    test_frontend()
