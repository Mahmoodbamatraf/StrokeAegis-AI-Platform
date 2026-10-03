"""
StrokeAegis AI — Acute Stroke Clinical Support Specialist Agent
RAG-enabled CrewAI Agent providing acute emergency clinical decision support.
"""

import json
import logging
from typing import Dict, Any, Optional
from crewai import Agent, Task, Crew, Process

from backend.crew.llm import get_llm
from backend.rag.tools import StrokeAegisRAGTool
from backend.rag.rag_client import query_medical_rag
from .schemas import EmergencySupportResult

logger = logging.getLogger("strokeaegis.agents.emergency")
logger.setLevel(logging.INFO)


def create_emergency_agent(llm=None) -> Agent:
    """
    Creates and returns the Acute Stroke Clinical Support Specialist Agent.
    """
    agent_llm = llm or get_llm()
    rag_tool = StrokeAegisRAGTool()

    return Agent(
        role="Acute Stroke Clinical Support Specialist",
        goal="Provide guideline-grounded acute stroke clinical support based on CT analysis and retrieved medical evidence.",
        backstory=(
            "You are an Attending Neuro-Intensivist and Emergency Stroke Specialist with deep expertise in "
            "hyperacute management of cerebrovascular accidents. You strictly adhere to AHA/ASA Acute Ischemic "
            "Stroke Guidelines, AHA/ASA Spontaneous Intracerebral Hemorrhage Guidelines, and ESO Thrombolysis "
            "Guidelines. You interpret non-contrast head CT findings, gatekeeper status, and Grad-CAM lesion "
            "demarcation to guide time-critical hyperacute pathways: IV thrombolysis eligibility, mechanical "
            "thrombectomy indications, blood pressure targets, and neurosurgical consults. "
            "CRITICAL CLINICAL RULE: Intracranial hemorrhage strictly contraindicates thrombolytic and anticoagulant therapy."
        ),
        tools=[rag_tool],
        llm=agent_llm,
        verbose=False,
        memory=False,
        allow_delegation=False
    )


