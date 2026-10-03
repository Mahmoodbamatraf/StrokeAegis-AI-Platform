"""
Test script for verifying Leading Page and Auth Portal
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from backend.app import app

def test_landing():
    print("Testing Leading Page and Auth Integration...")
    client = TestClient(app)

    # 1. Test index.html contains landing screen
    r = client.get("/")
    assert r.status_code == 200
    html = r.text
    assert 'id="screen-landing"' in html, "Missing #screen-landing in index.html"
    assert 'id="landing-doctor-robot"' in html, "Missing cute doctor robot image in index.html"
    assert 'id="landing-auth-card"' in html, "Missing modern auth card in index.html"
    assert 'id="tab-auth-signin"' in html, "Missing sign-in tab"
    assert 'id="tab-auth-signup"' in html, "Missing sign-up tab"
    assert 'id="btn-demo-doctor"' in html, "Missing demo doctor button"
    assert 'id="btn-demo-patient"' in html, "Missing demo patient button"
    assert 'id="header-user-badge"' in html, "Missing header user badge"
    print("  [PASS] index.html contains all leading page and auth elements!")

    # 2. Test cute doctor robot SVG asset is served
    r_svg = client.get("/assets/medical_robot_transparent.svg")
    assert r_svg.status_code == 200
    assert len(r_svg.content) > 1000000, "Robot SVG should be a high-quality vector file"
    print("  [PASS] Cute doctor robot SVG asset served successfully (HTTP 200)!")

    # 3. Test static CSS is served and has leading page styles
    r_css = client.get("/styles.css")
    assert r_css.status_code == 200
    assert "#screen-landing" in r_css.text
    assert "robot-float" in r_css.text
    assert "modern-auth-card" in r_css.text
    print("  [PASS] styles.css contains modern leading page and auth styling!")

    # 4. Test Demo Doctor Login via API
    r_doc_login = client.post("/api/auth/login", json={
        "email": "doctor@strokeaegis.local",
        "password": "DoctorSecure2026!"
    })
    assert r_doc_login.status_code == 200
    doc_data = r_doc_login.json()
    assert doc_data["role"] == "doctor"
    print(f"  [PASS] 1-Click Fast Demo Doctor Login verified for {doc_data['full_name']}!")

    # 5. Test Demo Patient Login via API
    r_pat_login = client.post("/api/auth/login", json={
        "email": "patient@strokeaegis.local",
        "password": "PatientSecure2026!"
    })
    assert r_pat_login.status_code == 200
    pat_data = r_pat_login.json()
    assert pat_data["role"] == "patient"
    print(f"  [PASS] 1-Click Fast Demo Patient Login verified for {pat_data['full_name']}!")

    print("\n==================================================================")
    print("  ALL LEADING PAGE & AUTH INTEGRATION TESTS PASSED!")
    print("==================================================================")

if __name__ == "__main__":
    test_landing()
