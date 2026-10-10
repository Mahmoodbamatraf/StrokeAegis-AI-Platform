import os
import sys
import json
import base64
import logging
from pathlib import Path
from typing import Optional, Dict, Any

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from pydantic import BaseModel

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
FRONTEND_DIR = PROJECT_ROOT / 'frontend'
ASSETS_DIR = PROJECT_ROOT / 'assets'
REPORTS_DIR = CURRENT_DIR / 'generated_reports'
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Ensure project root and backend are in sys.path
for p in [str(PROJECT_ROOT), str(CURRENT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Load .env if present
env_path = PROJECT_ROOT / '.env'
if env_path.exists():
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip()

# Set Google Gemini API key for clinical agents if not in environment
if not os.environ.get("GEMINI_API_KEY"):
    os.environ["GEMINI_API_KEY"] = os.environ.get("STROKE_AEGIS_AGENT_API_KEY", "")

# Dedicated Chatbot API key (completely separate from clinical agents)
if not os.environ.get("STROKE_AEGIS_CHATBOT_API_KEY"):
    os.environ["STROKE_AEGIS_CHATBOT_API_KEY"] = os.environ.get("GEMINI_API_KEY", "")

# Deterministic Engine Imports
from gate_engine import GateEngine
from stroke_cls_engine import StrokeClsEngine
from ml_engine import MLRiskEngine

# Clinical Agents and Flow
from backend.agents.schemas import (
    PreventionResult,
    EmergencySupportResult,
    ValidationResult,
    MedicalReportResult
)
from backend.agents.prevention_agent import run_prevention_analysis
from backend.agents.emergency_agent import run_emergency_analysis
from backend.agents.validation_agent import run_validation_analysis
from backend.agents.report_agent import run_report_generation
from backend.crew.flow import StrokeAegisClinicalFlow
from backend.orchestration.pipeline_manager import pipeline_manager
from backend.reports.pdf_generator import generate_clinical_pdf

logger = logging.getLogger("strokeaegis.app")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="StrokeAegis AI — Multi-Agent Clinical Decision Support",
    description="Integrated AI Pipeline with ConvNeXt-Tiny Gate, EfficientNetV2-S Classifier, Blended ML Risk, and CrewAI Clinical Agents",
    version="2.5.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path.lower()
    if path.endswith((".js", ".css", ".html")) or path in ("/", ""):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    messages = []
    for err in errors:
        loc = err.get("loc", [])
        field = loc[-1] if loc else "field"
        field_name = str(field).replace("_", " ").title()
        msg = err.get("msg", "Invalid value")

        # Friendly customization for common fields
        if "at least 6 characters" in msg and field == "password":
            messages.append("Password must be at least 6 characters long.")
        elif field == "email":
            messages.append("Please provide a valid email address (e.g., name@example.com).")
        elif "at least" in msg and field == "license_number":
            messages.append("Medical license number is required.")
        elif "at least 2 characters" in msg and field == "full_name":
            messages.append("Full name must be at least 2 characters.")
        elif field == "date_of_birth":
            messages.append("Date of birth format is invalid. Please select a valid date.")
        else:
            messages.append(f"{field_name}: {msg}")

    friendly_detail = " ".join(messages) if messages else "Invalid input data provided."
    return JSONResponse(
        status_code=422,
        content={"detail": friendly_detail, "errors": errors}
    )

# Authentication & User Management Router (Phase 1 Foundation)
from backend.auth.router import router as auth_router
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])

# Clinical Decision Support & Role Dashboards Router (Phase 2)
from backend.clinical.router import router as clinical_router
app.include_router(clinical_router, prefix="/api/clinical-portal", tags=["Clinical Portal"])

print("[Server] Initializing deterministic AI models...")
gate_engine = GateEngine()
stroke_cls_engine = StrokeClsEngine()
ml_risk_engine = MLRiskEngine()
print("[Server] All AI engines ready.")


class PatientInput(BaseModel):
    gender: str = "Male"
    age: float = 67.0
    hypertension: int = 0
    heart_disease: int = 1
    ever_married: str = "Yes"
    work_type: str = "Private"
    Residence_type: str = "Urban"
    avg_glucose_level: float = 228.69
    bmi: float = 36.6
    smoking_status: str = "formerly smoked"


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "system": "StrokeAegis AI",
        "tagline": "AI-Powered Stroke Reporting & Integrated Solutions",
        "architecture": "Flow-First CrewAI Multi-Agent + Deterministic DL/ML",
        "models": {
            "door_gatekeeper": "ConvNeXt-Tiny (convnext_brain_ct_gate.pt)",
            "stroke_classifier": "EfficientNetV2-S + GeM (stroke_ct_cls_final.pth)",
            "ml_risk_model": "StrokePrediction-V2 Blended Ensemble (.joblib)",
            "clinical_agents": [
                "Stroke Prevention Clinical Specialist (CrewAI + RAG)",
                "Acute Stroke Clinical Support Specialist (CrewAI + RAG)",
                "Medical Safety and Validation Specialist (CrewAI)",
                "Clinical Report & Documentation Specialist (CrewAI)"
            ],
            "llm": "Google Gemini (gemini-3.6-flash)"
        }
    }


