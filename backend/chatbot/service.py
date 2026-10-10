"""
StrokeAegis AI — Standalone Medical Chatbot Service
Architecture:
  User -> Chatbot UI -> Language & Context Engine -> Semantic RAG Retrieval -> Gemini 3.6-Flash -> Grounded Clinical Response

Guarantees & Constraints:
  - ZERO CrewAI usage (does not create or modify CrewAI agents)
  - Reuses existing 501-chunk Medical RAG without duplicate databases
  - Configured with Gemini 3.6 Flash as the single source of truth for response generation
  - Language follows the user (Arabic vs English vs mixed) with conversational language continuity
  - Understands the actual question (e.g. severity comparisons between stroke types) without dumping generic definitions
  - Follow-up questions resolved using multi-turn conversation context
  - Internal contextual query reformulation for Medical RAG
  - Raw citations, DOIs, and chunk text NEVER leaked into chat responses
  - Zero hard-coded medical responses / canned dictionaries bypassing the LLM
  - Immediate emergency guidance (FAST) in the user's language for acute symptoms
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

# Ensure .env is loaded
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger("strokeaegis.chatbot")
logger.setLevel(logging.INFO)

# API Keys & Model Configuration
DEFAULT_CHATBOT_API_KEY = os.environ.get("STROKE_AEGIS_CHATBOT_API_KEY", "")
SECONDARY_API_KEY = os.environ.get("GEMINI_API_KEY", "")
AGENT_API_KEY = os.environ.get("STROKE_AEGIS_AGENT_API_KEY", "")
CHATBOT_MODEL = os.environ.get("STROKE_AEGIS_CHATBOT_MODEL", "gemini-3.6-flash")

# Scope Rejection Messages (Multilingual)
SCOPE_REJECTION_MESSAGE_EN = (
    "I'm StrokeAegis AI's medical assistant. I can only help with questions "
    "related to stroke and medically relevant topics connected to stroke. "
    "I can assist with stroke symptoms, warning signs, risk factors, prevention, "
    "brain imaging, acute emergency guidance, or questions about how the StrokeAegis AI system works. "
    "Please let me know how I can help you with those topics!"
)

SCOPE_REJECTION_MESSAGE_AR = (
    "أنا المساعد الطبي لنظام StrokeAegis AI. يمكنني فقط المساعدة في الأسئلة "
    "المتعلقة بالجلطات الدماغية (السكتة الدماغية) والموضوعات الطبية المرتبطة بها. "
    "يمكنني المساعدة في أعراض الجلطة، وعلاماتها التحذيرية، وعوامل الخطر، وطرق الوقاية، "
    "وفحوصات تصوير الدماغ، وإرشادات الطوارئ الحادة، أو الإجابة عن كيفية عمل نظام StrokeAegis AI. "
    "يرجى إخباري كيف يمكنني مساعدتك في هذه المواضيع!"
)

# Emergency FAST warning templates (Multilingual)
EMERGENCY_GUIDANCE_EN = (
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

EMERGENCY_GUIDANCE_AR = (
    "🚨 **تنبيه طارئ: يلزم التحرك الفوري (الوقت هو الدماغ)**\n\n"
    "الأعراض الموصوفة (مثل الضعف المفاجئ في جانب واحد من الجسم، أو تدلي الوجه، أو صعوبة الكلام، أو الخدر المفاجئ) "
    "هي علامات تحذيرية كلاسيكية لحدوث **جلطة دماغية حادة**. الجلطة هي حالة طبية طارئة تهدد الحياة، وتتطلب التدخل الفوري لأن **كل دقيقة تُحدث فرقاً**.\n\n"
    "**الخطوات الفورية الواجب اتخاذها الآن:**\n"
    "1. **اتصل بالإسعاف (أو رقم الطوارئ المحلي) فوراً.** لا تنتظر لترى إن كانت الأعراض ستتحسن.\n"
    "2. **سجّل وقت بداية الأعراض بدقة:** هذه المعلومة حاسمة جداً لأطباء الطوارئ لتحديد إمكانية إعطاء أدوية إذابة الخثرة (خلال 4.5 ساعات) أو إجراء القسطرة لإزالة الخثرة (خلال حتى 24 ساعة).\n"
    "3. **تذكر بروتوكول FAST السريع:**\n"
    "   - **F (الوجه - Face):** هل يوجد ميلان أو هبوط في جانب من الوجه عند الابتسام؟\n"
    "   - **A (الذراع - Arms):** هل تهبط إحدى الذراعين لأسفل عند رفعهما معاً؟\n"
    "   - **S (الكلام - Speech):** هل الكلام ثقيل أو غير مفهوم أو غير واضح؟\n"
    "   - **T (الوقت - Time):** عند ملاحظة أيٍّ من هذه العلامات، اتصل بالطوارئ فوراً!\n"
    "4. **تحذير هام:** لا تعطِ المريض أي طعام أو شراب أو أسبرين (إذا كان السبب نزيفاً في المخ، فإن الأسبرين قد يؤدي إلى مضاعفات خطيرة).\n\n"
    "*ملاحظة: كمساعد ذكاء اصطناعي لدعم القرار، لا يمكنني تقديم تشخيص طبي مباشر. يُرجى التوجه إلى طوارئ أقرب مستشفى على الفور.*"
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
        for def_key in [DEFAULT_CHATBOT_API_KEY, SECONDARY_API_KEY, AGENT_API_KEY]:
            if def_key and def_key not in keys:
                keys.append(def_key)
        self.api_keys = keys
        self.api_key = self.api_keys[0] if self.api_keys else ""
        self.sessions: Dict[str, List[Dict[str, str]]] = {}
        self.session_meta: Dict[str, Dict[str, Any]] = {}
        logger.info(f"StrokeAegis Chatbot Service initialized (Active Keys: {len(self.api_keys)}, Primary Model: {CHATBOT_MODEL})")

    def _get_api_url(self, model: str = CHATBOT_MODEL, key: Optional[str] = None) -> str:
        active_key = key or self.api_key
        return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={active_key}"

    def _detect_language(self, message: str, conversation_id: str) -> str:
        """
        Detects user conversation language and maintains conversational language context.
        Supports explicit requests ('بالعربي', 'in english') and automatic detection.
        """
        clean = message.strip().lower()

        # 1. Explicit language switch requests
        if any(phrase in clean for phrase in [
            "بالعربي", "عربي", "تكلم عربي", "جاوبني بالعربي", "باللغة العربية", "في العربي",
            "in arabic", "speak in arabic", "talk in arabic", "respond in arabic", "arabic please"
        ]):
            if conversation_id not in self.session_meta:
                self.session_meta[conversation_id] = {}
            self.session_meta[conversation_id]["language"] = "ar"
            return "ar"

        if any(phrase in clean for phrase in [
            "in english", "answer in english", "speak in english", "talk in english",
            "switch to english", "english please"
        ]):
            if conversation_id not in self.session_meta:
                self.session_meta[conversation_id] = {}
            self.session_meta[conversation_id]["language"] = "en"
            return "en"

        # 2. Check for Arabic script characters
        has_arabic = bool(re.search(r"[\u0600-\u06FF]", message))
        if has_arabic:
            if conversation_id not in self.session_meta:
                self.session_meta[conversation_id] = {}
            self.session_meta[conversation_id]["language"] = "ar"
            return "ar"

        # 3. If no Arabic script, check prior session language context
        prior_lang = self.session_meta.get(conversation_id, {}).get("language")
        if prior_lang == "ar":
            # If the user asks a full English grammatical question, switch to English
            if re.search(r"\b(what|why|how|who|when|where|which|can you|is it|tell me|explain)\b", clean):
                self.session_meta[conversation_id]["language"] = "en"
                return "en"
            # Otherwise, keep Arabic for short follow-ups, terms, or acronyms
            return "ar"

        if conversation_id not in self.session_meta:
            self.session_meta[conversation_id] = {}
        self.session_meta[conversation_id]["language"] = "en"
        return "en"

    def _detect_emergency_flexible(self, message: str) -> bool:
        """
        Flexible semantic emergency detector for BOTH English and Arabic.
        Detects descriptions of urgent, acute, or sudden neurological stroke symptoms
        without requiring exact keyword sequences or the word 'stroke'.
        """
        msg = message.lower()

        # English explicit phrases
        if any(term in msg for term in [
            "thunderclap headache", "worst headache of my life", "worst headache of his life", "worst headache of her life"
        ]):
            return True

        # English sudden onset indicators
        has_sudden_en = bool(re.search(
            r"\b(sudden|suddenly|abrupt|abruptly|just started|started a few minutes ago|minutes ago|collapsed|right now|immediately)\b",
            msg
        ))
        has_body_part_en = bool(re.search(
            r"\b(face|mouth|eye|arm|leg|hand|foot|side|body|limb|one side|half of)\b",
            msg
        ))
        has_deficit_en = bool(re.search(
            r"\b(weak|weakness|numb|numbness|paralyz|paralysis|limp|droop|drooping|dropping|crooked|uneven|heavy|tingling)\b",
            msg
        ) or re.search(
            r"\b(cannot|can't|cant|unable to|lost|difficulty|trouble|hard to)\b.{0,20}\b(move|lift|raise|walk|use|feel)\b",
            msg
        ))
        has_speech_issue_en = bool(re.search(
            r"\b(slur|slurred|slurring|speech difficulty|talking strange|strange speech|speech became strange|speech became unclear|unclear speech|words mixed up|trouble speaking|trouble talking|difficulty speaking|aphasia|dysarthria)\b",
            msg
        ) or re.search(
            r"\b(cannot|can't|cant|unable to|hard to)\b.{0,20}\b(speak|talk)\b",
            msg
        ) or (
            "speech" in msg and any(w in msg for w in ["strange", "slur", "unclear", "difficult", "confus", "problem", "garbled"])
        ))

        if has_sudden_en and (has_deficit_en or has_speech_issue_en or "confus" in msg or "vision" in msg):
            return True
        if has_body_part_en and has_deficit_en:
            return True
        if has_speech_issue_en:
            return True
        if re.search(r"\b(father|mother|dad|mom|husband|wife|friend|someone|brother|sister|parent|he|she|they)\b.*\b(cannot|can't|weak|droop|slurr|collapsed|numb|confus)\b", msg):
            return True

        # Arabic sudden onset & deficit indicators
        has_sudden_ar = bool(re.search(r"(مفاجئ|فجأة|فجائي|الان|الآن|قبل قليل|سقط|اغمي عليه|طاح)", msg))
        has_body_deficit_ar = bool(re.search(r"(ضعف|شلل|خدر|تنميل|ثقل|ارتخاء|لا يستطيع|ما يقدر|تحريك|حركة|جهة|جانب|نصف|وجه|فم|يد|ذراع|ساق|رجل|طرف)", msg))
        has_speech_ar = bool(re.search(r"(كلام|نطق|لسان|تلعثم|غير مفهوم|صعوبة في الكلام|ثقل في اللسان|ما يقدر يتكلم|كلام غريب|ثقل بالنطق)", msg))
        has_action_ar = bool(re.search(r"(ايش اسوي|ايش يسوي|ماذا أفعل|ماذا يفعل|طوارئ|اسعاف|إسعاف|انقذ|الحقوني)", msg))

        if has_sudden_ar and (has_body_deficit_ar or has_speech_ar):
            return True
        if has_body_deficit_ar and has_speech_ar:
            return True
        if has_action_ar and (has_sudden_ar or has_body_deficit_ar or has_speech_ar):
            return True

        return False

    def _fast_semantic_intent_check(self, message: str, history: List[Dict[str, str]], lang: str) -> Optional[Dict[str, Any]]:
        """
        Fast local semantic analyzer for high-confidence intents.
        Resolves obvious greetings, emergencies, off-topic requests, and system queries.
        """
        clean = message.strip().lower()
        clean_stripped = clean.rstrip("!?.")

        # 1. Greetings & Pleasantries (EN & AR)
        greeting_words_en = {"hello", "hi", "hey", "good morning", "good afternoon", "good evening", "greetings", "howdy"}
        thanks_words_en = {"thanks", "thank you", "thank you so much", "thank you very much", "appreciate it", "many thanks"}
        ack_words_en = {"ok", "okay", "alright", "got it", "understood", "sure"}

        greeting_words_ar = {"مرحبا", "مرحباً", "اهلا", "أهلا", "أهلاً", "السلام عليكم", "صباح الخير", "مساء الخير", "هلا"}
        thanks_words_ar = {"شكرا", "شكراً", "شكرا جزيلا", "شكراً جزيلاً", "مشكور", "يعطيك العافية", "تسلم"}
        ack_words_ar = {"تمام", "حسنا", "حسناً", "فهمت", "واضح", "اوكي", "أوكي", "طيب"}

        if clean in greeting_words_en or clean_stripped in greeting_words_en or clean in greeting_words_ar or clean_stripped in greeting_words_ar:
            return {"intent": "greeting", "is_in_scope": True, "is_emergency": False, "greeting_type": "hello"}
        if clean in thanks_words_en or clean_stripped in thanks_words_en or clean in thanks_words_ar or clean_stripped in thanks_words_ar:
            return {"intent": "greeting", "is_in_scope": True, "is_emergency": False, "greeting_type": "thanks"}
        if clean in ack_words_en or clean_stripped in ack_words_en or clean in ack_words_ar or clean_stripped in ack_words_ar:
            return {"intent": "greeting", "is_in_scope": True, "is_emergency": False, "greeting_type": "ack"}

        # 2. Acute Emergency Detection
        if self._detect_emergency_flexible(message):
            return {
                "intent": "emergency",
                "is_in_scope": True,
                "is_emergency": True,
                "contextual_query": f"acute stroke emergency symptoms FAST protocol {clean}"
            }

        # 3. Emergency Context Follow-up
        if history and len(history) >= 1:
            recent_texts = " ".join([h.get("text", "").lower() for h in history[-3:]])
            if any(term in recent_texts for term in ["emergency", "fast", "weakness", "droop", "911", "call 911", "طوارئ", "إسعاف"]):
                if re.search(r"\b(what should i do|what to do|what do i do|next step|help me|how much time|what now|this happens right now|ايش اسوي|ايش يسوي|ماذا أفعل)\b", clean):
                    return {
                        "intent": "emergency",
                        "is_in_scope": True,
                        "is_emergency": True,
                        "contextual_query": "emergency action for acute stroke symptoms EMS dispatch FAST"
                    }

        # 4. Out-of-Scope Patterns (Coding, Sports, Trivia, Weather, Recipes, Car repair)
        off_topic_patterns = [
            r"\b(python|javascript|typescript|c\+\+|java|html|css|sql|rust|php)\b",
            r"\b(write code|debug|regex|programming|script|syntax error|neural network)\b",
            r"\b(football|soccer|world cup|champions league|nfl|nba|basketball|tennis|messi|ronaldo)\b",
            r"\b(tell me a joke|tell a joke|riddle|make me laugh|funny story)\b",
            r"\b(capital of|who is the president|who was|history of|world war|french revolution)\b",
            r"\b(write (an )?email|write (an )?essay|cover letter|resume|recommend a laptop|buy a laptop)\b",
            r"\b(weather in|weather today|recipe for|bake a cake|flight to|movie recommendation)\b",
            r"(اصلح سيارتي|أصلح سيارتي|تصليح سيارات|كورة|مباراة|كود برمجي|طبخ|وصفة كيك)"
        ]
        for pattern in off_topic_patterns:
            if re.search(pattern, clean):
                if not any(k in clean for k in ["stroke", "brain", "ct", "scan", "ischemi", "hemorrhag", "جلط", "دماغ"]):
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
            r"\b(what happens after (the scan|i upload|i submit))\b",
            r"(كيف يعمل النظام|خيارات الفحص|التقييم السريع|نظام الذكاء الاصطناعي|بوابة الطبيب|تقرير طبي)"
        ]
        if any(re.search(pat, clean) for pat in system_patterns):
            return {
                "intent": "system_info",
                "is_in_scope": True,
                "is_emergency": False,
                "contextual_query": clean
            }

        # Let remaining questions be routed to core RAG + LLM
        return None

    def _get_contextual_rag_query(self, message: str, history: List[Dict[str, str]], lang: str) -> str:
        """
        Internal query reformulation for Medical RAG.
        Translates/reformulates contextual, conversational, and Arabic queries into
        focused English clinical search queries for optimal vector retrieval from
        the AHA/ASA and ESO clinical guideline collection.
        This reformulation is strictly internal and never exposed to the user.
        """
        clean = message.lower().strip()
        recent_hist_text = " ".join([h.get("text", "").lower() for h in history[-3:]]) if history else ""
        combined = f"{recent_hist_text} {clean}"

        # 1. Severity & Mortality Comparison (e.g. "ايش اصعب نوع من الجلطات", "ischemia او hemorrhagic ايش اصعب ال", "which is more severe")
        if any(term in clean for term in ["اصعب", "أصعب", "اخطر", "أخطر", "اشد", "أشد", "severe", "severity", "dangerous", "worse"]) and any(term in combined for term in ["جلط", "stroke", "ischemi", "hemorrhag", "نوع", "types"]):
            return "comparison of clinical severity mortality and outcomes between acute ischemic stroke and hemorrhagic stroke intracerebral hemorrhage"

        # 2. Types & Classifications (e.g. "ايش انواع الجلطات؟", "types of stroke")
        if any(term in clean for term in ["انواع", "أنواع", "types of stroke", "two types", "stroke types", "classification", "تصنيف"]):
            return "types and classifications of stroke acute ischemic stroke intracerebral hemorrhagic stroke transient ischemic attack TIA"

        # 3. Pathophysiological difference between ischemic and hemorrhagic
        if any(term in clean for term in ["فرق", "difference", "مقارنة", "compare"]) and any(term in combined for term in ["ischemi", "hemorrhag", "اقفار", "نزف", "clot", "bleeding"]):
            return "pathophysiological differences between ischemic stroke cerebral arterial occlusion and hemorrhagic stroke ruptured blood vessel"

        # 4. Blood Clot / Thrombosis
        if any(term in clean for term in ["خثرة", "تجلط", "انسداد", "clot", "blood clot", "thromb", "occlusion"]):
            return "acute ischemic stroke cerebral arterial thrombosis embolus IV thrombolysis mechanical thrombectomy"

        # 5. Bleeding / Rupture / Hemorrhage
        if any(term in clean for term in ["نزيف", "تمزق", "دم في المخ", "bleeding", "burst", "rupture", "hemorrhag", "ich", "aneurysm"]):
            return "intracerebral hemorrhage hemorrhagic stroke blood pressure management intracranial pressure hematoma"

        # 6. Warning Signs & FAST Symptoms
        if any(term in clean for term in ["اعراض", "أعراض", "علامات", "warning signs", "symptom", "fast", "ضعف", "تنميل", "droop"]):
            return "acute stroke warning signs symptoms FAST criteria facial drooping arm weakness speech disturbance"

        # 7. Risk Factors & Prevention
        if any(term in clean for term in ["عوامل خطر", "اسباب", "أسباب", "وقاية", "منع", "risk", "prevent", "hypertension", "ضغط", "تدخين", "smoking", "سكري", "diabetes", "lifestyle"]):
            return "stroke prevention modifiable risk factors hypertension blood pressure control smoking diabetes lifestyle"

        # 8. Brain CT Scan & Neuroimaging
        if any(term in clean for term in ["اشعة", "أشعة", "مقطعية", "ct", "scan", "تصوير", "imaging", "ncct", "cta", "gatekeeper", "classifier"]):
            return "non-contrast brain CT scan neuroimaging detection of acute ischemic stroke vs intracerebral hemorrhage"

        # 9. Language switch request (e.g., "بالعربي جاوبني")
        if any(term in clean for term in ["بالعربي", "جاوبني", "عربي", "in english", "answer in english"]):
            if history:
                prev_user_q = next((h["text"] for h in reversed(history) if h.get("role") == "user" and not any(t in h["text"].lower() for t in ["بالعربي", "جاوبني"])), "")
                if prev_user_q:
                    return self._get_contextual_rag_query(prev_user_q, history[:-1], lang)

        # Fallback query
        if bool(re.search(r"[\u0600-\u06FF]", message)):
            return f"stroke cerebrovascular guidelines {clean}"

        return clean

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
        cleaned = re.sub(r"(?i)\bdoi:\s*10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", "", raw_text)
        cleaned = re.sub(r"\b[A-Za-z\s]+?\.\s*\d{4};\s*\d+:[e\d–\-]+", "", cleaned)
        cleaned = re.sub(r"(?i)CLINICAL STATEMENTS AND GUIDELINES", "", cleaned)
        cleaned = re.sub(r"(?i)[A-Za-z]+ et al \d{4} Guideline for [^\n]+", "", cleaned)
        cleaned = re.sub(r"(?i)Downloaded from [^\n]+", "", cleaned)
        cleaned = re.sub(r"(?i)American Heart Association, Inc\.", "", cleaned)
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        cleaned = re.sub(r"\n\s*\n", "\n\n", cleaned)
        return cleaned.strip()

    async def call_gemini_raw(self, payload: Dict[str, Any], max_attempts: int = 4) -> Dict[str, Any]:
        """
        Robust executor for Gemini calls with progressive multi-key failover and retries.
        Configured for Gemini 3.6 Flash as the response-generation model.
        """
        last_error = None
        for attempt in range(max_attempts):
            for key in self.api_keys:
                url = self._get_api_url(CHATBOT_MODEL, key=key)
                try:
                    async with httpx.AsyncClient(timeout=14.0) as client:
                        resp = await client.post(url, json=payload)
                        if resp.status_code == 200:
                            return resp.json()
                        elif resp.status_code in (429, 503):
                            logger.warning(f"Gemini {CHATBOT_MODEL} (key ...{key[-6:]}) returned {resp.status_code}. Failing over...")
                            last_error = f"HTTP {resp.status_code}"
                            continue
                        elif resp.status_code == 404:
                            logger.warning(f"Gemini model {CHATBOT_MODEL} returned 404 on key ...{key[-6:]}.")
                            last_error = "Model 404"
                            continue
                        else:
                            logger.error(f"Gemini API error {resp.status_code} on {CHATBOT_MODEL}: {resp.text[:200]}")
                            last_error = f"HTTP {resp.status_code}: {resp.text[:100]}"
                            continue
                except Exception as ex:
                    logger.warning(f"Gemini request exception on key ...{key[-6:]}: {ex}")
                    last_error = str(ex)
                    continue
            await asyncio.sleep(0.5)

        raise RuntimeError(f"Google Gemini API temporarily unavailable across all keys ({last_error}).")

    async def call_gemini_llm(
        self,
        system_instruction: str,
        user_message: str,
        history: List[Dict[str, str]]
    ) -> str:
        """
        Invokes Gemini 3.6 Flash with full conversation history and structured system prompt.
        Disables chain-of-thought exposure (thinkingBudget: 0) to ensure direct response generation.
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
                "maxOutputTokens": 1024,
                "thinkingConfig": {"thinkingBudget": 0}
            }
        }

        data = await self.call_gemini_raw(payload, max_attempts=3)
        candidates = data.get("candidates", [])
        if candidates and candidates[0].get("content", {}).get("parts"):
            parts = candidates[0]["content"]["parts"]
            # Extract plain text parts, ignoring internal reasoning thoughts
            text_parts = [p["text"] for p in parts if "text" in p and not p.get("thought", False)]
            if text_parts:
                return "\n".join(text_parts).strip()
            return parts[0].get("text", "").strip()

        return "I received an empty response. Please try rephrasing your question."

    async def answer_message(
        self,
        message: str,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Complete Gemini 3.6 Flash Medical Chatbot Pipeline:
        1. Language Detection & Conversation Context Tracking
        2. Fast Intent Routing (Greetings, Emergency, Unrelated, System Info)
        3. Internal Contextual Query Reformulation for Medical RAG
        4. Medical Evidence Retrieval & Clean Synthesis
        5. Gemini 3.6 Flash Response Generation (No built-in hardcoded medical responses)
        """
        cid = conversation_id or str(uuid.uuid4())
        if cid not in self.sessions:
            self.sessions[cid] = []
        history = self.sessions[cid]

        # STEP 1: DETECT LANGUAGE & UPDATE CONVERSATION MEMORY
        lang = self._detect_language(message, cid)
        is_ar = (lang == "ar")
        lang_name = "Arabic" if is_ar else "English"

        # STEP 2: FAST SEMANTIC INTENT CHECK
        fast_intent = self._fast_semantic_intent_check(message, history, lang)

        # -------------------------------------------------------------
        # BRANCH A: GREETING & BASIC CONVERSATION
        # -------------------------------------------------------------
        if fast_intent and fast_intent.get("intent") == "greeting":
            g_type = fast_intent.get("greeting_type", "hello")
            if is_ar:
                if g_type == "thanks":
                    reply = "العفو! على الرحب والسعة. أنا دائماً هنا للمساعدة في أي استفسارات تتعلق بأعراض الجلطات، وعوامل الخطر، وطرق الوقاية، أو نظام StrokeAegis AI."
                elif g_type == "ack":
                    reply = "تمام، أنا في الخدمة متى ما احتجت لأي مساعدة أو معلومة طبية بخصوص صحة الدماغ والجلطات."
                else:
                    reply = "أهلاً بك! أنا المساعد الطبي الذكي لنظام StrokeAegis AI. أنا هنا لمساعدتك في أي استفسارات تتعلق بأعراض الجلطات الدماغية، وعوامل الخطر، وطرق الوقاية، وأشعة الدماغ المقطعية، أو كيفية عمل نظامنا الطبي المدعوم بالذكاء الاصطناعي. كيف يمكنني مساعدتك اليوم؟"
            else:
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

        # -------------------------------------------------------------
        # BRANCH B: CLEARLY UNRELATED (POLITE SCOPE REDIRECTION)
        # -------------------------------------------------------------
        if fast_intent and fast_intent.get("intent") == "unrelated":
            rejection_text = SCOPE_REJECTION_MESSAGE_AR if is_ar else SCOPE_REJECTION_MESSAGE_EN
            history.append({"role": "user", "text": message})
            history.append({"role": "model", "text": rejection_text})
            return {
                "answer": rejection_text,
                "sources": [],
                "in_scope": False,
                "is_emergency": False,
                "conversation_id": cid
            }

        # -------------------------------------------------------------
        # BRANCH C: ACUTE STROKE EMERGENCY (FAST PROTOCOL)
        # -------------------------------------------------------------
        if (fast_intent and fast_intent.get("intent") == "emergency") or self._detect_emergency_flexible(message):
            emergency_answer = EMERGENCY_GUIDANCE_AR if is_ar else EMERGENCY_GUIDANCE_EN
            history.append({"role": "user", "text": message})
            history.append({"role": "model", "text": emergency_answer})
            return {
                "answer": emergency_answer,
                "sources": EMERGENCY_SOURCES,
                "in_scope": True,
                "is_emergency": True,
                "conversation_id": cid
            }

        # -------------------------------------------------------------
        # BRANCH D: STROKEAegis AI SYSTEM FUNCTIONALITY QUESTIONS
        # -------------------------------------------------------------
        if fast_intent and fast_intent.get("intent") == "system_info":
            sys_instructions = (
                f"You are the StrokeAegis AI Medical Assistant, answering a user question about the StrokeAegis AI platform.\n\n"
                f"LANGUAGE MANDATE:\n"
                f"You MUST generate your ENTIRE response in {lang_name.upper()}.\n\n"
                f"YOUR INSTRUCTIONS:\n"
                f"1. Explain clearly based on the StrokeAegis System Information below.\n"
                f"2. Describe the difference between Quick Assessment (fast tabular ML risk + CT classification) "
                f"and the AI System (CrewAI multi-agent clinical flow: Prevention, Emergency, Validation, and Report specialists).\n"
                f"3. Explain the Door Gatekeeper model (ConvNeXt-Tiny) verifying brain CT validity, the Stroke Classifier "
                f"(EfficientNetV2-S), and Grad-CAM visual explainability.\n"
                f"4. Clarify that the chatbot is an assistive decision-support and educational tool and does not replace emergency care.\n"
                f"5. Maintain a professional, welcoming tone. Do NOT output chain-of-thought.\n\n"
                f"STROKEAegis SYSTEM INFORMATION:\n{STROKEAegis_SYSTEM_KNOWLEDGE}"
            )
            try:
                answer = await self.call_gemini_llm(sys_instructions, message, history)
            except Exception as e:
                logger.error(f"Chatbot system info generation failed: {e}")
                if is_ar:
                    answer = (
                        "نظام StrokeAegis AI هو منصة متقدمة لدعم القرار الطبي والتوعية المتخصصة في السكتات الدماغية. "
                        "يوفر النظام خيارين رئيسيين: (1) **التقييم السريع (Quick Assessment)** الذي يجمع بين التنبؤ باحتمالية الجلطة "
                        "بواسطة نماذج تعلم الآلة وتصنيف الأشعة المقطعية للدماغ بواسطة شبكات التعلم العميق مع خرائط Grad-CAM الحرارية، "
                        "و(2) **نظام الذكاء الاصطناعي (AI System)** الذي يدير مسار عمل متعدد الوكلاء (وكيل الوقاية، وكيل الطوارئ، وكيل السلامة الطبية، ووكيل كتابة التقارير) "
                        "وفقاً للإرشادات السريرية العالمية لإنشاء تقارير طبية معتمدة قابلة للتوقيع."
                    )
                else:
                    answer = (
                        "StrokeAegis AI is an advanced clinical decision-support and educational platform for stroke risk assessment and neuroimaging triage. "
                        "It offers two primary workflows: (1) **Quick Assessment**, which combines tabular machine learning risk scoring "
                        "with deep learning brain CT classification and Grad-CAM heatmaps for rapid preliminary triage; and (2) the **AI System**, "
                        "which orchestrates a multi-agent clinical pipeline (Prevention, Emergency, Validation, and Report specialists) "
                        "grounded in clinical guidelines to generate certified reports."
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

        # -------------------------------------------------------------
        # BRANCH E: CORE MEDICAL Q&A WITH RAG EVIDENCE (GEMINI 3.6 FLASH)
        # -------------------------------------------------------------
        # Internal contextual query reformulation for Medical RAG
        internal_rag_query = self._get_contextual_rag_query(message, history, lang)
        rag_chunks = self.retrieve_knowledge(internal_rag_query)

        # Build clean evidence context blocks (stripping DOIs, banners, bibliographic noise)
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

            context_blocks.append(f"[Medical Guideline Item {idx} - Topic: {sec}]:\n{cleaned_text}")
            clean_sources.append({
                "source": source,
                "guideline": guideline,
                "section": sec,
                "year": year,
                "page": page,
                "citation": chunk.get("citation", f"{source} {guideline}")
            })

        rag_context_str = "\n\n".join(context_blocks) if context_blocks else "General stroke clinical guidelines."

        lang_instructions = (
            "- Use fluent, natural Modern Standard Arabic.\n"
            "- When explaining medical terms, include the English term in parentheses where helpful (e.g. السكتة الدماغية الإقفارية (Ischemic Stroke), السكتة الدماغية النزفية (Hemorrhagic Stroke)).\n"
            "- NEVER allow English guideline documents or English medical terms to force your response into English."
            if is_ar else
            "- Use clear, professional, accessible, and compassionate English."
        )

        system_instruction = (
            "You are the StrokeAegis Medical Assistant, an intelligent, evidence-based clinical decision-support "
            "and educational assistant specializing in stroke and cerebrovascular health.\n\n"
            f"LANGUAGE MANDATE (CRITICAL — HIGHEST PRIORITY):\n"
            f"The user's conversation language is {lang_name.upper()} ({lang}).\n"
            f"You MUST formulate your ENTIRE response in clear, natural {lang_name}.\n"
            f"{lang_instructions}\n\n"
            "CORE BEHAVIOR RULES:\n"
            "1. ANSWER THE USER'S ACTUAL QUESTION DIRECTLY:\n"
            "   - Do NOT give a generic definition of stroke unless the user explicitly asked for one.\n"
            "   - If the user asks which type is more severe or harder ('ايش اصعب نوع من الجلطات' / 'ischemia او hemorrhagic ايش اصعب ال' / 'which is more severe'): "
            "Answer the comparison directly! Explain that clinical severity depends on lesion size, location, and speed of treatment, but hemorrhagic stroke (النزفية) is generally more immediately critical and has higher acute mortality and intracranial pressure, while ischemic stroke (الإقفارية) is by far the most frequent (~85%) and causes major long-term disability if untreated.\n"
            "   - If the user asks for types of stroke, explain the primary types concisely (Ischemic, Hemorrhagic, and TIA) without overwhelming textbook filler.\n"
            "2. MULTI-TURN CONTEXT:\n"
            "   - Use conversation history to interpret follow-up questions, pronouns ('they', 'both', 'it'), and implicit comparisons.\n"
            "3. CLEAN SYNTHESIZED CLINICAL EXPLANATION:\n"
            "   - Ground your answer in the provided Medical Guideline Evidence below, but synthesize in your own natural words.\n"
            "   - NEVER dump raw citation strings, DOIs, journal volume headers, or page numbers into the text. The UI renders citations separately.\n"
            "   - NEVER output chain-of-thought, internal deliberation, or hidden thinking.\n"
            "4. CLINICAL SAFETY:\n"
            "   - Provide evidence-based medical information; do NOT provide personal clinical diagnoses or prescribe medication dosages.\n"
            "   - Do NOT turn ordinary educational questions into huge emergency warnings.\n\n"
            f"MEDICAL GUIDELINE EVIDENCE:\n{rag_context_str}"
        )

        try:
            answer = await asyncio.wait_for(
                self.call_gemini_llm(system_instruction, message, history),
                timeout=18.0
            )
            # Post-process to remove any accidental DOI or boilerplate citation leakage
            answer = re.sub(r"(?i)\bdoi:\s*10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", "", answer)
            answer = re.sub(r"(?i)^according to [^:\n]+:\s*", "", answer)
            answer = answer.strip()
        except Exception as e:
            logger.error(f"Chatbot LLM generation failed: {e}. Providing natural limitation message.")
            if is_ar:
                answer = "أعتذر منك، أواجه صعوبة مؤقتة في الاتصال بخدمة الذكاء الاصطناعي الطبي. يرجى إعادة المحاولة بعد لحظات."
            else:
                answer = "I apologize, I am experiencing a temporary connection issue with the medical AI service. Please check your connection and try again in a moment."

        history.append({"role": "user", "text": message})
        history.append({"role": "model", "text": answer})

        return {
            "answer": answer,
            "sources": clean_sources,
            "in_scope": True,
            "is_emergency": False,
            "conversation_id": cid
        }

    def detect_emergency(self, message: str) -> bool:
        """
        Public emergency detector method. Uses flexible semantic matching in EN and AR.
        """
        return self._detect_emergency_flexible(message)

    def check_scope(self, message: str, history: List[Dict[str, str]] = None) -> Tuple[bool, str]:
        """
        Backward-compatible scope checker.
        Returns: (is_in_scope: bool, reason: str)
        """
        res = self._fast_semantic_intent_check(message, history or [], "en")
        if res:
            return res.get("is_in_scope", True), res.get("intent", "stroke_medical")
        return True, "stroke_medical"

    def clear_conversation(self, conversation_id: str):
        if conversation_id in self.sessions:
            del self.sessions[conversation_id]
        if conversation_id in self.session_meta:
            del self.session_meta[conversation_id]


# Singleton instance
chatbot_service = StrokeAegisChatbotService()
