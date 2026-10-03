<div align="center">

# 🧠 StrokeAegis AI — Multi-Agent Clinical Decision Support Platform
### AI-Powered Cerebrovascular Accident (Stroke) Diagnosis, Risk Stratification & Clinical Reporting

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.2%2B-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![ConvNeXt](https://img.shields.io/badge/Vision-ConvNeXt--Tiny-blue?style=for-the-badge)](https://github.com/facebookresearch/ConvNeXt)
[![EfficientNetV2](https://img.shields.io/badge/Classifier-EfficientNetV2--S-FF6F00?style=for-the-badge)](https://github.com/rwightman/pytorch-image-models)
[![CrewAI](https://img.shields.io/badge/Multi--Agent-CrewAI%20Flow-FF4B4B?style=for-the-badge)](https://www.crewai.com/)
[![Google Gemini](https://img.shields.io/badge/LLM-Google%20Gemini%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20Alembic-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](LICENSE)

<p align="center">
  <b>A unified, hospital-grade neurological platform uniting Deep Learning Computer Vision, Blended Ensemble ML Risk Stratification, CrewAI Multi-Agent Workflows, Grounded Medical RAG, and Automated PDF Diagnostic Reporting.</b>
</p>

[Dual Clinical Pathways](#-system-overview--clinical-pathways) •
[Deep Learning & ML Models](#-the-three-specialized-ai-models) •
[CrewAI Flow & RAG](#-multi-agent-crewai-flow--medical-rag) •
[Quickstart](#-quickstart--installation) •
[API Documentation](#-rest-api-documentation)

---

</div>

## 📌 Executive Overview

Acute stroke is a medical emergency requiring rapid intervention where **"Time is Brain"** (every minute of untreated cerebral ischemia destroys approximately 1.9 million neurons). 

**StrokeAegis AI** is an advanced clinical decision support platform engineered to assist neurologists, emergency radiologists, and triage physicians through two tightly coupled diagnostic pathways and an autonomous multi-agent clinical consultation flow:

1. **Pathway 1 (Clinical Risk Stratification)**: Blended ensemble machine learning (LightGBM + HistGradientBoosting + XGBoost) predicting baseline stroke probability from demographic, metabolic, and cardiovascular biomarkers.
2. **Pathway 2 (Diagnostic Neuroimaging & Explainability)**: 
   - **The Door Model (Safety Gatekeeper)**: ConvNeXt-Tiny verifies whether an uploaded scan is genuine axial brain NCCT, rejecting non-brain scans (chest X-rays, abdominal scans) to prevent catastrophic misdiagnoses.
   - **Main Diagnostic Classifier**: EfficientNetV2-S performing tri-class diagnosis (`Normal`, `Bleeding / Hemorrhagic`, `Ischemia / Infarct`) with temperature calibration ($T=0.856$).
   - **Explainable AI (Grad-CAM)**: High-resolution lesion heatmaps, high-activation hotspot contours, centroid coordinates ($X\%, Y\%$), and anatomical quadrant localization.
3. **Pathway 3 (CrewAI Multi-Agent Flow & RAG)**: Autonomous clinical agents (Validation, Prevention, Emergency Support, Report Generator) orchestrating patient intake, guideline checking, and clinical synthesis.
4. **Pathway 4 (Automated Vector PDF Reporting)**: Instant vector PDF report generation with embedded Grad-CAM evidence figures, vital signs breakdown, and physician sign-off blocks.

---

## 🏛️ System Architecture

```text
                                  ┌─────────────────────────────────────────────────────────────┐
                                  │                       StrokeAegis AI                        │
                                  │          AI-Powered Stroke Reporting & Integrated Solutions │
                                  └──────────────────────────────┬──────────────────────────────┘
                                                                 │
                                 ┌───────────────────────────────┴───────────────────────────────┐
                                 ▼                                                               ▼
       ┌───────────────────────────────────────────────────┐             ┌───────────────────────────────────────────────────┐
       │     PATHWAY 1: Clinical Risk Stratification       │             │       PATHWAY 2: Diagnostic CT Neuroimaging       │
       ├───────────────────────────────────────────────────┤             ├───────────────────────────────────────────────────┤
       │ • Model: Blended Ensemble (LightGBM + XGBoost)    │             │ 1. STAGE 1 (The Door Model — ConvNeXt-Tiny):      │
       │ • 10 Biomarkers (Age, Glucose, BMI, BP, Heart...) │             │    Verifies axial brain CT; rejects non-brain     │
       │ • Outputs: Probability %, Danger Tier (Low,       │             │                                                   │
       │   Moderate, High), Key Risk Factor Breakdown.     │             │ 2. STAGE 2 (Main Classifier — EfficientNetV2-S):  │
       │ • Instant 1-Click Patient Presets                 │             │    Tri-Class (Normal / Bleeding / Ischemia)       │
       └─────────────────────────┬─────────────────────────┘             │    Temperature Calibrated Logits (T=0.856)        │
                                 │                                       │                                                   │
                                 │                                       │ 3. STAGE 3 (AI Explainability — Grad-CAM):        │
                                 │                                       │    Lesion Heatmap Overlay, White Hotspot Contour, │
                                 │                                       │    Focus Centroid (X%, Y%), Anatomical Quadrant   │
                                 │                                       └─────────────────────────┬─────────────────────────┘
                                 │                                                                 │
                                 └───────────────────────────────┬─────────────────────────────────┘
                                                                 ▼
                                 ┌─────────────────────────────────────────────────────────────────┐
                                 │         PATHWAY 3: CrewAI Multi-Agent Clinical Flow             │
                                 │  Validation Agent ──► Prevention ──► Emergency ──► Reporting    │
                                 └───────────────────────────────┬─────────────────────────────────┘
                                                                 ▼
                                 ┌─────────────────────────────────────────────────────────────────┐
                                 │       Integrated Comprehensive Patient Diagnostic Report        │
                                 │  Consolidates ML Risk + CT Scan + Grad-CAM snapshot + PDF Print │
                                 └─────────────────────────────────────────────────────────────────┘
```

---

## 🧠 The Three Specialized AI Models

### 1. The Door Model (Brain CT Gatekeeper)
- **Role**: Safety gatekeeper preventing non-brain images from entering the diagnostic pipeline.
- **Architecture**: `torchvision.models.convnext_tiny` with custom binary classifier head:
  $$\text{Head} = \text{Dropout}(p=0.30) \longrightarrow \text{Linear}(768, 2)$$
- **Classes**: `["not_brain_ct", "brain_ct"]`
- **Thresholds**: Calibrated Acceptance Threshold ($\theta = 0.2019$), Review Bound ($\theta = 0.1413$).
- **Implementation**: `backend/gate_engine.py`

### 2. The Main Diagnostic Model (Tri-Class Stroke Classifier + Grad-CAM)
- **Role**: Radiologically diagnoses acute cerebral pathology and renders explainability overlays.
- **Architecture**: `timm` backbone `tf_efficientnetv2_s.in1k` + Generalized Mean Pooling (`GeM(p=3.0)`) + Linear head:
  $$\text{Linear}(512) \longrightarrow \text{BatchNorm1d}(512) \longrightarrow \text{ReLU} \longrightarrow \text{Dropout}(0.35) \longrightarrow \text{Linear}(3)$$
- **Classes**: `("Normal", "Bleeding", "Ischemia")`
- **Temperature Scaling**: $\mathbf{z}_{\text{calibrated}} = \mathbf{z} / 0.85610437$
- **Grad-CAM Explainability**:
  - Computes gradient backpropagation to the final convolutional feature map.
  - Generates: Pure JET heatmap, blended ROI overlay with white contour boundary (activation $\ge 0.60$), and full-scan original projection.
  - Computes lesion coverage percentage, focus centroid coordinates $(X\%, Y\%)$, and anatomical quadrant (e.g. *Anterior Left Hemisphere*).
- **Implementation**: `backend/stroke_cls_engine.py`

### 3. The Machine Learning Risk Model (Clinical Stratification)
- **Role**: Quantifies systemic long-term stroke danger from physiological and lifestyle data.
- **Architecture**: `ThresholdedRiskModel` wrapping a `SoftBlendEstimator`:
  - `LGBMClassifier` (Weight: **84.16%**)
  - `HistGradientBoostingClassifier` (Weight: **13.78%**)
  - `XGBClassifier` (Weight: **2.06%**)
- **Input Features (10 parameters)**: Gender, Age, Hypertension, Heart Disease, Marital Status, Work Type, Residence Type, Average Glucose Level, BMI, Smoking Status.
- **Decision Threshold**: $\tau = 0.49$ | Tiers: **Low** ($<20\%$), **Moderate** ($20\%-50\%$), **High** ($\ge 50\%$).
- **Implementation**: `backend/ml_engine.py` & `backend/ml_worker.py`

---

## 🤖 Multi-Agent CrewAI Flow & Medical RAG

StrokeAegis AI incorporates an autonomous multi-agent clinical team powered by **CrewAI** and **Google Gemini**:

- 🛡️ **Validation Agent**: Audits patient intake data, identifies conflicting vitals, and flags missing laboratory values.
- 🩺 **Prevention Agent**: Evaluates chronic cardiovascular risk factors, crafting personalized therapeutic and lifestyle interventions.
- 🚨 **Emergency Support Agent**: Assesses acute clinical alerts, NIHSS indications, and emergency FAST protocol triggers.
- 📑 **Medical Report Agent**: Synthesizes radiological findings, ML probabilities, and agent recommendations into a structured narrative.
- 🔍 **Vector-Grounded RAG**: SQLite/pgvector document chunking delivering evidence-based clinical citations and guidelines for patient queries.
- 💬 **Medical Chatbot (`backend/chatbot/service.py`)**: Real-time consultation assistant equipped with a semantic intent classifier, FAST emergency detection, and medical out-of-scope rejection guardrails.

---

## 💻 Clinical Web Interface

- 🌐 **Bilingual (English / Arabic RTL)**: Full internationalization (`frontend/i18n.js`) with native Right-to-Left (RTL) Arabic layout and English LTR mode.
- 🎨 **Medical Glassmorphism UI**: High-contrast clinical theme matching modern hospital radiology workstations.
- ⚡ **1-Click Clinical Presets**: Preloaded with confirmed ischemic, hemorrhagic, normal, and non-brain rejection scans, plus preconfigured patient clinical profiles.
- 🖨️ **Automated PDF Export**: Directly generates formal vector medical reports (`backend/reports/pdf_generator.py`) ready for clinical documentation.

---

## 🚀 Quickstart & Installation

### Prerequisites
- Python 3.10 – 3.12
- PostgreSQL 14+ (or local SQLite)

### 1. Clone the Repository
```bash
git clone https://github.com/Mahmoodbamatraf/StrokeAegis-AI-Platform.git
cd StrokeAegis-AI-Platform
```

### 2. Set Up Virtual Environment & Dependencies
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy the configuration template and configure your keys:
```bash
cp .env.example .env
```
Edit `.env`:
```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
STROKE_AEGIS_CHATBOT_API_KEY=YOUR_GEMINI_API_KEY
POSTGRES_HOST=127.0.0.1
POSTGRES_DB=strokeaegis
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
```

### 4. Initialize Database
```bash
python scripts/init_db.py
python scripts/seed_demo_users.py
```

### 5. Launch the Platform
```bash
# Option A: Windows 1-click batch launcher
run_demo.bat

# Option B: Python launcher (automatically opens browser)
python start_demo.py
```
Open your browser at **`http://127.0.0.1:8000`**.

---

## 📡 REST API Documentation

| Endpoint | Method | Input | Description |
| :--- | :---: | :--- | :--- |
| `/api/health` | `GET` | None | Health check and loaded model inventory. |
| `/api/presets` | `GET` | None | Curated CT scans and patient clinical presets. |
| `/api/verify-gate` | `POST` | `multipart/form-data` | Door Model ConvNeXt verification (`accepted`, `p_brain_ct`). |
| `/api/diagnose-ct` | `POST` | `multipart/form-data` | Gatekeeper + EfficientNetV2 tri-class classification + Grad-CAM. |
| `/api/predict-risk` | `POST` | `application/json` | ML Stroke Risk assessment (10 biomarkers, tier, factors). |
| `/api/chatbot/message`| `POST` | `application/json` | Semantic RAG medical consultation chatbot. |
| `/api/auth/login` | `POST` | `application/json` | JWT authentication for clinical portals. |

---

## 📂 Repository Structure

```text
StrokeAegis-AI-Platform/
├── alembic/                          # Database schema migration scripts
├── assets/                           # Project icons, clinical badges, and branding
├── backend/
│   ├── agents/                       # Clinical schemas and prompt definitions
│   ├── auth/                         # JWT authentication and RBAC security
│   ├── chatbot/                      # Semantic intent chatbot service
│   ├── clinical/                     # Clinical portal services and endpoints
│   ├── crew/                         # CrewAI multi-agent flows & LiteLLM config
│   ├── database/                     # SQLAlchemy models and session factory
│   ├── generated_reports/            # Sample clinical PDF report outputs
│   ├── orchestration/                # Pipeline coordination managers
│   ├── rag/                          # Medical RAG retrieval tools & vector client
│   ├── reports/                      # ReportLab clinical PDF generator
│   ├── app.py                        # FastAPI main gateway application
│   ├── gate_engine.py                # ConvNeXt-Tiny Door Model engine
│   ├── ml_engine.py                  # Blended ML Risk engine bridge
│   ├── ml_worker.py                  # Risk model inference worker
│   └── stroke_cls_engine.py          # EfficientNetV2-S classifier + Grad-CAM
├── database/sql/                     # Raw SQL initialization schemas
├── frontend/
│   ├── assets/                       # UI SVG illustrations and logo assets
│   ├── app.js                        # State manager, API integration, and DOM
│   ├── i18n.js                       # Bilingual EN/AR localization engine
│   ├── icons.js                      # SVG icon injection system
│   ├── index.html                    # Clinical workstation interface
│   └── styles.css                    # Medical design styling & dark mode
├── sample_scans/                     # Benchmark CT scans (Bleeding, Ischemia, Normal, Rejection)
├── scripts/                          # DB initialization and test suites
├── requirements.txt                  # Python dependencies
├── run_demo.bat                      # Windows 1-click execution script
├── start_demo.py                     # Python application server launcher
├── .gitignore                        # Git exclusions (secrets, caches)
├── LICENSE                           # MIT Open-Source License
└── README.md                         # Platform documentation
```

---

## 👨‍💻 Author

**Mahmood Saeed Bamatraf**  
- **Role**: AI Engineer & Data Scientist | Co-Founder & Head of AI at ASAAS-AI  
- **GitHub**: [@Mahmoodbamatraf](https://github.com/Mahmoodbamatraf)  
- **LinkedIn**: [Mahmood Saeed Bamatraf](https://www.linkedin.com/in/mahmood-saeed-bamatraf-78949342b)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
