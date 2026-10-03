"""
StrokeAegis AI — Shared State for CrewAI Flow
Maintains structured pipeline state across deterministic engines and AI agents.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class StrokeAegisState(BaseModel):
    """
    Central shared state managed by StrokeAegisClinicalFlow.
    """
    pipeline_id: str = ""
    patient_data: Dict[str, Any] = Field(default_factory=dict)
    ml_risk_result: Dict[str, Any] = Field(default_factory=dict)
    ct_image_bytes: Optional[bytes] = None
    ct_gate_result: Dict[str, Any] = Field(default_factory=dict)
    ct_diagnosis_result: Dict[str, Any] = Field(default_factory=dict)
    prevention_result: Dict[str, Any] = Field(default_factory=dict)
    emergency_result: Dict[str, Any] = Field(default_factory=dict)
    validation_result: Dict[str, Any] = Field(default_factory=dict)
    report_result: Dict[str, Any] = Field(default_factory=dict)
    current_agent: str = "idle"
    is_gate_rejected: bool = False
    error: Optional[str] = None
    completed: bool = False
