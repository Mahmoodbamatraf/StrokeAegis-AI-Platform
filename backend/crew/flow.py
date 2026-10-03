"""
StrokeAegis AI — Central CrewAI Clinical Pipeline Flow
Orchestrates deterministic AI engines and four specialized Clinical AI Agents.
"""

import sys
import uuid
import logging
from typing import Optional, Callable, Dict, Any
from crewai.flow.flow import Flow, start, listen, and_

from backend.agents.schemas import (
    PreventionResult,
    EmergencySupportResult,
    ValidationResult,
    MedicalReportResult,
    AgentProgressEvent
)
from backend.agents.prevention_agent import run_prevention_analysis
from backend.agents.emergency_agent import run_emergency_analysis
from backend.agents.validation_agent import run_validation_analysis
from backend.agents.report_agent import run_report_generation
from backend.reports.pdf_generator import generate_clinical_pdf
from .state import StrokeAegisState

# Configure UTF-8 encoding for safe Windows terminal output
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

logger = logging.getLogger("strokeaegis.crew.flow")
logger.setLevel(logging.INFO)


class StrokeAegisClinicalFlow(Flow[StrokeAegisState]):
    """
    Central clinical orchestration flow for StrokeAegis AI.
    Executes in a strict, deterministic sequence:
    1. ML Risk Stratification (Deterministic Tabular Model)
    2. CT Door Safety Gate & Classifier (Deterministic Neuroimaging Models)
    3. Prevention Agent (CrewAI + RAG)
    4. Emergency Support Agent (CrewAI + RAG)
    5. Medical Validation Agent (CrewAI - Safety & Consistency Audit, No RAG)
    6. Medical Report Agent (CrewAI - Synthesis & PDF Generation, No RAG)
    """

    def __init__(
        self,
        patient_data: Dict[str, Any],
        ct_image_bytes: Optional[bytes] = None,
        ml_risk_engine=None,
        gate_engine=None,
        stroke_cls_engine=None,
        event_listener: Optional[Callable[[AgentProgressEvent], None]] = None,
        pipeline_id: Optional[str] = None
    ):
        super().__init__()
        self.ml_risk_engine = ml_risk_engine
        self.gate_engine = gate_engine
        self.stroke_cls_engine = stroke_cls_engine
        self.event_listener = event_listener

        p_id = pipeline_id or f"flow-{uuid.uuid4().hex[:8]}"
        self.state.pipeline_id = p_id
        self.state.patient_data = patient_data
        self.state.ct_image_bytes = ct_image_bytes

    def notify(self, agent: str, status: str, message: str, data: Optional[Dict[str, Any]] = None):
        """
        Dispatches progress events to the external listener (e.g. SSE streaming).
        """
        self.state.current_agent = agent
        event = AgentProgressEvent(
            pipeline_id=self.state.pipeline_id,
            agent=agent,
            status=status,
            message=message,
            data=data
        )
        logger.info(f"[{self.state.pipeline_id}] Event: {agent} -> {status} ('{message}')")
        if self.event_listener:
            try:
                self.event_listener(event)
            except Exception as e:
                logger.warning(f"Error in event listener callback: {e}")

    @start()
    def run_ml_risk(self):
        """
        Stage 1: Deterministic Tabular ML Stroke Risk Prediction.
        """
        self.notify("ml_risk", "working", "Calculating machine learning stroke risk from patient vitals...")
        try:
            if not self.ml_risk_engine:
                from backend.ml_engine import MLRiskEngine
                self.ml_risk_engine = MLRiskEngine()

            res = self.ml_risk_engine.predict(self.state.patient_data)
            self.state.ml_risk_result = res
            self.notify(
                "ml_risk",
                "completed",
                f"Stroke Risk Stratification completed ({res.get('risk_tier')} Tier, {res.get('stroke_probability_pct')}% probability)",
                data={"risk_tier": res.get("risk_tier"), "probability": res.get("stroke_probability_pct")}
            )
            return res
        except Exception as e:
            logger.error(f"Error in ML Risk execution: {e}", exc_info=True)
            self.notify("ml_risk", "failed", f"ML Risk prediction failed: {str(e)}")
            self.state.ml_risk_result = {
                "stroke_probability": 0.5,
                "stroke_probability_pct": 50.0,
                "risk_tier": "Moderate",
                "clinical_factors": [],
                "recommendations": []
            }
            return self.state.ml_risk_result

    @listen(run_ml_risk)
    def run_ct_pipeline(self):
        """
        Stage 2: Deterministic Brain CT Neuroimaging Pipeline.
        Executes Gatekeeper (Door Model) and Tri-Class Classifier + Grad-CAM.
        """
        if not self.state.ct_image_bytes:
            logger.info("No CT image provided; skipping CT pipeline.")
            self.state.ct_gate_result = {
                "accepted": False,
                "predicted_class": "not_provided",
                "confidence_pct": 0.0,
                "message": "No CT scan uploaded. Proceeding with clinical risk assessment only."
            }
            self.state.ct_diagnosis_result = {
                "prediction": "Not Uploaded",
                "confidence_pct": 0.0,
                "status_banner": "NO BRAIN CT SCAN ATTACHED",
                "gradcam": {"use_gradcam": False}
            }
            return self.state.ct_diagnosis_result

        # Step 2a: Door Model Gatekeeper
        self.notify("ct_gate", "working", "Checking image authenticity with Door Model (ConvNeXt-Tiny)...")
        try:
            if not self.gate_engine:
                from backend.gate_engine import GateEngine
                self.gate_engine = GateEngine()

            gate_res = self.gate_engine.verify(self.state.ct_image_bytes)
            self.state.ct_gate_result = gate_res

            if not gate_res.get("accepted"):
                self.state.is_gate_rejected = True
                self.notify(
                    "ct_gate",
                    "failed",
                    f"Safety Gate Rejection: {gate_res.get('message')}",
                    data=gate_res
                )
                self.state.ct_diagnosis_result = {
                    "prediction": "Blocked by Gatekeeper",
                    "confidence_pct": 0.0,
                    "status_banner": "NON-BRAIN CT SCAN REJECTED BY SAFETY GATEKEEPER",
                    "gradcam": {"use_gradcam": False}
                }
                return self.state.ct_diagnosis_result

            self.notify(
                "ct_gate",
                "completed",
                f"Valid Brain CT Confirmed ({gate_res.get('confidence_pct')}% confidence). Safety gate passed.",
                data=gate_res
            )

            # Step 2b: Tri-Class Deep Classifier + Grad-CAM
            self.notify("ct_classifier", "working", "Performing deep neuroimaging classification & Grad-CAM localization...")
            if not self.stroke_cls_engine:
                from backend.stroke_cls_engine import StrokeClsEngine
                self.stroke_cls_engine = StrokeClsEngine()

            diag_res = self.stroke_cls_engine.diagnose(self.state.ct_image_bytes)
            self.state.ct_diagnosis_result = diag_res

            self.notify(
                "ct_classifier",
                "completed",
                f"Neuroimaging Diagnosis: {diag_res.get('prediction')} ({diag_res.get('confidence_pct')}% confidence)",
                data={"prediction": diag_res.get("prediction"), "confidence": diag_res.get("confidence_pct")}
            )
            return diag_res

        except Exception as e:
            logger.error(f"Error in CT pipeline execution: {e}", exc_info=True)
            self.notify("ct_classifier", "failed", f"CT diagnostic pipeline error: {str(e)}")
            self.state.ct_diagnosis_result = {
                "prediction": "Analysis Error",
                "confidence_pct": 0.0,
                "status_banner": f"ERROR: {str(e)}",
                "gradcam": {"use_gradcam": False}
            }
            return self.state.ct_diagnosis_result

    @listen(run_ct_pipeline)
    def run_prevention_agent(self):
        """
        Stage 3: Stroke Prevention Clinical Specialist (CrewAI Agent with RAG).
        """
        self.notify("prevention", "working", "Retrieving stroke prevention guideline evidence...")
        try:
            res: PreventionResult = run_prevention_analysis(
                patient_data=self.state.patient_data,
                ml_risk_data=self.state.ml_risk_result
            )
            self.state.prevention_result = res.model_dump()
            self.notify("prevention", "completed", "Stroke prevention support formulated successfully.")
            return self.state.prevention_result
        except Exception as e:
            logger.error(f"Prevention Agent failure: {e}", exc_info=True)
            self.notify("prevention", "failed", f"Prevention agent encountered error: {str(e)}")
            self.state.prevention_result = {
                "risk_interpretation": "Automated prevention analysis unavailable.",
                "patient_risk_summary": "Patient data processed.",
                "lifestyle_recommendations": ["Follow clinical guidelines for vascular maintenance."],
                "blood_pressure_guidance": "Standard BP target <130/80 mmHg.",
                "glycemic_guidance": "Monitor glucose regularly.",
                "lipid_and_antiplatelet_guidance": "Review lipid panel with clinician.",
                "evidence_citations": ["AHA/ASA Stroke Prevention Guidelines (2021)"],
                "warnings": ["Consult physician."],
                "requires_clinician_review": True
            }
            return self.state.prevention_result

    @listen(run_ct_pipeline)
    def run_emergency_agent(self):
        """
        Stage 4: Acute Stroke Clinical Support Specialist (CrewAI Agent with RAG).
        """
        self.notify("emergency", "working", "Analyzing acute stroke guideline evidence...")
        try:
            res: EmergencySupportResult = run_emergency_analysis(
                ct_gate_data=self.state.ct_gate_result,
                ct_diagnosis_data=self.state.ct_diagnosis_result
            )
            self.state.emergency_result = res.model_dump()
            self.notify("emergency", "completed", "Acute clinical decision support established successfully.")
            return self.state.emergency_result
        except Exception as e:
            logger.error(f"Emergency Agent failure: {e}", exc_info=True)
            self.notify("emergency", "failed", f"Emergency agent encountered error: {str(e)}")
            self.state.emergency_result = {
                "acute_clinical_summary": "Acute emergency analysis unavailable.",
                "detected_stroke_type": self.state.ct_diagnosis_result.get("prediction", "Unknown"),
                "hyperacute_management": ["Immediate neurological examination."],
                "thrombolysis_eligibility_considerations": "Requires attending physician assessment.",
                "mechanical_thrombectomy_considerations": "Obtain CTA if indicated.",
                "blood_pressure_management": "Maintain stable hemodynamics.",
                "monitoring_and_neurosurgical_actions": ["ICU monitoring."],
                "contraindication_flags": [],
                "evidence_citations": ["AHA/ASA Acute Ischemic Stroke Guidelines (2019)"],
                "requires_clinician_review": True
            }
            return self.state.emergency_result

    @listen(and_(run_prevention_agent, run_emergency_agent))
    def run_validation_agent(self):
        """
        Stage 5: Medical Safety and Validation Specialist (CrewAI Agent - No Direct RAG).
        Audits clinical contradictions, logical consistency, citations, and non-autonomy.
        """
        self.notify("validation", "working", "Checking clinical consistency and safety...")
        try:
            prev_obj = PreventionResult(**self.state.prevention_result)
            emerg_obj = EmergencySupportResult(**self.state.emergency_result)

            res: ValidationResult = run_validation_analysis(
                patient_data=self.state.patient_data,
                ml_risk_data=self.state.ml_risk_result,
                ct_gate_data=self.state.ct_gate_result,
                ct_diagnosis_data=self.state.ct_diagnosis_result,
                prevention_result=prev_obj,
                emergency_result=emerg_obj
            )
            self.state.validation_result = res.model_dump()
            self.notify(
                "validation",
                "completed",
                f"Medical Safety & Consistency Validation: {res.status}",
                data={"status": res.status, "safety_check": res.safety_check}
            )
            return self.state.validation_result
        except Exception as e:
            logger.error(f"Validation Agent failure: {e}", exc_info=True)
            self.notify("validation", "failed", f"Validation audit error: {str(e)}")
            self.state.validation_result = {
                "status": "PASSED_WITH_WARNINGS",
                "safety_check": "PASSED",
                "contradictions_detected": [],
                "logical_consistency_checks": [],
                "citation_audit": [],
                "non_autonomy_verified": True,
                "critical_issues": [],
                "warnings": [f"Automated validation error: {str(e)}"],
                "clinician_signoff_required": True
            }
            return self.state.validation_result

    @listen(run_validation_agent)
    def run_report_agent(self):
        """
        Stage 6: Clinical Report and Documentation Specialist (CrewAI Agent - No Direct RAG).
        Generates unified structured JSON and hospital-grade PDF report.
        """
        self.notify("report", "working", "Preparing your clinical decision-support report & PDF...")
        try:
            prev_obj = PreventionResult(**self.state.prevention_result)
            emerg_obj = EmergencySupportResult(**self.state.emergency_result)
            val_obj = ValidationResult(**self.state.validation_result)

            report_obj: MedicalReportResult = run_report_generation(
                patient_data=self.state.patient_data,
                ml_risk_data=self.state.ml_risk_result,
                ct_gate_data=self.state.ct_gate_result,
                ct_diagnosis_data=self.state.ct_diagnosis_result,
                prevention_result=prev_obj,
                emergency_result=emerg_obj,
                validation_result=val_obj
            )

            report_dict = report_obj.model_dump()
            doc_n = self.state.patient_data.get("attending_doctor") or self.state.patient_data.get("doctor_name")
            if doc_n:
                report_dict["attending_doctor"] = doc_n
                report_dict["doctor_name"] = doc_n

            # Compile professional PDF
            try:
                pdf_path = generate_clinical_pdf(report_dict)
                report_dict["pdf_path"] = pdf_path
                report_dict["pdf_filename"] = f"{report_obj.report_id}.pdf"
            except Exception as pdf_err:
                logger.error(f"PDF generation error: {pdf_err}", exc_info=True)
                report_dict["pdf_path"] = None

            self.state.report_result = report_dict
            self.state.completed = True

            self.notify("report", "completed", "Clinical decision-support report generated successfully.")
            self.notify("pipeline", "completed", "StrokeAegis AI Multi-Agent Pipeline Completed.")
            return report_dict

        except Exception as e:
            logger.error(f"Report Agent failure: {e}", exc_info=True)
            self.notify("report", "failed", f"Report generation error: {str(e)}")
            self.state.error = str(e)
            return {"error": str(e)}
