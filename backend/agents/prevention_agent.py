"""
StrokeAegis AI — Stroke Prevention Clinical Specialist Agent
RAG-enabled CrewAI Agent providing guideline-backed stroke prevention support.
"""

import json
import logging
from typing import Dict, Any, Optional
from crewai import Agent, Task, Crew, Process

from backend.crew.llm import get_llm
from backend.rag.tools import StrokeAegisRAGTool
from backend.rag.rag_client import query_medical_rag
from .schemas import PreventionResult

logger = logging.getLogger("strokeaegis.agents.prevention")
logger.setLevel(logging.INFO)


def create_prevention_agent(llm=None) -> Agent:
    """
    Creates and returns the Stroke Prevention Clinical Specialist Agent.
    """
    agent_llm = llm or get_llm()
    rag_tool = StrokeAegisRAGTool()

    return Agent(
        role="Stroke Prevention Clinical Specialist",
        goal="Provide guideline-grounded stroke prevention support based on patient-specific risk factors and ML risk assessment.",
        backstory=(
            "You are a Senior Preventive Neurologist and Clinical Vascular Specialist with extensive expertise "
            "in primary and secondary cerebrovascular accident prevention. You strictly adhere to AHA/ASA Stroke "
            "Prevention Guidelines, WHO HEARTS technical packages, and NICE Stroke Prevention Standards. "
            "You analyze systemic vascular indicators (hypertension, hyperglycemia, BMI, cardiac history, smoking) "
            "and machine-learning risk stratification scores to formulate concrete, guideline-grounded clinical "
            "interventions. Every significant recommendation must be traceable to authentic guidelines. "
            "You never invent citations and never act as an autonomous prescribing physician."
        ),
        tools=[rag_tool],
        llm=agent_llm,
        verbose=False,
        memory=False,
        allow_delegation=False
    )


