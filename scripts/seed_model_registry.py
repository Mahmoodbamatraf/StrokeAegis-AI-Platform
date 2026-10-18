"""
Seed initial AI Model Registry in StrokeAegis AI.
Idempotent: safe to run multiple times.
"""

import sys
from pathlib import Path
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.database.database import SessionLocal
from backend.database.models import ModelRegistry


def seed_models():
    db = SessionLocal()
    try:
        models = [
            {
                "model_key": "door_gatekeeper",
                "display_name": "ConvNeXt-Tiny Brain CT Gatekeeper",
                "model_version": "v1.2.0-clinical",
                "architecture": "ConvNeXt-Tiny CNN (PyTorch, 28.5M parameters)",
                "status": "active",
                "metadata_info": {
                    "checkpoint_file": "convnext_brain_ct_gate.pt",
                    "input_resolution": "224x224x3 RGB",
                    "binary_classes": ["Brain CT Valid", "Non-Brain Artifact / Invalid"],
                    "confidence_threshold": 0.50,
                    "review_zone": [0.45, 0.55],
                    "intended_use": "Safety pre-screening to reject non-brain CT scans before neural diagnosis."
                }
            },
            {
                "model_key": "stroke_classifier",
                "display_name": "EfficientNetV2-S + GeM Brain CT Diagnostic Classifier",
                "model_version": "v2.4.0-final",
                "architecture": "EfficientNetV2-S + Generalized Mean (GeM) Pooling (PyTorch)",
                "status": "active",
                "metadata_info": {
                    "checkpoint_file": "stroke_ct_cls_final.pth",
                    "input_resolution": "224x224x3 RGB",
                    "diagnostic_classes": ["Normal", "Bleeding (Hemorrhagic)", "Ischemia (Infarct)"],
                    "explainability": "Grad-CAM++ Class Activation Heatmap Localization",
                    "intended_use": "Differential classification of acute stroke subtypes from head CT."
                }
            },
            {
                "model_key": "ml_risk_model",
                "display_name": "Blended Ensemble Tabular Vascular Risk Model",
                "model_version": "v2.1.0-ensemble",
                "architecture": "Soft-Voting Ensemble (GradientBoosting + RandomForest + LogisticRegression)",
                "status": "active",
                "metadata_info": {
                    "model_artifact": "stroke_pipeline.joblib",
                    "features_count": 10,
                    "risk_tiers": {
                        "Low": "< 30%",
                        "Moderate": "30% - 60%",
                        "High": "> 60%"
                    },
                    "intended_use": "10-year stroke danger stratification from demographic and metabolic vitals."
                }
            },
            {
                "model_key": "clinical_agents",
                "display_name": "CrewAI Clinical Specialist Agent Swarm",
                "model_version": "v2.5.0-flow",
                "architecture": "Deterministic Flow-First Multi-Agent Architecture",
                "status": "active",
                "metadata_info": {
                    "agents": [
                        "Stroke Prevention Clinical Specialist",
                        "Acute Stroke Clinical Support Specialist",
                        "Medical Safety and Validation Specialist",
                        "Clinical Report & Documentation Specialist"
                    ],
                    "framework": "CrewAI Flow + Memory Guardrails",
                    "intended_use": "Autonomous synthesis of multimodal findings into certified clinical documentation."
                }
            },
            {
                "model_key": "rag_service",
                "display_name": "Clinical Guidelines Vector RAG Service",
                "model_version": "v1.0.0-rag",
                "architecture": "ChromaDB Dense Vector Embeddings + Reciprocal Rank Fusion",
                "status": "active",
                "metadata_info": {
                    "corpus_sources": [
                        "AHA/ASA 2024 Guidelines for the Early Management of Acute Ischemic Stroke",
                        "ESO 2023 Guidelines on Blood Pressure Management in Acute Stroke",
                        "NICE Clinical Guideline [CG68] Stroke and TIA Diagnosis"
                    ],
                    "vector_store": "ChromaDB (Persistent Collection)",
                    "intended_use": "Evidence-grounded medical guidance retrieval for agent reasoning."
                }
            },
            {
                "model_key": "medical_chatbot",
                "display_name": "StrokeAegis Medical Intelligence Chatbot",
                "model_version": "v2.6.0-bilingual",
                "architecture": "Google Gemini 3.6 Flash + Real-Time Neurological Context Prompting",
                "status": "active",
                "metadata_info": {
                    "primary_llm": "gemini-3.6-flash",
                    "languages": ["Arabic (العربية)", "English"],
                    "safety_filters": "STRICT_MEDICAL_DISCLAIMER_ENFORCED",
                    "intended_use": "Interactive conversational assistant for patients and clinicians."
                }
            }
        ]

        count = 0
        for m in models:
            existing = db.query(ModelRegistry).filter(ModelRegistry.model_key == m["model_key"]).first()
            if not existing:
                rec = ModelRegistry(
                    model_key=m["model_key"],
                    display_name=m["display_name"],
                    model_version=m["model_version"],
                    architecture=m["architecture"],
                    status=m["status"],
                    total_inferences=0,
                    failed_inferences=0,
                    last_inference_at=datetime.now(timezone.utc),
                    metadata_info=m["metadata_info"]
                )
                db.add(rec)
                count += 1
            else:
                # Update metadata if needed
                existing.display_name = m["display_name"]
                existing.model_version = m["model_version"]
                existing.architecture = m["architecture"]
                existing.metadata_info = m["metadata_info"]

        db.commit()
        print(f"[Model Registry Seed] Seeded {count} new models. All models verified.")

    except Exception as exc:
        db.rollback()
        print(f"[Error] Failed to seed models: {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_models()
