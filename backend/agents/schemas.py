"""
StrokeAegis AI — Structured Clinical Agent Schemas
Defines structured Pydantic models for all agent inputs, outputs, validation checks, and reports.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class GuidelineEvidence(BaseModel):
    """Structured medical guideline evidence citation."""
    source: str = Field(..., description="Issuing organization (e.g. AHA/ASA, ESO, NICE, WHO)")
    guideline: str = Field(..., description="Guideline title")
    year: Optional[int] = Field(None, description="Publication or revision year")
    page: Optional[int] = Field(None, description="Page number in guideline")
    section: Optional[str] = Field(None, description="Section or chapter title")
    text: str = Field(..., description="Verbatim recommendation text")
    citation: str = Field(..., description="Standardized citation string")


class PreventionResult(BaseModel):
    """Structured output from the Stroke Prevention Clinical Specialist Agent."""
    risk_interpretation: str = Field(
        ...,
        description="Comprehensive clinical interpretation of the patient's ML stroke risk probability and key risk factors."
    )
    patient_risk_summary: str = Field(
        ...,
        description="Brief narrative summary of the patient's individual vascular profile."
    )
    lifestyle_recommendations: List[str] = Field(
        default_factory=list,
        description="Actionable, guideline-backed lifestyle and behavioral modifications."
    )
    blood_pressure_guidance: str = Field(
        ...,
        description="Evidence-based blood pressure targets and monitoring strategies."
    )
    glycemic_guidance: str = Field(
        ...,
        description="Glycemic control recommendations (HbA1c targets and diet/medication guidance)."
    )
    lipid_and_antiplatelet_guidance: str = Field(
        ...,
        description="Guideline considerations for lipid management (statins) and antiplatelet prophylaxis."
    )
    evidence_citations: List[str] = Field(
        default_factory=list,
        description="Traceable guideline citations backing these recommendations."
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Clinical alerts or precautions identified for this patient."
    )
    requires_clinician_review: bool = Field(
        default=True,
        description="Flag indicating this AI decision support requires physician sign-off."
    )


class EmergencySupportResult(BaseModel):
    """Structured output from the Acute Stroke Clinical Support Specialist Agent."""
    acute_clinical_summary: str = Field(
        ...,
        description="Immediate clinical summary of the CT scan findings and urgency stratification."
    )
    detected_stroke_type: str = Field(
        ...,
        description="'Ischemic Stroke', 'Hemorrhagic Stroke', or 'Normal / Non-Pathological'."
    )
    hyperacute_management: List[str] = Field(
        default_factory=list,
        description="Prioritized emergency clinical actions (ABCs, IV access, non-contrast CT review)."
    )
    thrombolysis_eligibility_considerations: str = Field(
        ...,
        description="Guidelines on IV Alteplase/Tenecteplase. Must explicitly state CONTRAINDICATED in hemorrhage."
    )
    mechanical_thrombectomy_considerations: str = Field(
        ...,
        description="Criteria for endovascular thrombectomy (LVO screening, time windows up to 24 hours)."
    )
    blood_pressure_management: str = Field(
        ...,
        description="Target blood pressure ranges specific to ischemic vs. hemorrhagic presentations."
    )
    monitoring_and_neurosurgical_actions: List[str] = Field(
        default_factory=list,
        description="ICU neuro-monitoring, ICP management, and neurosurgical consult triggers."
    )
    contraindication_flags: List[str] = Field(
        default_factory=list,
        description="Strict contraindications (e.g. antiplatelets/thrombolytics in acute bleeding)."
    )
    evidence_citations: List[str] = Field(
        default_factory=list,
        description="Authoritative guideline citations for acute emergency recommendations."
    )
    requires_clinician_review: bool = Field(
        default=True,
        description="Flag indicating this acute guidance requires emergency physician/neurologist decision."
    )


class ValidationResult(BaseModel):
    """Structured output from the Medical Safety and Validation Agent."""
    status: str = Field(
        ...,
        description="'PASSED', 'PASSED_WITH_WARNINGS', or 'FAILED'."
    )
    safety_check: str = Field(
        ...,
        description="'PASSED' or 'FAILED'."
    )
    contradictions_detected: List[str] = Field(
        default_factory=list,
        description="List of clinical contradictions identified across agent outputs."
    )
    logical_consistency_checks: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Detailed results of consistency evaluations."
    )
    citation_audit: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Verification audit of guideline citations."
    )
    non_autonomy_verified: bool = Field(
        default=True,
        description="Verified that outputs do not prescribe autonomously or replace clinician judgement."
    )
    critical_issues: List[str] = Field(
        default_factory=list,
        description="Severe clinical safety breaches requiring immediate intervention."
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Non-critical warnings or clinical considerations."
    )
    clinician_signoff_required: bool = Field(
        default=True,
        description="Mandatory requirement for clinician review."
    )


class MedicalReportResult(BaseModel):
    """Structured final unified clinical decision support report."""
    report_id: str = Field(..., description="Unique report identifier e.g. SA-2026-XXXX")
    generated_at: str = Field(..., description="ISO timestamp or formatted date")
    patient: Dict[str, Any] = Field(..., description="Patient demographic and vitals data")
    risk_assessment: Dict[str, Any] = Field(..., description="ML risk prediction results and metrics")
    ct_analysis: Dict[str, Any] = Field(..., description="Gatekeeper and CT classifier results")
    prevention_support: Dict[str, Any] = Field(..., description="Prevention agent findings and guidance")
    emergency_support: Dict[str, Any] = Field(..., description="Emergency agent findings and guidance")
    validation: Dict[str, Any] = Field(..., description="Medical safety validation results")
    overall_clinical_summary: str = Field(..., description="Integrated clinical executive summary")
    key_recommendations: List[str] = Field(default_factory=list, description="Top prioritized clinical actions")
    guideline_references: List[str] = Field(default_factory=list, description="Traceable guideline citations")
    clinical_disclaimer: str = Field(..., description="Official decision-support legal and clinical disclaimer")
    pdf_filename: Optional[str] = Field(None, description="Generated PDF report filename")


class AgentProgressEvent(BaseModel):
    """Event schema for real-time SSE progress streaming."""
    pipeline_id: str = Field(..., description="Pipeline execution instance ID")
    agent: str = Field(..., description="Agent key: 'prevention', 'emergency', 'validation', 'report', 'pipeline'")
    status: str = Field(..., description="Status: 'waiting', 'working', 'completed', 'failed'")
    message: str = Field(..., description="Human-readable activity description for UI and Robot")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Optional payload")