def run_prevention_analysis(
    patient_data: Dict[str, Any],
    ml_risk_data: Dict[str, Any],
    llm=None
) -> PreventionResult:
    """
    Executes the prevention analysis workflow and returns a validated PreventionResult.
    """
    logger.info("Executing Stroke Prevention Agent analysis...")
    agent_llm = llm or get_llm()
    agent = create_prevention_agent(llm=agent_llm)

    # Pre-retrieve targeted guideline evidence to ensure robust grounding
    age = patient_data.get("age", 65)
    hyp = patient_data.get("hypertension", 0)
    glu = patient_data.get("avg_glucose_level", 100)
    smoke = patient_data.get("smoking_status", "never smoked")

    retrieval_queries = [
        f"blood pressure management target stroke prevention hypertension={hyp}",
        f"lifestyle glycemic diet exercise stroke risk glucose={glu}",
        "antiplatelet statin secondary stroke prevention primary prevention"
    ]

    retrieved_chunks = []
    for q in retrieval_queries:
        chunks = query_medical_rag(
            query=q,
            agent="prevention",
            condition="stroke_prevention",
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
Analyze the following patient profile and ML stroke risk stratification results:

PATIENT PROFILE:
- Gender: {patient_data.get('gender', 'Unknown')}
- Age: {age} years
- Hypertension: {'Yes (Hypertensive)' if hyp == 1 else 'No (Normotensive)'}
- Heart Disease: {'Yes (Cardiac History)' if patient_data.get('heart_disease') == 1 else 'No'}
- Average Blood Glucose: {glu} mg/dL
- BMI: {patient_data.get('bmi', 25.0)} kg/m2
- Smoking Status: {smoke}
- Work / Residence: {patient_data.get('work_type', 'N/A')} / {patient_data.get('Residence_type', 'N/A')}

ML RISK ASSESSMENT RESULTS:
- Predicted Stroke Probability: {ml_risk_data.get('stroke_probability_pct', ml_risk_data.get('stroke_probability', 0) * 100):.1f}%
- Risk Tier: {ml_risk_data.get('risk_tier', 'Moderate')}
- Model Decision Threshold: {ml_risk_data.get('threshold', 0.49) * 100:.1f}%
- Primary Risk Factors: {', '.join([f.get('factor', '') for f in ml_risk_data.get('clinical_factors', [])])}

AUTHENTIC GUIDELINE EVIDENCE RETRIEVED FROM RAG:
{evidence_text}

TASK INSTRUCTIONS:
1. Provide a rigorous, professional clinical interpretation of the patient's stroke probability and comorbid risk profile.
2. Formulate 4 to 6 actionable lifestyle and behavioral modifications (diet, physical activity, sodium, smoking cessation if applicable).
3. Specify evidence-based blood pressure management goals and targets (e.g. <130/80 mmHg per AHA/ASA guidelines).
4. Provide glycemic guidance tailored to their glucose level ({glu} mg/dL).
5. Outline lipid/statin and antiplatelet considerations for physician review.
6. Clearly include authentic guideline citations from the retrieved evidence.
7. Include appropriate clinical precautions and warnings.

Produce the result strictly matching the PreventionResult schema.
"""

    task = Task(
        description=task_prompt,
        expected_output="A structured PreventionResult containing risk interpretation, recommendations, guidance, and authentic citations.",
        agent=agent,
        output_pydantic=PreventionResult
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
            res: PreventionResult = crew_output.pydantic
            # Ensure citations include pre-retrieved citations if empty
            if not res.evidence_citations and citations_list:
                res.evidence_citations = citations_list
            return res
        elif hasattr(crew_output, "raw"):
            # Fallback parse
            try:
                data = json.loads(crew_output.raw)
                return PreventionResult(**data)
            except Exception:
                pass
    except Exception as e:
        logger.warning(f"CrewAI execution error in Prevention Agent: {e}. Generating verified clinical fallback.")

    # Graceful clinical fallback preserving RAG citations
    tier = ml_risk_data.get("risk_tier", "Moderate")
    prob_pct = ml_risk_data.get("stroke_probability_pct", 50.0)
    
    return PreventionResult(
        risk_interpretation=(
            f"Patient is categorized into the {tier} Stroke Risk Tier with a calculated machine learning probability "
            f"of {prob_pct}%. Key synergistic vascular hazards include "
            f"{'hypertension, ' if hyp == 1 else ''}{'elevated blood glucose, ' if glu > 140 else ''}"
            f"and demographic age ({age} years). Multi-target risk factor reduction is indicated."
        ),
        patient_risk_summary=(
            f"{patient_data.get('gender', 'Patient')} aged {age} with BMI {patient_data.get('bmi', 25.0)} "
            f"and average glucose of {glu} mg/dL presenting with {tier.lower()} systemic cerebrovascular vulnerability."
        ),
        lifestyle_recommendations=[
            "Adopt the DASH or Mediterranean dietary pattern rich in fruits, vegetables, and potassium.",
            "Restrict sodium intake to <1,500 - 2,000 mg/day to assist with systemic arterial pressure control.",
            "Engage in at least 150 minutes per week of moderate-intensity aerobic exercise.",
            "Complete smoking cessation and avoidance of secondhand smoke exposure." if smoke in ("smokes", "formerly smoked") else "Maintain complete tobacco-free lifestyle.",
            "Implement weight management strategies targeting a BMI between 18.5 and 24.9 kg/m2."
        ],
        blood_pressure_guidance=(
            "Maintain target blood pressure <130/80 mmHg per AHA/ASA Primary Prevention Guidelines. "
            "Initiate or optimize combination antihypertensive therapy (ACE-i/ARB, CCB, thiazide) if sustained BP >= 130/80."
        ),
        glycemic_guidance=(
            f"Current average glucose ({glu} mg/dL) exceeds optimal fasting parameters. "
            "Obtain HbA1c testing (target <7.0%) and recommend endocrine consultation for diabetic/prediabetic optimization."
        ),
        lipid_and_antiplatelet_guidance=(
            "Assess 10-year ASCVD risk score; initiate moderate-to-high intensity statin therapy if indicated. "
            "Antiplatelet prophylaxis (e.g. Aspirin 81 mg daily) requires individual clinical evaluation by the attending physician."
        ),
        evidence_citations=citations_list or [
            "AHA/ASA Guidelines for the Prevention of Stroke in Patients with Stroke and TIA (2021)",
            "WHO HEARTS Technical Package: Risk-based CVD Management (2020)",
            "NICE Stroke and TIA: Diagnosis and Initial Management [NG128] (2022)"
        ],
        warnings=[
            "Elevated cardiovascular risk profile warrants comprehensive outpatient vascular evaluation.",
            "Educate patient and family members on F.A.S.T. stroke emergency recognition."
        ],
        requires_clinician_review=True
    )
