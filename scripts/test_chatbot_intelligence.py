"""
StrokeAegis AI — Comprehensive Chatbot Intelligence & Scope Verification Suite
Verifies all 9 categories and natural language variations from user requirements:
  1. Stroke Symptoms without keyword 'stroke'
  2. Potential Emergency Situations & Acute Guidance
  3. Stroke Risk Factors & Lifestyle Prevention
  4. Ischemic vs Hemorrhagic Stroke (Clots vs Bleeding)
  5. CT & Neuroimaging Concepts
  6. StrokeAegis AI System Functionality & Workflows
  7. Conversational Context & Multi-turn Follow-ups
  8. Natural Greetings & Courtesies
  9. Unrelated Questions (Polite Redirection)
"""

import sys
import os
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'backend'))

from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

def run_tests():
    print("=" * 80)
    print("     STROKEAegis AI — CHATBOT INTELLIGENCE & INTENT TEST SUITE")
    print("=" * 80)
    passed = 0
    total = 0

    def check(title, cond, detail=""):
        nonlocal passed, total
        total += 1
        if cond:
            passed += 1
            print(f"  [PASS] {title}")
        else:
            print(f"  [FAIL] {title} -> {detail}")
            assert False, f"Test failed: {title} ({detail})"

    # -------------------------------------------------------------
    # 1. GREETINGS & BASIC CONVERSATION
    # -------------------------------------------------------------
    print("\n--- [CATEGORY 1] Greetings & Basic Conversation ---")
    greetings = ["Hello", "Good morning", "Thanks", "Thank you so much", "Okay"]
    for g in greetings:
        res = client.post("/api/chatbot", json={"message": g})
        check(f"Greeting '{g}' returns 200", res.status_code == 200)
        d = res.json()
        check(f"Greeting '{g}' in_scope is True", d["in_scope"] is True)
        check(f"Greeting '{g}' not rejected as out of scope", "only help with questions related to stroke" not in d["answer"])
        check(f"Greeting '{g}' answer length > 10", len(d["answer"]) > 10)

    # -------------------------------------------------------------
    # 2. CLEARLY UNRELATED (POLITE REDIRECTION)
    # -------------------------------------------------------------
    print("\n--- [CATEGORY 2] Clearly Unrelated Questions ---")
    unrelated = [
        "What's the weather today?",
        "Who won the football match?",
        "Write me Python code for a game.",
        "Tell me a joke about cats.",
        "What's the capital of France?"
    ]
    for u in unrelated:
        res = client.post("/api/chatbot", json={"message": u})
        check(f"Unrelated '{u}' returns 200", res.status_code == 200)
        d = res.json()
        check(f"Unrelated '{u}' in_scope is False", d["in_scope"] is False)
        check(f"Unrelated '{u}' polite redirection mentions StrokeAegis medical assistant", "StrokeAegis AI's medical assistant" in d["answer"])
        check(f"Unrelated '{u}' mentions stroke scope", "only help with questions related to stroke" in d["answer"])

    # -------------------------------------------------------------
    # 3. STROKE SYMPTOMS (WITHOUT EXPLICIT KEYWORD 'STROKE')
    # -------------------------------------------------------------
    print("\n--- [CATEGORY 3] Stroke Symptoms Without Keyword 'stroke' ---")
    symptom_queries = [
        ("What happens if someone suddenly cannot move one side of their body?", True),
        ("Why can't I move my right arm?", True),
        ("Their mouth looks like it's dropping on one side.", True),
        ("Their speech suddenly became unclear. What could that mean?", True),
        ("One side of my face suddenly feels weak.", True)
    ]
    for sq, is_emerg in symptom_queries:
        res = client.post("/api/chatbot", json={"message": sq})
        check(f"Symptom '{sq[:40]}...' returns 200", res.status_code == 200)
        d = res.json()
        check(f"Symptom in_scope is True", d["in_scope"] is True)
        check(f"Symptom not falsely rejected as out-of-scope", d["in_scope"] is True and "only help with questions related to stroke" not in d["answer"])
        if is_emerg:
            check(f"Emergency symptoms recognized", d["is_emergency"] is True)
            check(f"Emergency guidance provided", "911" in d["answer"] or "F.A.S.T." in d["answer"] or "FAST" in d["answer"] or "EMERGENCY" in d["answer"])
        else:
            check(f"Substantive answer provided", len(d["answer"]) > 50)

    # -------------------------------------------------------------
    # 4. POTENTIAL EMERGENCY SITUATIONS
    # -------------------------------------------------------------
    print("\n--- [CATEGORY 4] Potential Acute Emergency Situations ---")
    emergencies = [
        "My father suddenly can't move his left arm and his speech is slurred.",
        "Someone just started speaking strangely and their face looks uneven.",
        "My father suddenly became confused and weak.",
        "His arm suddenly went numb."
    ]
    for em in emergencies:
        res = client.post("/api/chatbot", json={"message": em})
        check(f"Emergency '{em[:35]}...' returns 200", res.status_code == 200)
        d = res.json()
        check(f"Emergency in_scope is True", d["in_scope"] is True)
        check(f"Emergency is_emergency is True", d["is_emergency"] is True)
        check(f"Emergency response mentions 911 / EMS", "911" in d["answer"] or "EMERGENCY" in d["answer"])
        check(f"Emergency response provides FAST instructions", "F.A.S.T." in d["answer"] or "FAST" in d["answer"])
        check(f"Emergency sources retrieved", len(d["sources"]) > 0)

    # -------------------------------------------------------------
    # 5. STROKE RISK & LIFESTYLE PREVENTION
    # -------------------------------------------------------------
    print("\n--- [CATEGORY 5] Stroke Risk & Prevention ---")
    risk_queries = [
        "What makes someone more likely to have a stroke?",
        "Can high blood pressure cause this?",
        "Does smoking increase the risk?",
        "How can I prevent it?",
        "What habits should I change?",
        "Is diabetes related to stroke?"
    ]
    for rq in risk_queries:
        time.sleep(1.0)
        res = client.post("/api/chatbot", json={"message": rq})
        check(f"Risk '{rq[:35]}...' returns 200", res.status_code == 200)
        d = res.json()
        check(f"Risk query in_scope is True", d["in_scope"] is True)
        check(f"Risk query has substantive answer", len(d["answer"]) > 50, detail=repr(d["answer"]))
        check(f"Risk query not rejected", "only help with questions related to stroke" not in d["answer"])

    # -------------------------------------------------------------
    # 6. ISCHEMIC VS HEMORRHAGIC STROKE (CLOTS VS BLEEDING)
    # -------------------------------------------------------------
    print("\n--- [CATEGORY 6] Ischemic vs Hemorrhagic Stroke ---")
    type_queries = [
        "What's the difference between the two types?",
        "What happens when a blood vessel gets blocked?",
        "What happens when a blood vessel bursts?",
        "Which type is caused by bleeding?",
        "Which one happens because of a clot?"
    ]
    for tq in type_queries:
        time.sleep(1.0)
        res = client.post("/api/chatbot", json={"message": tq})
        check(f"Type query '{tq[:35]}...' returns 200", res.status_code == 200)
        d = res.json()
        check(f"Type query in_scope is True", d["in_scope"] is True)
        check(f"Type query substantive answer", len(d["answer"]) > 50, detail=repr(d["answer"]))

    # -------------------------------------------------------------
    # 7. CT & NEUROIMAGING CONCEPTS
    # -------------------------------------------------------------
    print("\n--- [CATEGORY 7] CT & Neuroimaging Concepts ---")
    ct_queries = [
        "What does the scan show?",
        "Can the system detect bleeding?",
        "Can it tell if there's a clot?",
        "What happens after I upload the scan?",
        "Can the system tell normal from abnormal images?"
    ]
    for cq in ct_queries:
        time.sleep(1.0)
        res = client.post("/api/chatbot", json={"message": cq})
        check(f"CT query '{cq[:35]}...' returns 200", res.status_code == 200)
        d = res.json()
        check(f"CT query in_scope is True", d["in_scope"] is True)
        check(f"CT query substantive answer", len(d["answer"]) > 40, detail=repr(d["answer"]))

    # -------------------------------------------------------------
    # 8. STROKEAegis AI SYSTEM FUNCTIONALITY
    # -------------------------------------------------------------
    print("\n--- [CATEGORY 8] StrokeAegis AI System Functionality ---")
    sys_queries = [
        "How does this system work?",
        "What's the difference between the two assessment options?",
        "Can I get a report?",
        "What does Quick Assessment mean?",
        "What is the AI System option?"
    ]
    for sq in sys_queries:
        time.sleep(1.0)
        res = client.post("/api/chatbot", json={"message": sq})
        check(f"System query '{sq[:35]}...' returns 200", res.status_code == 200)
        d = res.json()
        check(f"System query in_scope is True", d["in_scope"] is True)
        check(f"System query substantive answer", len(d["answer"]) > 50, detail=f"len={len(d['answer'])}, answer={repr(d['answer'])}")
        check(f"System query explains platform components", any(k in d["answer"].lower() for k in ["quick assessment", "ai system", "agent", "risk", "ct", "report"]), detail=repr(d["answer"]))

    # -------------------------------------------------------------
    # 9. CONVERSATIONAL CONTEXT & MULTI-TURN FOLLOW-UPS
    # -------------------------------------------------------------
    print("\n--- [CATEGORY 9] Conversational Context & Follow-ups ---")

    # Flow A: Warning signs -> Duration follow-up
    cid_a = "test-flow-a-" + str(int(time.time()))
    r_a1 = client.post("/api/chatbot", json={"message": "What are the common signs of stroke?", "conversation_id": cid_a})
    check("Flow A Turn 1: Warning signs returns 200", r_a1.status_code == 200)
    r_a2 = client.post("/api/chatbot", json={"message": "How long do they usually last?", "conversation_id": cid_a})
    d_a2 = r_a2.json()
    check("Flow A Turn 2: 'they' follow-up in_scope is True", d_a2["in_scope"] is True)
    check("Flow A Turn 2 has substantive response", len(d_a2["answer"]) > 40)

    # Flow B: Acute weakness description -> Urgent follow-up
    cid_b = "test-flow-b-" + str(int(time.time()))
    r_b1 = client.post("/api/chatbot", json={"message": "My father suddenly has weakness on one side.", "conversation_id": cid_b})
    check("Flow B Turn 1: Weakness described returns 200", r_b1.status_code == 200)
    r_b2 = client.post("/api/chatbot", json={"message": "What should I do now?", "conversation_id": cid_b})
    d_b2 = r_b2.json()
    check("Flow B Turn 2: 'What should I do now?' in_scope is True", d_b2["in_scope"] is True)
    check("Flow B Turn 2 recognizes emergency context", d_b2["is_emergency"] is True)
    check("Flow B Turn 2 provides immediate emergency action", "911" in d_b2["answer"] or "EMERGENCY" in d_b2["answer"])

    # Flow C: Two types comparison -> Bleeding follow-up
    cid_c = "test-flow-c-" + str(int(time.time()))
    r_c1 = client.post("/api/chatbot", json={"message": "What's the difference between ischemic and hemorrhagic stroke?", "conversation_id": cid_c})
    check("Flow C Turn 1: Difference inquiry returns 200", r_c1.status_code == 200)
    r_c2 = client.post("/api/chatbot", json={"message": "Which one involves bleeding?", "conversation_id": cid_c})
    d_c2 = r_c2.json()
    check("Flow C Turn 2: 'Which one involves bleeding?' in_scope is True", d_c2["in_scope"] is True)
    check("Flow C Turn 2 provides substantive answer", len(d_c2["answer"]) > 40)

    # Flow D: CT analysis -> Dual detection follow-up
    cid_d = "test-flow-d-" + str(int(time.time()))
    r_d1 = client.post("/api/chatbot", json={"message": "How does the AI analyze the CT?", "conversation_id": cid_d})
    check("Flow D Turn 1: CT analysis returns 200", r_d1.status_code == 200)
    r_d2 = client.post("/api/chatbot", json={"message": "Does it detect both?", "conversation_id": cid_d})
    d_d2 = r_d2.json()
    check("Flow D Turn 2: 'Does it detect both?' in_scope is True", d_d2["in_scope"] is True)
    check("Flow D Turn 2 provides substantive answer", len(d_d2["answer"]) > 40)

    print("\n" + "=" * 80)
    print(f"      TEST RESULTS: {passed} / {total} CHECKS PASSED (100% SUCCESS)")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