@app.get("/api/presets")
def get_presets():
    samples_dir = PROJECT_ROOT / "sample_scans"
    ct_presets = []

    preset_configs = [
        {
            "id": "bleeding",
            "name": "Acute Bleeding (Hemorrhagic Stroke)",
            "filename": "bleeding_sample.png",
            "expected_gate": "accept",
            "expected_diagnosis": "Bleeding",
            "description": "High-density hyperattenuation indicating acute intracranial hemorrhage."
        },
        {
            "id": "ischemia",
            "name": "Acute Ischemic Infarct",
            "filename": "ischemia_sample.png",
            "expected_gate": "accept",
            "expected_diagnosis": "Ischemia",
            "description": "Hypodense tissue loss and sulcal effacement consistent with cerebral ischemia."
        },
        {
            "id": "normal",
            "name": "Normal Non-Pathological Brain CT",
            "filename": "normal_sample.png",
            "expected_gate": "accept",
            "expected_diagnosis": "Normal",
            "description": "Preserved ventricular symmetry and absence of acute territorial pathology."
        },
        {
            "id": "non_brain",
            "name": "Non-Brain CT Rejection Test",
            "filename": "non_brain_rejection_sample.png",
            "expected_gate": "reject",
            "expected_diagnosis": "Blocked by Gatekeeper",
            "description": "Non-brain input to demonstrate Door Model clinical safety rejection."
        }
    ]

    for cfg in preset_configs:
        file_path = samples_dir / cfg["filename"]
        if file_path.exists():
            with open(file_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            ct_presets.append({
                **cfg,
                "preview_base64": f"data:image/png;base64,{b64}"
            })

    patient_presets = [
        {
            "id": "high_risk",
            "name": "High-Risk Patient (Elderly Diabetic Cardiac)",
            "data": {
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
        },
        {
            "id": "moderate_risk",
            "name": "Moderate-Risk Patient (Hypertensive Smoker)",
            "data": {
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
        },
        {
            "id": "low_risk",
            "name": "Low-Risk Patient (Young Active Non-Smoker)",
            "data": {
                "gender": "Male",
                "age": 28.0,
                "hypertension": 0,
                "heart_disease": 0,
                "ever_married": "No",
                "work_type": "Govt_job",
                "Residence_type": "Urban",
                "avg_glucose_level": 88.4,
                "bmi": 22.4,
                "smoking_status": "never smoked"
            }
        }
    ]

    return {
        "ct_presets": ct_presets,
        "patient_presets": patient_presets
    }


# =====================================================================
# REGULAR SYSTEM ENDPOINTS (Deterministic Inference)
# =====================================================================

@app.post("/api/predict-risk")
def predict_stroke_risk(patient: PatientInput):
    """Path A: Direct Tabular ML Stroke Risk Prediction."""
    try:
        res = ml_risk_engine.predict(patient.model_dump())
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML Risk prediction error: {str(e)}")


@app.post("/api/verify-gate")
async def verify_door_gate(file: UploadFile = File(...)):
    """Gatekeeper Door Model verification."""
    try:
        contents = await file.read()
        res = gate_engine.verify(contents)
        return {"success": True, "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Door gatekeeper error: {str(e)}")


@app.post("/api/diagnose-ct")
async def diagnose_ct_pipeline(file: UploadFile = File(...)):
    """Path B: Direct Brain CT Diagnosis & Explainability."""
    try:
        contents = await file.read()
        gate_res = gate_engine.verify(contents)

        if not gate_res["accepted"]:
            return {
                "success": False,
                "gate_passed": False,
                "gate_details": gate_res,
                "message": gate_res["message"]
            }

        diag_res = stroke_cls_engine.diagnose(contents)

        return {
            "success": True,
            "gate_passed": True,
            "gate_details": gate_res,
            "diagnosis": diag_res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagnostic neuroimaging pipeline error: {str(e)}")


# =====================================================================
# OPTION 1: AI SYSTEM MULTI-AGENT PIPELINE ENDPOINTS
# =====================================================================

@app.post("/api/clinical/start-analysis")
async def start_clinical_pipeline(
    patient_json: str = Form(...),
    file: Optional[UploadFile] = File(None)
):
    """
    Launches the full AI System CrewAI Flow in the background.
    Returns pipeline_id immediately so frontend can connect to SSE stream.
    """
    try:
        patient_data = json.loads(patient_json)
        ct_bytes = await file.read() if file else None

        pipeline_id = pipeline_manager.create_and_start_pipeline(
            patient_data=patient_data,
            ct_image_bytes=ct_bytes,
            ml_risk_engine=ml_risk_engine,
            gate_engine=gate_engine,
            stroke_cls_engine=stroke_cls_engine
        )

        return {
            "success": True,
            "pipeline_id": pipeline_id,
            "stream_url": f"/api/clinical/stream/{pipeline_id}"
        }
    except Exception as e:
        logger.error(f"Error starting clinical pipeline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Pipeline start error: {str(e)}")


@app.get("/api/clinical/stream/{pipeline_id}")
async def stream_pipeline_events(pipeline_id: str):
    """
    Server-Sent Events (SSE) stream yielding real-time agent execution status,
    medical robot animation transitions, and final report payload.
    """
    return StreamingResponse(
        pipeline_manager.sse_event_generator(pipeline_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.get("/api/clinical/result/{pipeline_id}")
def get_pipeline_result(pipeline_id: str):
    """
    Polling endpoint returning status, logs, and completed report.
    """
    instance = pipeline_manager.get_instance(pipeline_id)
    if not instance:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    with instance.lock:
        return {
            "pipeline_id": pipeline_id,
            "is_done": instance.is_done,
            "error": instance.error,
            "result": instance.result,
            "events_count": len(instance.events),
            "events": [e.model_dump() for e in instance.events]
        }


@app.post("/api/clinical/complete-analysis")
async def execute_complete_analysis_sync(
    patient_json: str = Form(...),
    file: Optional[UploadFile] = File(None)
):
    """
    Synchronous end-to-end execution of the complete AI System.
    """
    try:
        patient_data = json.loads(patient_json)
        ct_bytes = await file.read() if file else None

        flow = StrokeAegisClinicalFlow(
            patient_data=patient_data,
            ct_image_bytes=ct_bytes,
            ml_risk_engine=ml_risk_engine,
            gate_engine=gate_engine,
            stroke_cls_engine=stroke_cls_engine
        )

        flow.kickoff()
        report = flow.state.report_result
        return {
            "success": True,
            "pipeline_id": flow.state.pipeline_id,
            "data": report
        }
    except Exception as e:
        logger.error(f"Complete analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Clinical analysis error: {str(e)}")


# =====================================================================
# INDEPENDENT AGENT DIRECT QUERY ENDPOINTS
# =====================================================================

@app.post("/api/agents/prevention")
def query_prevention_agent(patient: PatientInput):
    """Standalone query to the Stroke Prevention Agent."""
    try:
        ml_res = ml_risk_engine.predict(patient.model_dump())
        prev_res = run_prevention_analysis(patient.model_dump(), ml_res)
        return {"success": True, "prevention": prev_res.model_dump()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prevention agent error: {str(e)}")


@app.post("/api/agents/emergency")
async def query_emergency_agent(file: UploadFile = File(...)):
    """Standalone query to the Acute Stroke Emergency Agent."""
    try:
        contents = await file.read()
        gate_res = gate_engine.verify(contents)
        if not gate_res["accepted"]:
            diag_res = {"prediction": "Blocked by Gatekeeper", "confidence_pct": 0.0}
        else:
            diag_res = stroke_cls_engine.diagnose(contents)

        emerg_res = run_emergency_analysis(gate_res, diag_res)
        return {
            "success": True,
            "gate": gate_res,
            "diagnosis": diag_res,
            "emergency": emerg_res.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Emergency agent error: {str(e)}")


@app.get("/api/reports/download-pdf/{filename_or_id}")
def download_pdf_report(filename_or_id: str):
    """Serves the generated PDF report."""
    fname = filename_or_id if filename_or_id.endswith(".pdf") else f"{filename_or_id}.pdf"
    file_path = REPORTS_DIR / fname

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Requested PDF report does not exist.")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=fname,
        headers={"Content-Disposition": f'attachment; filename="{fname}"'}
    )


# =====================================================================
# STANDALONE MEDICAL CHATBOT ENDPOINTS (NO CREWAI, SEPARATE API KEY)
# =====================================================================
from backend.chatbot.service import chatbot_service

class ChatbotRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

@app.post("/api/chatbot")
async def chat_with_medical_assistant(req: ChatbotRequest):
    """
    Standalone Medical Chatbot endpoint.
    Guarantees:
      - ZERO CrewAI usage
      - Reuses existing Medical RAG database
      - Uses dedicated STROKE_AEGIS_CHATBOT_API_KEY
      - Strict stroke-related medical scope guard
      - Acute emergency guidance (FAST)
    """
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    
    result = await chatbot_service.answer_message(req.message.strip(), req.conversation_id)
    return {
        "success": True,
        **result
    }

@app.get("/api/chatbot/health")
def chatbot_health():
    return {
        "status": "online",
        "service": "StrokeAegis Medical Assistant",
        "model": "gemini-3.6-flash",
        "crewai": False,
        "scope_guard": "active",
        "rag_connected": True
    }


# =====================================================================
# STATIC MOUNTS & FRONTEND
# =====================================================================

# Mount assets directory (includes logo.jpg and medical_robot_transparent.svg)
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

@app.get("/")
def get_index():
    return FileResponse(FRONTEND_DIR / "index.html")

app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
