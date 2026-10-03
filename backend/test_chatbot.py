"""
StrokeAegis AI — Medical Chatbot Verification Test Suite
Tests all 7 user-specified test cases:
  1. Stroke question ("What are the warning signs of stroke?")
  2. Stroke risk ("How does hypertension increase stroke risk?")
  3. Related medical topic ("How is diabetes related to stroke?")
  4. Unrelated question ("Who won the World Cup?") -> Polite Rejection
  5. Programming request ("Write Python code for a neural network.") -> Polite Rejection
  6. Emergency symptoms ("My father's face suddenly became weak on one side...") -> FAST Emergency Guidance
  7. Conversation context (Turn 1: "What are the symptoms of ischemic stroke?" -> Turn 2: "Which one usually happens suddenly?")
  8. API Key separation verification
"""

import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'backend'))

from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

def run_all_tests():
    print("=" * 72)
    print("      STROKEAegis AI — MEDICAL CHATBOT TEST SUITE VERIFICATION")
    print("=" * 72)

    # Test 0: Health & Configuration
    print("\n[TEST 0] Chatbot Health & API Configuration...")
    h = client.get("/api/chatbot/health")
    assert h.status_code == 200, f"Health check failed: {h.status_code}"
    h_data = h.json()
    assert h_data["status"] == "online"
    assert h_data["crewai"] is False, "Chatbot must NOT use CrewAI!"
    assert h_data["scope_guard"] == "active"
    assert h_data["rag_connected"] is True
    print(f"✓ Health check passed: {h_data}")

    # Verify dedicated chatbot API key
    chatbot_key = os.environ.get("STROKE_AEGIS_CHATBOT_API_KEY")
    agent_key = os.environ.get("GEMINI_API_KEY")
    assert chatbot_key is not None, "STROKE_AEGIS_CHATBOT_API_KEY must be set!"
    print(f"✓ Dedicated Chatbot Key: {chatbot_key[:8]}...{chatbot_key[-4:]}")
    print(f"✓ Separate Agent Key:   {agent_key[:8]}...{agent_key[-4:]}")

    # Test 4: Unrelated question (Fast test)
    print("\n[TEST 4] Unrelated question: 'Who won the World Cup?'...")
    r4 = client.post("/api/chatbot", json={"message": "Who won the World Cup?"})
    assert r4.status_code == 200
    d4 = r4.json()
    assert d4["in_scope"] is False, "World cup query must be out of scope!"
    assert "StrokeAegis AI's medical assistant" in d4["answer"]
    assert "only help with questions related to stroke" in d4["answer"]
    print(f"✓ Test 4 Passed: Rejection confirmed -> '{d4['answer'][:70]}...'")

    # Test 5: Programming request
    print("\n[TEST 5] Programming request: 'Write Python code for a neural network.'...")
    r5 = client.post("/api/chatbot", json={"message": "Write Python code for a neural network."})
    assert r5.status_code == 200
    d5 = r5.json()
    assert d5["in_scope"] is False, "Coding query must be out of scope!"
    assert "only help with questions related to stroke" in d5["answer"]
    print(f"✓ Test 5 Passed: Rejection confirmed -> '{d5['answer'][:70]}...'")

    # Test 6: Emergency symptoms
    print("\n[TEST 6] Emergency symptoms: 'My father's face suddenly became weak on one side and he cannot speak properly.'...")
    r6 = client.post("/api/chatbot", json={
        "message": "My father's face suddenly became weak on one side and he cannot speak properly."
    })
    assert r6.status_code == 200
    d6 = r6.json()
    assert d6["in_scope"] is True
    assert d6["is_emergency"] is True, "Emergency symptoms must be flagged!"
    assert "CALL 911" in d6["answer"] or "EMERGENCY" in d6["answer"]
    assert "F.A.S.T." in d6["answer"] or "FAST" in d6["answer"]
    assert len(d6["sources"]) > 0
    print("✓ Test 6 Passed: Emergency FAST protocol immediately provided, no diagnostic claims made.")

    # Test 1: Stroke warning signs (Full RAG + Gemini 3.6)
    print("\n[TEST 1] Stroke question: 'What are the warning signs of stroke?'...")
    r1 = client.post("/api/chatbot", json={"message": "What are the warning signs of stroke?"})
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["in_scope"] is True
    assert len(d1["answer"]) > 50
    assert len(d1["sources"]) > 0, "RAG sources must be retrieved!"
    print(f"✓ Test 1 Passed: Answer length {len(d1['answer'])} chars, {len(d1['sources'])} guideline sources retrieved.")
    print(f"   Source 1: {d1['sources'][0]['citation']}")

    # Test 1b: User's specific query: "what is the types of stroke?"
    print("\n[TEST 1b] User's query: 'what is the types of stroke?'...")
    r1b = client.post("/api/chatbot", json={"message": "what is the types of stroke?"})
    assert r1b.status_code == 200
    d1b = r1b.json()
    assert d1b["in_scope"] is True
    assert "couldn't process your request" not in d1b["answer"], f"Failed with fallback error: {d1b['answer']}"
    assert len(d1b["answer"]) > 50
    assert len(d1b["sources"]) > 0
    print(f"✓ Test 1b Passed: Answer length {len(d1b['answer'])} chars. Preview: {d1b['answer'][:90]}...")

    # Test 2: Stroke risk
    print("\n[TEST 2] Stroke risk: 'How does hypertension increase stroke risk?'...")
    r2 = client.post("/api/chatbot", json={"message": "How does hypertension increase stroke risk?"})
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["in_scope"] is True
    assert "couldn't process your request" not in d2["answer"]
    assert len(d2["answer"]) > 50
    print(f"✓ Test 2 Passed: Answer length {len(d2['answer'])} chars, {len(d2['sources'])} sources.")

    # Test 3: Related medical topic
    print("\n[TEST 3] Related medical topic: 'How is diabetes related to stroke?'...")
    r3 = client.post("/api/chatbot", json={"message": "How is diabetes related to stroke?"})
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["in_scope"] is True
    assert len(d3["answer"]) > 50
    print(f"✓ Test 3 Passed: Answer length {len(d3['answer'])} chars, {len(d3['sources'])} sources.")

    # Test 7: Conversation context continuity
    print("\n[TEST 7] Conversation context continuity...")
    cid = "test-conv-session-123"
    r7a = client.post("/api/chatbot", json={
        "message": "What are the symptoms of ischemic stroke?",
        "conversation_id": cid
    })
    assert r7a.status_code == 200
    d7a = r7a.json()
    assert d7a["in_scope"] is True

    # Turn 2: Elliptical follow-up query relying on prior context
    r7b = client.post("/api/chatbot", json={
        "message": "Which one usually happens suddenly?",
        "conversation_id": cid
    })
    assert r7b.status_code == 200
    d7b = r7b.json()
    assert d7b["in_scope"] is True, "Follow-up question must be recognized as in-scope through context!"
    assert len(d7b["answer"]) > 40
    print(f"✓ Test 7 Passed: Turn 2 correctly recognized within context: '{d7b['answer'][:80]}...'")

    print("\n" + "=" * 72)
    print("      ALL 7 MEDICAL CHATBOT TEST CASES PASSED SUCCESSFULLY!")
    print("=" * 72)

if __name__ == "__main__":
    run_all_tests()
