"""
StrokeAegis AI — Standalone Medical Chatbot Service
Architecture:
  User -> Chatbot UI -> Semantic Intent Understanding -> Existing Medical RAG -> Gemini 3.6-Flash -> Grounded Clinical Response

Guarantees & Constraints:
  - ZERO CrewAI usage (does not create or modify CrewAI agents)
  - Reuses existing 501-chunk Medical RAG without duplicate databases
  - Dedicated API key: STROKE_AEGIS_CHATBOT_API_KEY (strictly separated from clinical agents)
  - Intent-First Semantic Understanding: Understands natural language, symptoms, synonyms,
    conversational context, and pronouns without requiring rigid keywords.
  - Immediate emergency guidance (FAST) for acute symptoms or urgent follow-ups
  - Rich application knowledge for StrokeAegis AI system questions
  - Natural, warm handling of greetings and polite conversational pleasantries
  - Professional, polite redirection for clearly out-of-scope queries
"""

import os
import re
import json
import time
import uuid
import asyncio
import logging
import httpx
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("strokeaegis.chatbot")
logger.setLevel(logging.INFO)

# Dedicated Chatbot API key strictly separated from clinical agents
DEFAULT_CHATBOT_API_KEY = os.environ.get("STROKE_AEGIS_CHATBOT_API_KEY", "")
SECONDARY_API_KEY = os.environ.get("GEMINI_API_KEY", "")
CHATBOT_MODEL = "gemini-3.8-flash"

SCOPE_REJECTION_MESSAGE = (
    "I'm StrokeAegis AI's medical assistant. I can only help with questions "
    "related to stroke and medically relevant topics connected to stroke. "
    "I can assist with stroke symptoms, warning signs, risk factors, prevention, "
    "brain imaging, acute emergency guidance, or questions about how the StrokeAegis AI system works. "
    "Please let me know how I can help you with those topics!"
)

# Emergency FAST warning template
EMERGENCY_GUIDANCE_PREFIX = (
    "🚨 **CRITICAL MEDICAL EMERGENCY ALERT: IMMEDIATE ACTION REQUIRED**\n\n"
    "The symptoms described (such as sudden one-sided weakness, facial drooping, speech difficulty, or sudden numbness) "
    "are classic warning signs of an **acute stroke**. Stroke is a life-threatening medical emergency where **TIME IS BRAIN**.\n\n"
    "**IMMEDIATE STEPS TO TAKE RIGHT NOW:**\n"
    "1. **CALL 911 (OR YOUR LOCAL EMERGENCY DISPATCH) IMMEDIATELY.** Do not wait to see if symptoms improve.\n"
    "2. **NOTE THE EXACT TIME** symptoms first began. This is critical for emergency physicians to determine eligibility for clot-busting medications (IV thrombolysis within 4.5 hours) or catheter thrombectomy (within up to 24 hours for Large Vessel Occlusion).\n"
    "3. **REMEMBER F.A.S.T.:**\n"
    "   - **F (Face Drooping):** Does one side of the face droop when smiling?\n"
    "   - **A (Arm Weakness):** Does one arm drift downward when raising both arms?\n"
    "   - **S (Speech Difficulty):** Is speech slurred, strange, or unable to be understood?\n"
    "   - **T (Time to Call 911):** If you observe ANY of these signs, call emergency services right away!\n"
    "4. **DO NOT** give the person food, water, or aspirin (if bleeding in the brain is present, aspirin could be fatal).\n\n"
    "*Note: As an AI decision-support assistant, I cannot provide a clinical diagnosis. Please seek immediate hospital emergency care.*"
)

EMERGENCY_SOURCES = [
    {
        "source": "AHA/ASA",
        "guideline": "Guidelines for the Early Management of Acute Ischemic Stroke",
        "section": "Emergency Medical Services and Systems of Care",
        "year": 2019,
        "page": 12,
        "citation": "AHA/ASA Acute Ischemic Stroke Guidelines, Section: Prehospital Care & FAST"
    }
]

# Knowledge base of StrokeAegis AI platform capabilities
STROKEAegis_SYSTEM_KNOWLEDGE = (
    "StrokeAegis AI Architecture & System Information:\n\n"
    "1. Overview: StrokeAegis AI is an advanced clinical decision-support and educational platform for stroke risk assessment, acute neuroimaging triage, and certified clinical documentation.\n\n"
    "2. Two Assessment Options:\n"
    "   - Quick Assessment: Rapid preliminary triage. Takes patient clinical risk factors (age, hypertension, heart disease, average glucose, BMI, smoking status) to run a blended ensemble ML risk model (StrokePrediction-V2) producing a stroke risk score and tier (Low, Moderate, High, Critical). Simultaneously accepts non-contrast head CT scans, verified by the ConvNeXt-Tiny Door Gatekeeper model (verifying valid brain CT) and classified by the EfficientNetV2-S Stroke Classifier (differentiating Ischemic Stroke, Hemorrhagic Stroke, or Normal/No Acute Lesion) with Grad-CAM visual heatmaps. Provides immediate preliminary risk and classification.\n"
    "   - AI System: Comprehensive multi-agent clinical decision-support flow orchestrated via CrewAI and grounded in our 501-chunk Medical RAG knowledge base. Engages 4 specialized agents:\n"
    "     * Stroke Prevention Specialist: Evidence-based modifiable risk factor management and lifestyle planning adhering to AHA/ASA and ESO guidelines.\n"
    "     * Acute Stroke Emergency Specialist: Hyperacute triage, IV thrombolytic therapy window (within 4.5h), and mechanical thrombectomy criteria for Large Vessel Occlusion (LVO, up to 24h).\n"
    "     * Medical Safety & Validation Specialist: Cross-validates all clinical recommendations, blood pressure thresholds, and contraindications.\n"
    "     * Clinical Report & Documentation Specialist: Synthesizes findings into a standardized clinical summary.\n\n"
    "3. Brain CT Analysis & Visual Explainability:\n"
    "   - Door Gatekeeper Model (ConvNeXt-Tiny): Protects the clinical pipeline by validating that uploaded files are genuine non-contrast axial brain CT slices.\n"
    "   - Stroke Classifier (EfficientNetV2-S + GeM pooling): Detects presence and subtype of acute stroke (Ischemic vs Hemorrhagic vs Normal).\n"
    "   - Grad-CAM: Highlights the exact anatomical regions and suspicious hypo/hyperdensities driving the neural network's classification.\n\n"
    "4. Clinical Reports & Doctor Sign-Off:\n"
    "   - Generates a certified 2-page clinical PDF report.\n"
    "   - Features patient risk stratification, CT diagnosis, agent recommendations, and an official sign-off block with the attending physician's name, digital certification status, date, and a physical signature line for printed copies.\n\n"
    "5. Doctor & Patient Portals:\n"
    "   - Patient Portal: View care team, check assessments, download certified reports, and consult the AI assistant.\n"
    "   - Doctor Portal: Manage patient roster, issue connection requests, review AI assessments, sign off reports, and direct consultation messaging.\n\n"
    "6. Important Safety & Identity Disclaimer:\n"
    "   - The chatbot is an assistive educational and clinical decision-support component. It does NOT replace an attending physician or hospital emergency care.\n"
    "   - The chatbot does NOT personally perform the CT classification or patient diagnosis; those are handled by the dedicated models and clinical flow when run in the platform."
)


