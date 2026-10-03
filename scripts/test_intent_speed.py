import httpx
import time
import os

key = os.environ.get('STROKE_AEGIS_CHATBOT_API_KEY') or os.environ.get('GEMINI_API_KEY', '')
url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={key}'

with httpx.Client(timeout=15.0) as client:
    for q in ['Hello', 'Which one involves bleeding?', 'Who won the soccer match?']:
        t0 = time.time()
        payload = {
            'contents': [{
                'role': 'user',
                'parts': [{
                    'text': f'Classify message: "{q}". Return JSON: {{"intent": "greeting|medical|emergency|system|unrelated", "in_scope": true/false, "emergency": true/false, "query": "expanded query"}}'
                }]
            }],
            'generationConfig': {'temperature': 0.1, 'responseMimeType': 'application/json'}
        }
        r = client.post(url, json=payload)
        t = round(time.time() - t0, 2)
        txt = r.json()['candidates'][0]['content']['parts'][0]['text'].strip().replace('\n', ' ')
        print(f"{q} ({t}s) -> {txt}")
