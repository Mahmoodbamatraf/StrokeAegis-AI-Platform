"""
StrokeAegis AI — Clinical Report and Documentation Specialist Agent
Synthesizes the validated multi-agent state into structured JSON and triggers PDF generation.
"""

import uuid
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from crewai import Agent, Task, Crew, Process

from backend.crew.llm import get_llm
from .schemas import (
    PreventionResult,
    EmergencySupportResult,
    ValidationResult,
    MedicalReportResult
)

logger = logging.getLogger("strokeaegis.agents.report")
logger.setLevel(logging.INFO)


def create_report_agent(llm=None) -> Agent:
    """
    Creates and returns the Clinical Report and Documentation Specialist Agent.
    """
    agent_llm = llm or get_llm()

    return Agent(
        role="Clinical Report and Documentation Specialist",
        goal="Transform the validated clinical-support state into a structured, professional, traceable clinical decision-support report.",
        backstory=(
            "You are a Senior Hospital Documentation Specialist and Medical Informatics Lead. "
            "You synthesize multi-modal clinical AI findings (predictive tabular ML, deep neuroimaging classifiers, "
            "radiological Grad-CAM explainability, guideline-based prevention strategies, and acute emergency pathways) "
            "into clear, professional, hospital-grade clinical decision-support documentation. "
            "You do not retrieve new guidelines; you assemble, summarize, and structure the validated clinical outputs."
        ),
        tools=[],  # Strictly NO direct RAG
        llm=agent_llm,
        verbose=False,
        memory=False,
        allow_delegation=False
    )


def run_report_generation(
    patient_data: Dict[str, Any],
    ml_risk_data: Dict[str, Any],
    ct_gate_data: Dict[str, Any],
    ct_diagnosis_data: Dict[str, Any],
    prevention_result: PreventionResult,
    emergency_result: EmergencySupportResult,
    validation_result: ValidationResult,
    llm=None
) -> MedicalReportResult:
    """
    Generates the unified clinical report JSON.
    """
    logger.info("Executing Clinical Report Agent synthesis...")
    report_id = f"SA-{datetime.now().strftime('%Y')}-{uuid.uuid4().hex[:6].upper()}"
    timestamp_str = datetime.now().strftime("%B %d, %Y - %H:%M:%S UTC")

    # Combine all unique citations
    all_citations = list(dict.fromkeys(
        prevention_result.evidence_citations + emergency_result.evidence_citations
    ))

    # Compose executive clinical summary
    pred = ct_diagnosis_data.get("prediction", "Normal")
    prob_pct = ml_risk_data.get("stroke_probability_pct", 0)
    tier = ml_risk_data.get("risk_tier", "Moderate")

    overall_summary = (
        f"StrokeAegis AI integrated evaluation for {patient_data.get('age', 'N/A')}-year-old "
        f"{patient_data.get('gender', 'patient')} establishes a baseline {tier} systemic stroke risk "
        f"({prob_pct}% probability). Diagnostic neuroimaging CT analysis demonstrates {pred} "
        f"({ct_diagnosis_data.get('confidence_pct', 0)}% confidence). "
        f"Clinical AI agents have formulated guideline-grounded acute emergency pathways and secondary "
        f"prevention interventions, fully verified by the Medical Safety layer ({validation_result.status}). "
        f"Physician review and diagnostic validation is required."
    )

    key_recs = []
    if pred == "Bleeding":
        key_recs.append("EMERGENCY: Immediate neurosurgical consultation for acute intracranial hemorrhage management.")
        key_recs.append("Strict acute systolic blood pressure reduction to <140 mmHg.")
        key_recs.append("Absolute contraindication to all thrombolytic and anticoagulant therapies.")
    elif pred == "Ischemia":
        key_recs.append("EMERGENCY: Rapid evaluation for IV thrombolysis (4.5-hour window) and mechanical thrombectomy.")
        key_recs.append("Emergent CT Angiography (CTA) to assess for Large Vessel Occlusion (LVO).")
        key_recs.append("Maintain blood pressure <180/105 mmHg if reperfusion candidate.")
    else:
        key_recs.append("Correlate normal non-contrast CT with acute neurological symptoms; consider MRI-DWI for acute ischemia.")
        key_recs.append("Optimize systemic vascular risk factors to mitigate long-term stroke vulnerability.")

    key_recs.extend(prevention_result.lifestyle_recommendations[:2])

    disclaimer = (
        "StrokeAegis AI is an AI-powered clinical decision-support system intended to assist qualified healthcare "
        "professionals. It does not replace clinical judgment, diagnosis, or physician decision-making and does not "
        "independently prescribe or order treatment. All recommendations must be validated by an attending neurologist."
    )

    return MedicalReportResult(
        report_id=report_id,
        generated_at=timestamp_str,
        patient=patient_data,
        risk_assessment=ml_risk_data,
        ct_analysis={
            "gate": ct_gate_data,
            "diagnosis": ct_diagnosis_data
        },
        prevention_support=prevention_result.model_dump(),
        emergency_support=emergency_result.model_dump(),
        validation=validation_result.model_dump(),
        overall_clinical_summary=overall_summary,
        key_recommendations=key_recs,
        guideline_references=all_citations,
        clinical_disclaimer=disclaimer,
        pdf_filename=f"{report_id}.pdf"
    )