def run_emergency_analysis(
    ct_gate_data: Dict[str, Any],
    ct_diagnosis_data: Dict[str, Any],
    llm=None
) -> EmergencySupportResult:
    """
    Executes acute emergency analysis and returns a validated EmergencySupportResult.
    """
    logger.info("Executing Acute Stroke Emergency Agent analysis...")
    agent_llm = llm or get_llm()
    agent = create_emergency_agent(llm=agent_llm)

    pred_class = ct_diagnosis_data.get("prediction", "Normal")
    conf_pct = ct_diagnosis_data.get("confidence_pct", 0.0)
    gradcam = ct_diagnosis_data.get("gradcam", {})
    quadrant = gradcam.get("anatomical_quadrant", "Not localized")
    coverage = gradcam.get("hotspot_coverage_pct", 0.0)

    # Determine condition and targeted queries for RAG retrieval
    if pred_class == "Bleeding":
        condition = "hemorrhagic_stroke"
        queries = [
            "acute intracerebral hemorrhage blood pressure management target",
            "intracranial hemorrhage hematoma expansion neurosurgical reversal",
            "contraindication thrombolysis anticoagulation hemorrhagic stroke"
        ]
        detected_type = "Hemorrhagic Stroke"
    elif pred_class == "Ischemia":
        condition = "ischemic_stroke"
        queries = [
            "acute ischemic stroke IV alteplase tenecteplase thrombolysis time window",
            "mechanical thrombectomy large vessel occlusion anterior circulation",
            "blood pressure management before during IV thrombolysis"
        ]
        detected_type = "Ischemic Stroke"
    else:
        condition = "ischemic_stroke"
        queries = [
            "normal CT scan with acute neurological deficits TIA differential",
            "acute stroke workup non-contrast CT normal MRI diffusion"
        ]
        detected_type = "Normal / Non-Pathological"

    retrieved_chunks = []
    for q in queries:
        chunks = query_medical_rag(
            query=q,
            agent="emergency",
            condition=condition,
            top_k=2
        )
        retrieved_chunks.extend(chunks)

    evidence_context_lines = []
    citations_list = []
    for i, c in enumerate(retrieved_chunks, 1):
        evidence_context_lines.append(
            f"[{i}] Citation: {c['citation']}\n"
            f"Guideline Text: {c['text']}\n"
        )
        if c['citation'] not in citations_list:
            citations_list.append(c['citation'])

    evidence_text = "\n".join(evidence_context_lines) if evidence_context_lines else "No specific guideline text retrieved."

    task_prompt = f"""
Analyze the following brain CT neuroimaging results and retrieved acute guideline evidence:

CT NEUROIMAGING FINDINGS:
- Door Model Gatekeeper: {'ACCEPTED (Brain CT confirmed)' if ct_gate_data.get('accepted') else 'REJECTED (Non-brain scan)'} ({ct_gate_data.get('confidence_pct', 0)}% confidence)
- Primary Classification: {pred_class} ({detected_type})
- Model Confidence: {conf_pct}%
- Anatomical Localization: {quadrant}
- Lesion Hotspot Coverage: {coverage}% of brain parenchyma
- Class Probabilities: {json.dumps(ct_diagnosis_data.get('class_probabilities', {}))}

AUTHENTIC ACUTE GUIDELINE EVIDENCE RETRIEVED FROM RAG:
{evidence_text}

TASK INSTRUCTIONS:
1. Deliver an immediate hyperacute clinical summary of the CT scan.
2. Outline prioritized hyperacute actions (airway/breathing/circulation, immediate neurological assessment, glucose/coagulation labs).
3. If Hemorrhagic Stroke: state clearly that IV thrombolysis and antiplatelets are ABSOLUTELY CONTRAINDICATED. Specify acute BP target (typically systolic <140 mmHg) and urgent neurosurgical consult.
4. If Ischemic Stroke: outline IV thrombolysis criteria (within 4.5 hours of last known normal if eligible), mechanical thrombectomy criteria (up to 24 hours for LVO), and BP threshold (<180/105 mmHg before thrombolysis).
5. If Normal CT: discuss consideration of TIA, early ischemic changes below CT sensitivity threshold, and recommendation for urgent MRI DWI.
6. Detail ICU neuro-monitoring and ICP escalation triggers.
7. Include authentic guideline citations from the retrieved evidence.

Produce the result strictly matching the EmergencySupportResult schema.
"""

    task = Task(
        description=task_prompt,
        expected_output="A structured EmergencySupportResult with acute clinical summary, hyperacute management, eligibility criteria, and authentic citations.",
        agent=agent,
        output_pydantic=EmergencySupportResult
    )

    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=False
    )

    try:
        crew_output = crew.kickoff()
        if hasattr(crew_output, "pydantic") and crew_output.pydantic:
            res: EmergencySupportResult = crew_output.pydantic
            if not res.evidence_citations and citations_list:
                res.evidence_citations = citations_list
            return res
        elif hasattr(crew_output, "raw"):
            try:
                data = json.loads(crew_output.raw)
                return EmergencySupportResult(**data)
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"CrewAI execution error in Emergency Agent: {e}. Generating verified clinical fallback.")

    # Clinical fallback preserving safety rules
    if pred_class == "Bleeding":
        return EmergencySupportResult(
            acute_clinical_summary=(
                f"High-density acute hyperattenuation identified consistent with Acute Intracranial Hemorrhage "
                f"({conf_pct}% confidence), localized to the {quadrant}. Emergency neurovascular resuscitation indicated."
            ),
            detected_stroke_type="Hemorrhagic Stroke",
            hyperacute_management=[
                "Secure airway, ensure adequate oxygenation (SpO2 > 94%), and establish bilateral large-bore IV access.",
                "Order immediate stat coagulation profile (INR, PT, aPTT, platelet count) and cross-match.",
                "Immediately reverse any active anticoagulant or antithrombotic therapies.",
                "Obtain urgent neurosurgical consult for surgical hematoma evacuation or external ventricular drain placement."
            ],
            thrombolysis_eligibility_considerations="STRICTLY CONTRAINDICATED. Thrombolytics (Alteplase, Tenecteplase) and antiplatelet agents are absolute contraindications in acute hemorrhagic stroke.",
            mechanical_thrombectomy_considerations="Not indicated for primary intracerebral hemorrhage. Catheter angiogram may be considered if underlying vascular malformation (AVM / aneurysm) is suspected.",
            blood_pressure_management="Target acute systolic blood pressure reduction to <140 mmHg (maintain 130-140 mmHg) using IV titratable agents (e.g. Nicardipine, Labetalol) to mitigate hematoma expansion.",
            monitoring_and_neurosurgical_actions=[
                "Admit immediately to dedicated Neuro-ICU for continuous invasive neuro-monitoring.",
                "Monitor closely for signs of elevated ICP (Cushing's triad, pupillary asymmetry, lethargy).",
                "Keep head of bed elevated 30 degrees; maintain normoglycemia and normothermia."
            ],
            contraindication_flags=[
                "ABSOLUTE CONTRAINDICATION: Do NOT administer Alteplase, Tenecteplase, Aspirin, Heparin, or Clopidogrel.",
                "Avoid aggressive hypotension (MAP < 65 mmHg) which compromises cerebral perfusion pressure."
            ],
            evidence_citations=citations_list or [
                "AHA/ASA Guideline for the Management of Patients with Spontaneous Intracerebral Hemorrhage (2022)",
                "ESO Guidelines on the Management of Spontaneous Intracerebral Hemorrhage (2021)"
            ],
            requires_clinician_review=True
        )
    elif pred_class == "Ischemia":
        return EmergencySupportResult(
            acute_clinical_summary=(
                f"Hypodense parenchymal loss and sulcal effacement consistent with Acute Ischemic Stroke "
                f"({conf_pct}% confidence) in the {quadrant}. Time-critical reperfusion evaluation required."
            ),
            detected_stroke_type="Ischemic Stroke",
            hyperacute_management=[
                "Immediately confirm Last Known Normal (LKN) time to establish therapeutic eligibility windows.",
                "Assess acute NIH Stroke Scale (NIHSS) score to quantify neurological deficit severity.",
                "Obtain STAT capillary blood glucose (target 140-180 mg/dL; exclude hypoglycemia mimic).",
                "Order immediate CT Angiography (CTA) of the head and neck to screen for Large Vessel Occlusion (LVO)."
            ],
            thrombolysis_eligibility_considerations=(
                "Eligible for IV Thrombolysis (Alteplase 0.9 mg/kg or Tenecteplase 0.25 mg/kg) if presenting within 4.5 hours "
                "of symptom onset and without contraindications (active bleeding, recent surgery, severe hypertension)."
            ),
            mechanical_thrombectomy_considerations=(
                "Evaluate for Endovascular Thrombectomy (EVT) if LVO is confirmed in the internal carotid artery or MCA M1 segment. "
                "EVT window extends up to 24 hours with perfusion mismatch imaging (DAWN / DEFUSE-3 criteria)."
            ),
            blood_pressure_management=(
                "If eligible for IV thrombolysis, maintain BP < 185/110 mmHg prior to infusion and < 180/105 mmHg for 24 hours post-thrombolysis. "
                "If not receiving acute reperfusion therapy, allow permissive hypertension up to 220/120 mmHg."
            ),
            monitoring_and_neurosurgical_actions=[
                "Admit to Comprehensive Stroke Unit with continuous cardiac and neurological telemetry.",
                "Perform serial NIHSS assessments every 15 minutes during thrombolytic infusion, then hourly.",
                "Alert neurosurgical team if malignant MCA territorial infarction with mass effect is suspected."
            ],
            contraindication_flags=[
                "Do not administer IV thrombolytics if BP >= 185/110 mmHg despite antihypertensive intervention.",
                "Do not initiate antiplatelet therapy within 24 hours following IV thrombolysis."
            ],
            evidence_citations=citations_list or [
                "AHA/ASA Guidelines for the Early Management of Patients with Acute Ischemic Stroke (2019/2021 Update)",
                "ESO Guidelines on Intravenous Thrombolysis for Acute Ischemic Stroke (2021)"
            ],
            requires_clinician_review=True
        )
    else:
        return EmergencySupportResult(
            acute_clinical_summary=(
                f"Non-contrast CT scan demonstrates preserved parenchymal symmetry without acute hemorrhage or "
                f"demarcated territorial infarction ({conf_pct}% confidence). Normal scan does not rule out hyperacute ischemia."
            ),
            detected_stroke_type="Normal / Non-Pathological",
            hyperacute_management=[
                "Correlate with acute focal neurological symptoms to evaluate for Transient Ischemic Attack (TIA) or early ischemia.",
                "If focal deficits persist despite negative non-contrast CT, order emergent Brain MRI with Diffusion-Weighted Imaging (DWI).",
                "Obtain urgent neurovascular vascular imaging (CTA/MRA) to exclude intracranial stenosis or dissection."
            ],
            thrombolysis_eligibility_considerations=(
                "A normal non-contrast CT in a patient with severe acute disabling stroke deficits within 4.5 hours is an indication "
                "FOR IV thrombolysis (since CT is normal in ~50% of hyperacute ischemic strokes in the first 3 hours)."
            ),
            mechanical_thrombectomy_considerations="Perform CTA head/neck immediately. Normal non-contrast CT parenchyma with clinical NIHSS deficit suggests potential salvageable penumbra if LVO is identified.",
            blood_pressure_management="Maintain euvolemia and blood pressure stability. Avoid acute severe hypotension.",
            monitoring_and_neurosurgical_actions=[
                "Admit to Stroke observation unit for 24-hour telemetry and serial neurological exams.",
                "Investigate stroke mimics (migraine with aura, focal seizure, vestibular neuritis, hypoglycemia)."
            ],
            contraindication_flags=["Do not dismiss acute focal neurological deficits based solely on a normal early non-contrast CT."],
            evidence_citations=citations_list or [
                "AHA/ASA Guidelines for the Early Management of Patients with Acute Ischemic Stroke (2019)",
                "NICE Guideline: Stroke and TIA [NG128] (2022)"
            ],
            requires_clinician_review=True
        )
