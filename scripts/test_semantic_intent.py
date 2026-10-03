import httpx
import json
import os

key = os.environ.get('STROKE_AEGIS_CHATBOT_API_KEY') or os.environ.get('GEMINI_API_KEY', '')
url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={key}'

SYSTEM_INTENT_PROMPT = """You are the Semantic Intent & Scope Understanding Engine for StrokeAegis AI, an advanced medical decision-support and educational platform specializing in stroke.

YOUR TASK:
Analyze the user's message in the context of the recent conversation history to determine their underlying meaning, intent, scope, and whether an acute emergency is described.

CONVERSATION HISTORY:
{history_str}

CURRENT USER MESSAGE:
"{message}"

SUPPORTED SCOPE:
1. Stroke symptoms and warning signs (e.g. facial droop, arm weakness, speech difficulty, sudden numbness, loss of balance, vision changes, confusion, non-medical descriptions of symptoms, even without the word "stroke").
2. Stroke types & mechanisms (ischemic, hemorrhagic, TIA, clot, blockage, burst vessel, aneurysm, bleeding in the brain).
3. Risk factors & prevention (hypertension, blood pressure, smoking, diabetes, AFib, cholesterol, obesity, lifestyle).
4. Acute emergency situations & FAST protocol (descriptions of sudden acute symptoms happening right now, asking what to do immediately for sudden symptoms).
5. Imaging & diagnostics (CT scans, MRI, Door Gatekeeper model, brain scans, clot/hemorrhage detection, Grad-CAM).
6. StrokeAegis AI System functionality (Quick Assessment vs AI System, CrewAI multi-agent workflow, report generation, physician sign-off, patient/doctor portal).
7. General conversational greetings, politeness, and acknowledgments ("hello", "thanks", "okay").

OUT OF SCOPE:
Completely unrelated topics such as writing code/programming, sports scores, cooking recipes, weather, general trivia, jokes, history, non-stroke general tasks.

INTENT CATEGORIES:
- "greeting": User is greeting, thanking, or saying goodbye.
- "emergency": User describes sudden, acute, or immediate neurological symptoms (e.g. face drooping, sudden arm/leg weakness, slurred speech, sudden numbness, confusion, or asking what to do right now for sudden symptoms).
- "stroke_medical": Informational, educational, or guideline-related question about stroke, symptoms, risk, prevention, types, or neuroimaging.
- "system_info": Question about how StrokeAegis AI works, its assessment options, features, reports, or workflow.
- "clarification_needed": The query is too vague to answer safely without asking a brief clarification.
- "unrelated": Completely outside StrokeAegis AI's scope (sports, coding, weather, trivia, etc.).

OUTPUT FORMAT:
Respond with ONLY a valid JSON object:
{
  "intent": "greeting" | "emergency" | "stroke_medical" | "system_info" | "clarification_needed" | "unrelated",
  "is_in_scope": true | false,
  "is_emergency": true | false,
  "contextual_query": "search query optimized for vector RAG retrieval, expanding pronouns (it, they, both) and adding medical terms based on conversation context",
  "clarification_question": "Brief question if clarification_needed, otherwise empty string",
  "reasoning": "Brief explanation"
}"""

test_cases = [
    # 1. No keyword "stroke"
    {"history": [], "msg": "What happens if someone suddenly cannot move one side of their body?"},
    {"history": [], "msg": "Why can not I move my right arm?"},
    {"history": [], "msg": "Their mouth looks like it is dropping on one side."},
    # 2. Acute emergency
    {"history": [], "msg": "My father suddenly can not move his left arm and his speech is slurred."},
    {"history": [{"role": "user", "text": "My father suddenly has weakness on one side."}, {"role": "model", "text": "Sudden weakness on one side is a medical emergency."}], "msg": "What should I do now?"},
    # 3. System info
    {"history": [], "msg": "How does this system work?"},
    {"history": [], "msg": "What is the difference between the two assessment options?"},
    # 4. Contextual follow-up
    {"history": [{"role": "user", "text": "What is the difference between ischemic and hemorrhagic stroke?"}, {"role": "model", "text": "Ischemic is caused by clots, hemorrhagic by bleeding."}], "msg": "Which one involves bleeding?"},
    # 5. Greetings
    {"history": [], "msg": "Hello"},
    {"history": [], "msg": "Thank you so much"},
    # 6. Unrelated
    {"history": [], "msg": "Who won the World Cup?"},
    {"history": [], "msg": "Write me Python code for a game."}
]

with httpx.Client(timeout=25.0) as client:
    for idx, tc in enumerate(test_cases, 1):
        hist_str = "\n".join([f"{h['role']}: {h['text']}" for h in tc["history"]]) if tc["history"] else "None"
        prompt = SYSTEM_INTENT_PROMPT.replace("{history_str}", hist_str).replace("{message}", tc["msg"])
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
        }
        res = client.post(url, json=payload)
        parsed = json.loads(res.json()['candidates'][0]['content']['parts'][0]['text'])
        print(f"[{idx}] '{tc['msg']}'")
        print(f"    intent={parsed['intent']} | in_scope={parsed['is_in_scope']} | emerg={parsed['is_emergency']} | query='{parsed.get('contextual_query', '')}'")