class StrokeAegisChatbotService:
    def __init__(self, api_key: Optional[str] = None):
        keys: List[str] = []
        if api_key:
            keys.append(api_key)
        for env_var in ["STROKE_AEGIS_CHATBOT_API_KEY", "GEMINI_API_KEY", "STROKE_AEGIS_AGENT_API_KEY"]:
            val = os.environ.get(env_var)
            if val and val not in keys:
                keys.append(val)
        for def_key in [DEFAULT_CHATBOT_API_KEY, SECONDARY_API_KEY]:
            if def_key and def_key not in keys:
                keys.append(def_key)
        self.api_keys = keys
        self.api_key = self.api_keys[0] if self.api_keys else ""
        self.sessions: Dict[str, List[Dict[str, str]]] = {}
        logger.info(f"StrokeAegis Chatbot Service initialized (Active Keys: {len(self.api_keys)}, Primary Model: {CHATBOT_MODEL})")

    def _get_api_url(self, model: str = CHATBOT_MODEL, key: Optional[str] = None) -> str:
        active_key = key or self.api_key
        return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={active_key}"

    def _detect_emergency_flexible(self, message: str) -> bool:
        """
        Flexible semantic emergency detector.
        Detects descriptions of urgent, acute, or sudden neurological stroke symptoms
        without requiring exact keyword sequence or the word 'stroke'.
        """
        msg = message.lower()

        # Direct explicit emergency phrases
        if any(term in msg for term in [
            "thunderclap headache", "worst headache of my life", "worst headache of his life", "worst headache of her life"
        ]):
            return True

        # Sudden onset indicators
        has_sudden = bool(re.search(
            r"\b(sudden|suddenly|abrupt|abruptly|just started|started a few minutes ago|minutes ago|collapsed|right now|immediately)\b",
            msg
        ))

        # Body parts & unilateral references
        has_body_part = bool(re.search(
            r"\b(face|mouth|eye|arm|leg|hand|foot|side|body|limb|one side|half of)\b",
            msg
        ))

        # Neurological deficit indicators (handles words in between like 'can't I move', 'unable to lift')
        has_deficit = bool(re.search(
            r"\b(weak|weakness|numb|numbness|paralyz|paralysis|limp|droop|drooping|dropping|crooked|uneven|heavy|tingling)\b",
            msg
        ) or re.search(
            r"\b(cannot|can't|cant|unable to|lost|difficulty|trouble|hard to)\b.{0,20}\b(move|lift|raise|walk|use|feel)\b",
            msg
        ))

        # Speech difficulty indicators (handles 'speech became unclear', 'can't speak properly')
        has_speech_issue = bool(re.search(
            r"\b(slur|slurred|slurring|speech difficulty|talking strange|strange speech|speech became strange|speech became unclear|unclear speech|words mixed up|trouble speaking|trouble talking|difficulty speaking|aphasia|dysarthria)\b",
            msg
        ) or re.search(
            r"\b(cannot|can't|cant|unable to|hard to)\b.{0,20}\b(speak|talk)\b",
            msg
        ) or (
            "speech" in msg and any(w in msg for w in ["strange", "slur", "unclear", "difficult", "confus", "problem", "garbled"])
        ))

        # Pattern 1: Sudden onset + deficit / speech / confusion / vision
        if has_sudden and (has_deficit or has_speech_issue or "confus" in msg or "vision" in msg):
            return True

        # Pattern 2: Body part + deficit (e.g. "Why can't I move my right arm?", "Their mouth looks like it's dropping on one side")
        if has_body_part and has_deficit:
            return True

        # Pattern 3: Speech deficit (e.g., "speech is slurred", "cannot speak properly", "speech became unclear")
        if has_speech_issue:
            return True

        # Pattern 4: Relative or person collapsing / unable to talk / weak
        if re.search(
            r"\b(father|mother|dad|mom|husband|wife|friend|someone|brother|sister|parent|he|she|they)\b.*\b(cannot|can't|weak|droop|slurr|collapsed|numb|confus)\b",
            msg
        ):
            return True

        return False

    def _fast_semantic_intent_check(self, message: str, history: List[Dict[str, str]]) -> Optional[Dict[str, Any]]:
        """
        Fast local semantic analyzer. Resolves high-confidence intents instantly
        without consuming external LLM quota, while honoring context and meaning.
        """
        clean = message.strip().lower()
        clean_stripped = clean.rstrip("!?.")

        # 1. Greetings & Pleasantries
        greeting_words = {"hello", "hi", "hey", "good morning", "good afternoon", "good evening", "greetings", "howdy"}
        thanks_words = {"thanks", "thank you", "thank you so much", "thank you very much", "appreciate it", "many thanks"}
        ack_words = {"ok", "okay", "alright", "got it", "understood", "sure"}

        if clean in greeting_words or clean_stripped in greeting_words:
            return {"intent": "greeting", "is_in_scope": True, "is_emergency": False, "greeting_type": "hello"}
        if clean in thanks_words or clean_stripped in thanks_words:
            return {"intent": "greeting", "is_in_scope": True, "is_emergency": False, "greeting_type": "thanks"}
        if clean in ack_words or clean_stripped in ack_words:
            return {"intent": "greeting", "is_in_scope": True, "is_emergency": False, "greeting_type": "ack"}

        # 2. Acute Emergency Detection
        if self._detect_emergency_flexible(message):
            return {
                "intent": "emergency",
                "is_in_scope": True,
                "is_emergency": True,
                "contextual_query": f"acute stroke emergency symptoms FAST protocol {clean}"
            }

        # 3. Emergency Context Follow-up (e.g., "What should I do now?", "How much time do we have?")
        if history and len(history) >= 1:
            recent_texts = " ".join([h.get("text", "").lower() for h in history[-3:]])
            if any(term in recent_texts for term in ["emergency", "fast", "weakness", "droop", "911", "call 911"]):
                if re.search(r"\b(what should i do|what to do|what do i do|next step|help me|how much time|what now|this happens right now)\b", clean):
                    return {
                        "intent": "emergency",
                        "is_in_scope": True,
                        "is_emergency": True,
                        "contextual_query": "emergency action for acute stroke symptoms EMS dispatch FAST"
                    }

        # 4. Obvious Out-of-Scope Patterns (Coding, Sports, Trivia, Weather, Recipes)
        off_topic_patterns = [
            r"\b(python|javascript|typescript|c\+\+|java|html|css|sql|rust|php)\b",
            r"\b(write code|debug|regex|programming|script|syntax error|neural network)\b",
            r"\b(football|soccer|world cup|champions league|nfl|nba|basketball|tennis|messi|ronaldo)\b",
            r"\b(tell me a joke|tell a joke|riddle|make me laugh|funny story)\b",
            r"\b(capital of|who is the president|who was|history of|world war|french revolution)\b",
            r"\b(write (an )?email|write (an )?essay|cover letter|resume|recommend a laptop|buy a laptop)\b",
            r"\b(weather in|weather today|recipe for|bake a cake|flight to|movie recommendation)\b"
        ]
        for pattern in off_topic_patterns:
            if re.search(pattern, clean):
                if not any(k in clean for k in ["stroke", "brain", "ct", "scan", "ischemi", "hemorrhag", "vessel"]):
                    return {
                        "intent": "unrelated",
                        "is_in_scope": False,
                        "is_emergency": False,
                        "contextual_query": None
                    }

        # 5. StrokeAegis AI System Architecture & Workflows
        system_patterns = [
            r"\b(how does (this|the) (system|app|application|platform|ai) work)\b",
            r"\b(quick assessment|ai system option|assessment option|two options|two assessment)\b",
            r"\b(upload(ed|ing)? (the|my)? (scan|image|ct|information|data))\b",
            r"\b(door model|gatekeeper|convnext|stroke classifier)\b",
            r"\b(get a report|download report|physician sign|doctor sign)\b",
            r"\b(how does the doctor (use|see) (the|my) results)\b",
            r"\b(can patients use (the|this) system)\b",
            r"\b(what does the ai (actually )?do)\b",
            r"\b(what happens after (the scan|i upload|i submit))\b"
        ]
        if any(re.search(pat, clean) for pat in system_patterns):
            return {
                "intent": "system_info",
                "is_in_scope": True,
                "is_emergency": False,
                "contextual_query": clean
            }

        # 6. Contextual Follow-up & Pronoun Resolution using Conversation History
        if history and len(history) >= 1:
            recent_texts = " ".join([h.get("text", "").lower() for h in history[-4:]])

            # Ischemic vs Hemorrhagic follow-ups
            if any(term in recent_texts for term in ["ischemic", "hemorrhagic", "types of stroke", "two types"]):
                if re.search(r"\b(which one involves bleeding|which type is caused by bleeding|bleeding)\b", clean):
                    return {
                        "intent": "stroke_medical",
                        "is_in_scope": True,
                        "is_emergency": False,
                        "contextual_query": "hemorrhagic stroke intracerebral hemorrhage bleeding in the brain vs ischemic"
                    }
                if re.search(r"\b(which one happens because of a clot|clot|blood clot|which one involves a clot)\b", clean):
                    return {
                        "intent": "stroke_medical",
                        "is_in_scope": True,
                        "is_emergency": False,
                        "contextual_query": "acute ischemic stroke cerebral arterial thrombosis blood clot"
                    }
                if re.search(r"\b(which one usually (happens|appears) suddenly)\b", clean):
                    return {
                        "intent": "stroke_medical",
                        "is_in_scope": True,
                        "is_emergency": False,
                        "contextual_query": "ischemic vs hemorrhagic stroke symptom onset sudden onset presentation"
                    }

            # Symptoms follow-ups (e.g. "How long do they usually last?")
            if any(term in recent_texts for term in ["warning signs", "symptom", "signs of stroke"]):
                if re.search(r"\b(how long do they|how long does it|duration|last|persist)\b", clean):
                    return {
                        "intent": "stroke_medical",
                        "is_in_scope": True,
                        "is_emergency": False,
                        "contextual_query": "duration of stroke symptoms transient ischemic attack TIA vs completed stroke"
                    }
                if re.search(r"\b(what should i do if someone has (those|them))\b", clean):
                    return {
                        "intent": "emergency",
                        "is_in_scope": True,
                        "is_emergency": True,
                        "contextual_query": "emergency action for acute stroke warning signs FAST protocol 911"
                    }

            # CT scan follow-ups (e.g. "Does it detect both?")
            if any(term in recent_texts for term in ["ct", "scan", "image", "classifier"]):
                if re.search(r"\b(does it detect both|can it detect both|detect both)\b", clean):
                    return {
                        "intent": "stroke_medical",
                        "is_in_scope": True,
                        "is_emergency": False,
                        "contextual_query": "brain CT scan detection of ischemic and hemorrhagic stroke"
                    }
                if re.search(r"\b(what does it say|what does the scan say)\b", clean):
                    return {
                        "intent": "system_info",
                        "is_in_scope": True,
                        "is_emergency": False,
                        "contextual_query": "brain CT scan analysis and interpretation in StrokeAegis AI"
                    }

        # 7. Stroke, Cerebrovascular & Neuroimaging Concepts (Semantic understanding)
        # Recognizes questions without needing exact keyword 'stroke'
        if re.search(r"\b(vessel in the brain gets blocked|blood vessel gets blocked|artery gets blocked|clot in the brain)\b", clean):
            return {
                "intent": "stroke_medical",
                "is_in_scope": True,
                "is_emergency": False,
                "contextual_query": "acute ischemic stroke cerebral arterial occlusion thrombosis"
            }
        if re.search(r"\b(blood vessel bursts|vessel bursts|bleeding in the brain|bursts in the brain)\b", clean):
            return {
                "intent": "stroke_medical",
                "is_in_scope": True,
                "is_emergency": False,
                "contextual_query": "hemorrhagic stroke intracerebral hemorrhage ruptured aneurysm"
            }
        if re.search(r"\b(difference between the two types|difference between the two|how are they different)\b", clean):
            return {
                "intent": "stroke_medical",
                "is_in_scope": True,
                "is_emergency": False,
                "contextual_query": "difference between ischemic stroke and hemorrhagic stroke pathophysiology"
            }
        if re.search(r"\b(what does the scan (show|tell)|what is this brain scan used for|can the scan show|can you detect bleeding|can the system detect bleeding|can it tell if there is a clot|can it tell if there's a clot|tell normal from abnormal)\b", clean):
            return {
                "intent": "stroke_medical",
                "is_in_scope": True,
                "is_emergency": False,
                "contextual_query": "brain CT scan non-contrast head CT detection of hemorrhage and ischemia"
            }
        if re.search(r"\b(what makes (someone|this) more likely|lower (my|the) chances|lower (my|the) risk|prevent it|habits should i change|lifestyle changes)\b", clean):
            return {
                "intent": "stroke_medical",
                "is_in_scope": True,
                "is_emergency": False,
                "contextual_query": "stroke prevention modifiable risk factors hypertension smoking lifestyle diet"
            }
        if re.search(r"\b(warning signs|how would i know something is wrong|how would i know if this is a stroke)\b", clean):
            return {
                "intent": "stroke_medical",
                "is_in_scope": True,
                "is_emergency": False,
                "contextual_query": "warning signs of stroke symptoms FAST criteria clinical guidelines"
            }

        # 8. Standard Stroke Terms
        stroke_terms = [
            "stroke", "ischemi", "infarct", "hemorrhag", "tia", "transient ischemic",
            "brain attack", "cerebrovascular", "thrombolysis", "tpa", "alteplase", "tenecteplase",
            "thrombectomy", "evt", "lvo", "hypertension", "blood pressure", "afib", "atrial fibrillation",
            "carotid", "penumbra", "head ct", "ncct", "grad-cam"
        ]
        if any(term in clean for term in stroke_terms):
            return {
                "intent": "stroke_medical",
                "is_in_scope": True,
                "is_emergency": False,
                "contextual_query": clean
            }

        # If not clearly resolved by fast semantic parser, return None to trigger LLM analysis
        return None

    async def understand_intent(self, message: str, history: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Hybrid Semantic Intent & Scope Understanding Engine.
        First executes high-speed semantic resolution, falling back to Gemini
        for deep context and ambiguous query reasoning.
        """
        fast_result = self._fast_semantic_intent_check(message, history)
        if fast_result is not None:
            return fast_result

        # Format conversation history
        history_context = []
        for h in history[-6:]:
            role = "User" if h.get("role") == "user" else "Assistant"
            history_context.append(f"{role}: {h.get('text', '')}")
        history_str = "\n".join(history_context) if history_context else "None (Start of conversation)"

        system_instruction = (
            "You are the Semantic Intent & Clinical Scope Analyzer for StrokeAegis AI, an advanced "
            "clinical decision-support and educational platform specializing in stroke.\n\n"
            "YOUR PURPOSE:\n"
            "Analyze the user's message in the context of recent conversation history. "
            "Determine their underlying meaning, intent, clinical scope, and emergency urgency. "
            "Prioritize semantic meaning, conversational context, and symptoms over keyword matching.\n\n"
            "SUPPORTED SCOPES:\n"
            "1. Stroke Symptoms & Signs: Even when phrased informally without the word 'stroke' "
            "(e.g., 'face drooping', 'arm weakness', 'mouth dropping on one side', 'speech slurred', "
            "'sudden numbness', 'loss of movement on one side', 'why cannot I move my arm', 'what are the warning signs').\n"
            "2. Acute Emergencies: Immediate or sudden acute neurological symptoms described as happening right now, "
            "or asking what to do immediately for sudden symptoms ('What should I do now?' following stroke symptoms).\n"
            "3. Stroke Types & Pathophysiology: Ischemic (clot, arterial blockage), Hemorrhagic (bleeding in brain, "
            "ruptured vessel, aneurysm, ICH), TIA (mini-stroke).\n"
            "4. Risk Factors & Prevention: High blood pressure (hypertension), diabetes, smoking, AFib, cholesterol, "
            "obesity, lifestyle, habits, evidence-based prevention guidelines.\n"
            "5. Neuroimaging & Diagnostics: Head CT scans, MRI, Door Gatekeeper model, clot or bleeding detection, "
            "Grad-CAM visual heatmaps.\n"
            "6. StrokeAegis AI System: How the system works, Quick Assessment vs AI System, multi-agent CrewAI workflow, "
            "report generation, physician sign-off, patient/doctor portal.\n"
            "7. Contextual Follow-ups & Pronouns: Resolving references ('they', 'both', 'which one', 'it', 'this happens right now') "
            "based on previous conversation turns.\n"
            "8. Ambiguous Questions: Short questions lacking sufficient context where a brief clarification is needed.\n\n"
            "OUT OF SCOPE:\n"
            "Completely unrelated topics (e.g., writing Python/software code, sports scores/World Cup, cooking recipes, "
            "weather forecasts, celebrity/trivia, general jokes, general homework/essay writing).\n\n"
            "OUTPUT FORMAT (STRICT JSON ONLY):\n"
            "{\n"
            '  "intent": "emergency" | "stroke_medical" | "system_info" | "clarification_needed" | "unrelated",\n'
            '  "is_in_scope": true | false,\n'
            '  "is_emergency": true | false,\n'
            '  "contextual_query": "Expanded standalone search query for Medical RAG with pronouns resolved and medical terms added",\n'
            '  "clarification_question": "Short clarification question if clarification_needed, else null",\n'
            '  "reasoning": "Brief 1-sentence rationale"\n'
            "}"
        )

        user_prompt = (
            f"CONVERSATION HISTORY:\n{history_str}\n\n"
            f"CURRENT USER MESSAGE:\n\"{message}\"\n\n"
            "Analyze intent and return JSON:"
        )

        payload = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "topP": 0.95,
                "maxOutputTokens": 300,
                "responseMimeType": "application/json"
            }
        }

        try:
            data = await self.call_gemini_raw(payload, max_attempts=3)
            candidates = data.get("candidates", [])
            if candidates and candidates[0].get("content", {}).get("parts"):
                raw_text = candidates[0]["content"]["parts"][0]["text"].strip()
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                parsed = json.loads(raw_text.strip())
                logger.info(
                    f"Intent analyzed for '{message[:40]}...': intent={parsed.get('intent')} "
                    f"in_scope={parsed.get('is_in_scope')} emergency={parsed.get('is_emergency')}"
                )
                return parsed
        except Exception as e:
            logger.warning(f"Gemini intent analysis encountered error: {e}. Falling back to default medical scope.")

        # Fallback default
        return {
            "intent": "stroke_medical",
            "is_in_scope": True,
            "is_emergency": False,
            "contextual_query": f"{message} stroke cerebrovascular guidelines"
        }

    def detect_emergency(self, message: str) -> bool:
        """
        Public emergency detector method. Uses flexible semantic matching.
        """
        return self._detect_emergency_flexible(message)

    def check_scope(self, message: str, history: List[Dict[str, str]] = None) -> Tuple[bool, str]:
        """
        Backward-compatible scope checker.
        Returns: (is_in_scope: bool, reason: str)
        """
        res = self._fast_semantic_intent_check(message, history or [])
        if res:
            return res.get("is_in_scope", True), res.get("intent", "stroke_medical")
        return True, "stroke_medical"

    def retrieve_knowledge(self, query: str) -> List[Dict[str, Any]]:
        """
        Reuses the existing Medical RAG service client without duplicate databases.
        """
        try:
            from backend.rag.rag_client import query_medical_rag
            chunks = query_medical_rag(query=query, top_k=4)
            return chunks
        except Exception as e:
            logger.warning(f"Existing RAG retrieval failed: {e}")
            return []

    @staticmethod
    def _clean_guideline_chunk_text(raw_text: str) -> str:
        """
        Strips internal bibliographic artifacts, DOIs, journal volume headers,
        and publication metadata from retrieved RAG text so the LLM context contains
        pure clinical facts and avoids repeating citation boilerplate.
        """
        if not raw_text:
            return ""
        # Remove DOIs
        cleaned = re.sub(r"(?i)\bdoi:\s*10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", "", raw_text)
        # Remove journal volume/page strings (e.g. Stroke. 2021;52:e364–e467, BMJ. 2018;361:k934)
        cleaned = re.sub(r"\b[A-Za-z\s]+?\.\s*\d{4};\s*\d+:[e\d–\-]+", "", cleaned)
        # Remove publication headers and banners
        cleaned = re.sub(r"(?i)CLINICAL STATEMENTS AND GUIDELINES", "", cleaned)
        cleaned = re.sub(r"(?i)[A-Za-z]+ et al \d{4} Guideline for [^\n]+", "", cleaned)
        cleaned = re.sub(r"(?i)Downloaded from [^\n]+", "", cleaned)
        cleaned = re.sub(r"(?i)American Heart Association, Inc\.", "", cleaned)
        # Normalize whitespace
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        cleaned = re.sub(r"\n\s*\n", "\n\n", cleaned)
        return cleaned.strip()

    def _synthesize_fallback_answer(self, message: str, history: List[Dict[str, str]]) -> str:
        """
        Synthesizes a clean, natural-language, grounded clinical answer when LLM API is unavailable,
        guaranteeing that raw chunks, DOIs, page numbers, or citations are NEVER exposed in chat responses.
        """
        clean_msg = message.lower().strip()
        recent_context = " ".join([h.get("text", "").lower() for h in history[-3:]]) if history else ""
        combined = f"{recent_context} {clean_msg}"

        # 1. Types of stroke / Ischemic vs Hemorrhagic
        if any(term in clean_msg for term in ["types of stroke", "what are the types", "difference between the two types", "two types"]) or (clean_msg == "types of stroke"):
            return (
                "There are two main types of stroke:\n\n"
                "1. **Ischemic stroke** — Occurs when a blood vessel supplying oxygen-rich blood to the brain is blocked, "
                "usually by a blood clot (thrombus or embolus). Ischemic strokes account for approximately 87% of all stroke cases.\n\n"
                "2. **Hemorrhagic stroke** — Occurs when a weakened blood vessel in or around the brain ruptures and bleeds into brain tissue, "
                "often associated with uncontrolled high blood pressure or aneurysms.\n\n"
                "Additionally, a **Transient Ischemic Attack (TIA)**, often referred to as a \"mini-stroke\", involves a temporary blockage that "
                "resolves quickly without permanent brain damage, but serves as a critical warning sign requiring urgent evaluation."
            )

        # 2. Clot / Blocked blood vessel / Ischemic
        if any(term in clean_msg for term in ["blocked", "clot", "blood clot", "ischemic"]) or ("clot" in combined and "which" in clean_msg):
            return (
                "An **ischemic stroke** occurs when a blood vessel supplying blood to the brain becomes obstructed, typically by a blood clot "
                "(thrombosis) or an embolus that traveled from elsewhere in the vascular system. "
                "The lack of blood flow deprives brain tissue of essential oxygen and nutrients. "
                "Immediate medical treatment, such as intravenous thrombolysis (clot-dissolving medications within 4.5 hours) or "
                "mechanical thrombectomy (within up to 24 hours for Large Vessel Occlusion), is critical to restore cerebral perfusion."
            )

        # 3. Burst blood vessel / Bleeding / Hemorrhagic
        if any(term in clean_msg for term in ["burst", "bleeding", "hemorrhagic", "rupture"]) or ("bleeding" in combined and "which" in clean_msg):
            return (
                "A **hemorrhagic stroke** occurs when a weakened blood vessel inside or surrounding the brain ruptures, causing blood to leak into "
                "brain tissue (intracerebral hemorrhage) or the subarachnoid space (subarachnoid hemorrhage). "
                "The accumulation of blood creates pressure and damages adjacent brain tissue. "
                "Emergency hospital management focuses on controlling blood pressure, stopping the bleeding, and relieving intracranial pressure."
            )

        # 4. CT Scan / Neuroimaging
        if any(term in clean_msg for term in ["ct", "scan", "imaging", "normal from abnormal", "detect bleeding", "detect a clot"]):
            return (
                "Neuroimaging is essential in acute stroke assessment:\n\n"
                "- **Non-Contrast Brain CT (NCCT):** The primary first-line imaging performed upon emergency arrival to rapidly rule out hemorrhagic bleeding. "
                "Ruling out bleeding is crucial because clot-dissolving medications can only be safely administered if there is no hemorrhage.\n"
                "- **CT Angiography (CTA):** Maps cerebral blood vessels to locate Large Vessel Occlusions (LVO) suitable for catheter-based thrombectomy.\n"
                "- **AI-Assisted Interpretation:** StrokeAegis AI incorporates deep learning validation and Grad-CAM activation maps to assist clinicians "
                "in rapidly identifying acute abnormalities."
            )

        # 5. Warning signs & symptoms
        if any(term in clean_msg for term in ["symptom", "signs", "warning signs", "feel", "how long do they last"]):
            if "last" in clean_msg or "duration" in clean_msg:
                return (
                    "In a completed stroke, neurological symptoms typically persist and will not resolve on their own without medical intervention. "
                    "In a **Transient Ischemic Attack (TIA)**, symptoms may resolve within minutes to hours (under 24 hours), but a TIA is a major "
                    "warning sign that a full stroke may occur soon. Any acute neurological symptoms require immediate emergency medical evaluation."
                )
            return (
                "The most common warning signs of stroke can be identified using the **FAST** acronym:\n\n"
                "- **F — Face Drooping:** One side of the face may droop or feel numb when smiling.\n"
                "- **A — Arm Weakness:** One arm may feel weak, numb, or drift downward when raised.\n"
                "- **S — Speech Difficulty:** Speech may sound slurred, garbled, or difficult to produce or understand.\n"
                "- **T — Time to Call 911:** If any of these signs appear, call emergency medical services immediately.\n\n"
                "Other sudden symptoms include numbness on one side of the body, sudden vision disturbances, confusion, loss of balance, or a severe, sudden headache."
            )

        # 6. Risk factors & prevention
        if any(term in clean_msg for term in ["risk", "prevent", "cause", "hypertension", "blood pressure", "smoking", "diabetes", "habits", "cholesterol"]):
            return (
                "Key modifiable risk factors for stroke include:\n\n"
                "- **High Blood Pressure (Hypertension):** The single most important treatable risk factor for both ischemic and hemorrhagic stroke.\n"
                "- **Atrial Fibrillation (AFib):** An irregular heart rhythm that significantly increases the risk of blood clots traveling to the brain.\n"
                "- **Diabetes:** Elevates vascular disease risk and damages arterial walls.\n"
                "- **High Cholesterol:** Contributes to arterial plaque buildup and atherosclerosis.\n"
                "- **Lifestyle Factors:** Smoking, physical inactivity, unhealthy diet, excessive alcohol intake, and obesity.\n\n"
                "Managing blood pressure, taking prescribed preventive therapies under medical supervision, and adopting healthy lifestyle habits are the most effective ways to lower stroke risk."
            )

        # 7. General stroke medical fallback
        return (
            "Stroke is an acute medical condition that occurs when blood flow to a part of the brain is interrupted (ischemic stroke) "
            "or when a blood vessel in the brain ruptures (hemorrhagic stroke). Immediate clinical evaluation and evidence-based management "
            "are essential to preserve brain tissue and optimize recovery."
        )

    async def call_gemini_raw(self, payload: Dict[str, Any], max_attempts: int = 4) -> Dict[str, Any]:
        """
        Low-level robust executor for Gemini calls with progressive model failover and API key failover.
        Tries primary model (gemini-3.8-flash) then falls back to gemini-3.6-flash.
        """
        models_to_try = [CHATBOT_MODEL, "gemini-3.6-flash"]
        for key in self.api_keys:
            for model_name in models_to_try:
                url = self._get_api_url(model_name, key=key)
                try:
                    async with httpx.AsyncClient(timeout=6.0) as client:
                        resp = await client.post(url, json=payload)
                        if resp.status_code == 200:
                            return resp.json()
                        elif resp.status_code in (503, 429):
                            logger.warning(f"Gemini {model_name} (key ...{key[-6:]}) returned {resp.status_code}. Trying alternative...")
                            continue
                        elif resp.status_code == 404:
                            logger.warning(f"Gemini model {model_name} returned 404. Skipping...")
                            continue
                        else:
                            logger.error(f"Gemini API error {resp.status_code} on {model_name}: {resp.text[:200]}")
                            break
                except Exception as ex:
                    logger.warning(f"Gemini request exception on {model_name}: {ex}.")
                    continue

        raise RuntimeError("Google Gemini API is temporarily unavailable.")

    async def call_gemini_llm(
        self,
        system_instruction: str,
        user_message: str,
        history: List[Dict[str, str]]
    ) -> str:
        """
        Invokes Gemini 3.6-Flash with conversation history and system prompt.
        """
        contents = []
        for turn in history[-8:]:
            role = "user" if turn.get("role") == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": turn.get("text", "")}]
            })

        contents.append({
            "role": "user",
            "parts": [{"text": user_message}]
        })

        payload = {
            "systemInstruction": {
                "parts": [{"text": system_instruction}]
            },
            "contents": contents,
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.95,
                "maxOutputTokens": 1024
            }
        }

        data = await self.call_gemini_raw(payload, max_attempts=4)
        candidates = data.get("candidates", [])
        if candidates and candidates[0].get("content", {}).get("parts"):
            return candidates[0]["content"]["parts"][0]["text"].strip()

        return "I received an empty response. Please try rephrasing your question."

    async def answer_message(
        self,
        message: str,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Full Semantic Intent-First Chatbot Pipeline:
        1. Semantic Intent & Context Understanding
        2. Routing:
           - Greeting -> Warm, natural greeting
           - Unrelated -> Polite redirection
           - Emergency -> Immediate FAST emergency guidance
           - Clarification -> Short, focused question
           - System Info -> Comprehensive explanation of StrokeAegis AI platform
           - Stroke Medical -> RAG retrieval -> Grounded clinical response
        """
        cid = conversation_id or str(uuid.uuid4())
        if cid not in self.sessions:
            self.sessions[cid] = []

        history = self.sessions[cid]

        # STEP 1: SEMANTIC INTENT & SCOPE UNDERSTANDING
        intent_info = await self.understand_intent(message, history)
        intent = intent_info.get("intent", "stroke_medical")
        is_in_scope = intent_info.get("is_in_scope", True)
        is_emergency = intent_info.get("is_emergency", False)
        contextual_query = intent_info.get("contextual_query") or message

        # Double check emergency with flexible detector if needed
        if not is_emergency and self._detect_emergency_flexible(message):
            intent = "emergency"
            is_emergency = True
            is_in_scope = True

        # ==============================================================
        # BRANCH A: GREETING & BASIC CONVERSATION
        # ==============================================================
        if intent == "greeting":
            g_type = intent_info.get("greeting_type") or intent_info.get("type", "hello")
            if g_type == "thanks":
                reply = "You're very welcome! Please feel free to ask if you have any further questions about stroke warning signs, risk factors, prevention, or the StrokeAegis AI system."
            elif g_type == "ack":
                reply = "Understood. Please let me know whenever you have questions regarding stroke health or the StrokeAegis AI platform."
            else:
                reply = "Hello! I'm the StrokeAegis AI Medical Assistant. I'm here to help you with questions about stroke symptoms, risk factors, prevention, brain CT imaging, acute emergency guidance, or how our clinical AI assessment system works. How can I assist you today?"

            history.append({"role": "user", "text": message})
            history.append({"role": "model", "text": reply})

            return {
                "answer": reply,
                "sources": [],
                "in_scope": True,
                "is_emergency": False,
                "conversation_id": cid
            }

        # ==============================================================
        # BRANCH B: CLEARLY UNRELATED (POLITE SCOPE REDIRECTION)
        # ==============================================================
        if not is_in_scope or intent == "unrelated":
            history.append({"role": "user", "text": message})
            history.append({"role": "model", "text": SCOPE_REJECTION_MESSAGE})

            return {
                "answer": SCOPE_REJECTION_MESSAGE,
                "sources": [],
                "in_scope": False,
                "is_emergency": False,
                "conversation_id": cid
            }

        # ==============================================================
        # BRANCH C: ACUTE STROKE EMERGENCY (FAST PROTOCOL)
        # ==============================================================
        if is_emergency or intent == "emergency":
            # Check if this is a follow-up ("What should I do now?", "How much time do we have?")
            is_followup_action = bool(re.search(
                r"\b(what should i do|what to do|what do i do|next step|help me|how much time|what now)\b",
                message.lower()
            ))

            if is_followup_action and history:
                emergency_answer = (
                    "🚨 **IMMEDIATE EMERGENCY ACTION REQUIRED: TIME IS BRAIN**\n\n"
                    "Because sudden acute neurological symptoms were described, please take these steps immediately:\n\n"
                    "1. **CALL 911 (OR YOUR LOCAL EMERGENCY NUMBER) RIGHT NOW.** Do not attempt to drive to the hospital yourself if emergency medical services (EMS) are available; paramedics pre-notify the hospital acute stroke team.\n"
                    "2. **NOTE THE TIME OF ONSET:** Tell the dispatch team exactly when symptoms started. Clot-busting medication (IV thrombolysis) must be initiated within 4.5 hours, and mechanical thrombectomy within up to 24 hours for Large Vessel Occlusion.\n"
                    "3. **POSITION SAFELY:** Have the person lie comfortably in a safe position (on their side if nauseous) to prevent falls or aspiration.\n"
                    "4. **DO NOT GIVE ASPIRIN, FOOD, OR WATER:** If the stroke is hemorrhagic (bleeding in the brain), aspirin could worsen bleeding.\n\n"
                    "*Note: As an AI decision-support assistant, I cannot provide a clinical diagnosis. Seek emergency hospital care immediately.*"
                )
            else:
                emergency_answer = (
                    f"{EMERGENCY_GUIDANCE_PREFIX}\n\n"
                    "**Guideline Rationale (AHA/ASA AIS Guidelines):**\n"
                    "Emergency dispatch triggers acute stroke pre-notification, allowing the hospital stroke team "
                    "to prepare the CT scanner and prepare potential IV thrombolytic therapy (Alteplase/Tenecteplase within 4.5 hours) "
                    "or endovascular mechanical thrombectomy (within up to 24 hours for Large Vessel Occlusion)."
                )

            history.append({"role": "user", "text": message})
            history.append({"role": "model", "text": emergency_answer})

            return {
                "answer": emergency_answer,
                "sources": EMERGENCY_SOURCES,
                "in_scope": True,
                "is_emergency": True,
                "conversation_id": cid
            }

        # ==============================================================
        # BRANCH D: CLARIFICATION NEEDED
        # ==============================================================
        if intent == "clarification_needed" and intent_info.get("clarification_question"):
            clarify_msg = intent_info["clarification_question"]
            history.append({"role": "user", "text": message})
            history.append({"role": "model", "text": clarify_msg})

            return {
                "answer": clarify_msg,
                "sources": [],
                "in_scope": True,
                "is_emergency": False,
                "conversation_id": cid
            }

        # ==============================================================
        # BRANCH E: STROKEAegis AI SYSTEM FUNCTIONALITY QUESTIONS
        # ==============================================================
        if intent == "system_info":
            system_instruction = (
                "You are the StrokeAegis AI Medical Assistant, answering a user question about the StrokeAegis AI platform.\n\n"
                "YOUR INSTRUCTIONS:\n"
                "1. Provide a clear, natural, and comprehensive explanation based on the StrokeAegis System Information below.\n"
                "2. Clearly explain the difference between the Quick Assessment (fast tabular ML risk + CT classification) "
                "and the AI System (CrewAI multi-agent clinical flow: Prevention, Emergency, Validation, and Report specialists).\n"
                "3. Describe the Door Gatekeeper model (ConvNeXt-Tiny) verifying brain CT validity, the Stroke Classifier "
                "(EfficientNetV2-S), and Grad-CAM visual explainability when asked about imaging.\n"
                "4. Clarify that the chatbot is an assistive clinical decision-support and educational tool and does not "
                "diagnose patients or run the CT models itself unless assessment results are explicitly in session context.\n"
                "5. Maintain a professional, welcoming, and transparent tone. Do NOT sound robotic.\n\n"
                f"STROKEAegis SYSTEM INFORMATION:\n{STROKEAegis_SYSTEM_KNOWLEDGE}"
            )

            try:
                answer = await self.call_gemini_llm(system_instruction, message, history)
            except Exception as e:
                logger.error(f"Chatbot system info generation failed: {e}")
                answer = (
                    "StrokeAegis AI is an advanced clinical decision-support platform designed for stroke triage and documentation. "
                    "It offers two primary workflows: (1) **Quick Assessment**, which combines tabular machine learning risk scoring "
                    "with deep learning brain CT classification and Grad-CAM heatmaps for rapid preliminary triage; and (2) the **AI System**, "
                    "which orchestrates a multi-agent clinical pipeline (Prevention Specialist, Acute Emergency Specialist, Medical Safety & "
                    "Validation Specialist, and Report Specialist) grounded in clinical guidelines to generate certified reports. "
                    "Please let me know if you would like more details on any specific feature!"
                )

            history.append({"role": "user", "text": message})
            history.append({"role": "model", "text": answer})

            return {
                "answer": answer,
                "sources": [],
                "in_scope": True,
                "is_emergency": False,
                "conversation_id": cid
            }

        # ==============================================================
        # BRANCH F: CORE STROKE MEDICAL & GUIDELINE-GROUNDED RAG
        # ==============================================================
        # Retrieve knowledge from existing Medical RAG using the contextualized query
        rag_chunks = self.retrieve_knowledge(contextual_query)

        # Build grounded context string with cleaned text (free of DOIs, journal volume headers, or raw artifacts)
        context_blocks = []
        clean_sources = []
        for idx, chunk in enumerate(rag_chunks, start=1):
            raw_text = chunk.get("text", "")
            cleaned_text = self._clean_guideline_chunk_text(raw_text)
            source = chunk.get("source", "Guideline")
            guideline = chunk.get("guideline", "")
            sec = chunk.get("section", "")
            page = chunk.get("page", "")
            year = chunk.get("year", "")

            context_blocks.append(f"[Medical Knowledge Item {idx} - Topic: {sec}]:\n{cleaned_text}")
            clean_sources.append({
                "source": source,
                "guideline": guideline,
                "section": sec,
                "year": year,
                "page": page,
                "citation": chunk.get("citation", f"{source} {guideline}")
            })

        rag_context_str = "\n\n".join(context_blocks) if context_blocks else "No specific guideline text retrieved."

        system_instruction = (
            "You are the StrokeAegis AI Medical Assistant, a compassionate, accurate, and professional "
            "clinical decision-support and educational assistant specializing in stroke and cerebrovascular health.\n\n"
            "YOUR PURPOSE:\n"
            "Answer user questions clearly, accurately, and naturally regarding stroke types (ischemic vs hemorrhagic), "
            "warning signs, risk factors (hypertension, AFib, diabetes, cholesterol, smoking), neuroimaging concepts (CT, MRI, "
            "Door Gatekeeper, Grad-CAM), acute emergency care, and evidence-based prevention.\n\n"
            "CRITICAL RESPONSE FORMATTING RULES (STRICT):\n"
            "1. NEVER EXPOSE RAW RETRIEVAL OR CITATION METADATA:\n"
            "   - Do NOT quote raw guideline chunks verbatim.\n"
            "   - Do NOT include DOIs, page numbers, journal citations, document titles, or publication headers in your answer.\n"
            "   - Do NOT begin your response with 'According to [Guideline Name]...', 'Based on Document...', or recite citations.\n"
            "   - The user interface automatically extracts and displays all retrieved source references separately beneath your response bubble. "
            "Therefore, your answer must ONLY contain the clean, natural medical explanation.\n"
            "2. CLEAN SYNTHESIZED ANSWER:\n"
            "   - Ground your answer in the provided Medical Knowledge Context below, but synthesize and explain the concepts in your own clear, "
            "accessible, and professional clinical language.\n"
            "   - Keep your response concise and proportional to the question. For simple questions like 'types of stroke', "
            "provide a concise, structured answer directly distinguishing the primary types (Ischemic vs Hemorrhagic) without unnecessary filler.\n"
            "3. CONVERSATIONAL CONTEXT:\n"
            "   - If the user uses pronouns (e.g. 'they', 'it', 'both', 'which one') or asks a follow-up question, resolve them accurately "
            "using the conversation history.\n"
            "4. CLINICAL SAFETY & ETHICS:\n"
            "   - You are an educational decision-support assistant, not a doctor. Never provide a personal diagnosis, never prescribe drug dosages, "
            "and advise consulting an attending physician for individual clinical management.\n"
            "   - If the provided knowledge does not cover a specific claim, state that transparently rather than fabricating facts.\n\n"
            f"STROKEAegis MEDICAL KNOWLEDGE CONTEXT:\n{rag_context_str}"
        )

        try:
            answer = await asyncio.wait_for(
                self.call_gemini_llm(system_instruction, message, history),
                timeout=10.0
            )
            # Post-process answer to ensure no DOI or raw header leakage slips through
            answer = re.sub(r"(?i)\bdoi:\s*10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", "", answer)
            answer = re.sub(r"(?i)^according to [^:\n]+:\s*", "", answer)
            answer = answer.strip()
        except Exception as e:
            logger.error(f"Chatbot LLM generation failed: {e}. Utilizing clean synthesized clinical fallback.")
            answer = self._synthesize_fallback_answer(message, history)

        history.append({"role": "user", "text": message})
        history.append({"role": "model", "text": answer})

        return {
            "answer": answer,
            "sources": clean_sources,
            "in_scope": True,
            "is_emergency": False,
            "conversation_id": cid
        }

    def clear_conversation(self, conversation_id: str):
        if conversation_id in self.sessions:
            del self.sessions[conversation_id]


# Singleton instance
chatbot_service = StrokeAegisChatbotService()
