"""
StrokeAegis AI — Comprehensive End-to-End Test Suite
Tests all endpoints: Health, Regular System (Path A & Path B), AI System Multi-Agent Flow,
Medical Safety Rejections, and PDF generation.
"""

import io
import sys
import json
from pathlib import Path
from fastapi.testclient import TestClient

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from backend.app import app

client = TestClient(app)
SAMPLES_DIR = PROJECT_ROOT / "sample_scans"


def test_1_health_check():
    print("\n--- TEST 1: HEALTH CHECK ---")
    response = client.get("/api/health")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    print("Health check response:", data["system"], "| Models:", list(data["models"].keys()))
    assert data["status"] == "healthy"
    print("✓ Test 1 Passed!")


def test_2_presets():
    print("\n--- TEST 2: PRESETS ---")
    response = client.get("/api/presets")
    assert response.status_code == 200
    data = response.json()
    assert "ct_presets" in data and "patient_presets" in data
    print(f"Loaded {len(data['ct_presets'])} CT presets and {len(data['patient_presets'])} patient presets.")
    print("✓ Test 2 Passed!")


def test_3_regular_path_a_ml_risk():
    print("\n--- TEST 3: REGULAR SYSTEM PATH A (ML RISK) ---")
    payload = {
        "gender": "Male",
        "age": 67.0,
        "hypertension": 1,
        "heart_disease": 1,
        "ever_married": "Yes",
        "work_type": "Private",
        "Residence_type": "Urban",
        "avg_glucose_level": 228.69,
        "bmi": 36.6,
        "smoking_status": "formerly smoked"
    }
    response = client.post("/api/predict-risk", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    print(f"ML Risk Tier: {res['data']['risk_tier']} ({res['data']['stroke_probability_pct']}%)")
    print("✓ Test 3 Passed!")


def test_4_regular_path_b_ct_ischemia():
    print("\n--- TEST 4: REGULAR SYSTEM PATH B (ISCHEMIA CT DIAGNOSIS) ---")
    scan_path = SAMPLES_DIR / "ischemia_sample.png"
    assert scan_path.exists(), f"Missing {scan_path}"

    with open(scan_path, "rb") as f:
        response = client.post(
            "/api/diagnose-ct",
            files={"file": ("ischemia_sample.png", f, "image/png")}
        )
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    assert res["gate_passed"] is True
    print(f"Prediction: {res['diagnosis']['prediction']} ({res['diagnosis']['confidence_pct']}%)")
    print(f"Localization: {res['diagnosis']['gradcam'].get('anatomical_quadrant')}")
    print("✓ Test 4 Passed!")


def test_5_door_gate_rejection_safety():
    print("\n--- TEST 5: SAFETY GATE REJECTION (NON-BRAIN CT) ---")
    scan_path = SAMPLES_DIR / "non_brain_rejection_sample.png"
    assert scan_path.exists(), f"Missing {scan_path}"

    with open(scan_path, "rb") as f:
        response = client.post(
            "/api/diagnose-ct",
            files={"file": ("non_brain_rejection_sample.png", f, "image/png")}
        )
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is False
    assert res["gate_passed"] is False
    print("Gatekeeper Rejection Message:", res["message"])
    print("✓ Test 5 Passed (Safety Gate successfully prevented misinterpretation)!")


def test_6_ai_system_start_and_polling():
    print("\n--- TEST 6: AI SYSTEM PIPELINE LAUNCH & RESULT ---")
    pat_payload = {
        "gender": "Female",
        "age": 54.0,
        "hypertension": 1,
        "heart_disease": 0,
        "ever_married": "Yes",
        "work_type": "Self-employed",
        "Residence_type": "Rural",
        "avg_glucose_level": 142.5,
        "bmi": 29.8,
        "smoking_status": "smokes"
    }

    scan_path = SAMPLES_DIR / "bleeding_sample.png"
    with open(scan_path, "rb") as f:
        response = client.post(
            "/api/clinical/start-analysis",
            data={"patient_json": json.dumps(pat_payload)},
            files={"file": ("bleeding_sample.png", f, "image/png")}
        )
    assert response.status_code == 200
    res = response.json()
    pipeline_id = res["pipeline_id"]
    print(f"Pipeline started with ID: {pipeline_id}")

    import time
    done = False
    result_data = None
    for attempt in range(45):
        time.sleep(2)
        poll_res = client.get(f"/api/clinical/result/{pipeline_id}")
        assert poll_res.status_code == 200
        poll_data = poll_res.json()
        if poll_data.get("is_done"):
            done = True
            result_data = poll_data.get("result")
            print(f"Pipeline finished on attempt {attempt+1}!")
            break
        print(f"Waiting for multi-agent completion (attempt {attempt+1})... Events: {poll_data.get('events_count')}")

    assert done, "Pipeline did not finish in time"
    assert result_data is not None
    print(f"Report ID: {result_data.get('report_id')}")
    print(f"PDF Filename: {result_data.get('pdf_filename')}")
    print(f"Validation Status: {result_data.get('validation', {}).get('status')}")
    print("✓ Test 6 Passed!")

    # Test PDF download
    if result_data.get("pdf_filename"):
        pdf_res = client.get(f"/api/reports/download-pdf/{result_data['pdf_filename']}")
        assert pdf_res.status_code == 200
        assert len(pdf_res.content) > 10000
        print(f"Verified PDF download: {len(pdf_res.content)} bytes")
        print("✓ Test 6 PDF Verification Passed!")


if __name__ == "__main__":
    test_1_health_check()
    test_2_presets()
    test_3_regular_path_a_ml_risk()
    test_4_regular_path_b_ct_ischemia()
    test_5_door_gate_rejection_safety()
    test_6_ai_system_start_and_polling()
    print("\n=======================================================")
    print("       ALL END-TO-END INTEGRATION TESTS PASSED!        ")
    print("=======================================================\n")
