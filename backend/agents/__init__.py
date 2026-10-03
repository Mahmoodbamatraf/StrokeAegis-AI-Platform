"""StrokeAegis AI — Clinical AI Agents Package."""
from .schemas import (
    GuidelineEvidence,
    PreventionResult,
    EmergencySupportResult,
    ValidationResult,
    MedicalReportResult,
    AgentProgressEvent
)
from .prevention_agent import create_prevention_agent, run_prevention_analysis
from .emergency_agent import create_emergency_agent, run_emergency_analysis
from .validation_agent import create_validation_agent, run_validation_analysis
from .report_agent import create_report_agent, run_report_generation

__all__ = [
    "GuidelineEvidence",
    "PreventionResult",
    "EmergencySupportResult",
    "ValidationResult",
    "MedicalReportResult",
    "AgentProgressEvent",
    "create_prevention_agent",
    "run_prevention_analysis",
    "create_emergency_agent",
    "run_emergency_analysis",
    "create_validation_agent",
    "run_validation_analysis",
    "create_report_agent",
    "run_report_generation"
]
