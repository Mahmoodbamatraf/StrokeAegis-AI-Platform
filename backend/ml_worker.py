import sys
import json
import numpy as np
import pandas as pd
from pathlib import Path

MODEL_DIR = Path(r'E:\Unversity\Stroke_Aegis\DONEEEE\ML_modelllll')
sys.path.insert(0, str(MODEL_DIR))

import stroke_v2_components
import joblib

SCHEMA_PATH = MODEL_DIR / 'stroke_prediction_feature_schema.json'
with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
    schema = json.load(f)

MODEL_PATH = MODEL_DIR / 'stroke_prediction_model_v2_windows.joblib'
model = joblib.load(MODEL_PATH)

def run():
    raw_input = sys.stdin.read()
    if not raw_input.strip():
        return
    patient = json.loads(raw_input)
    df = pd.DataFrame([patient])
    if 'id' in schema and 'id' not in df.columns:
        df['id'] = np.nan
    df = df[list(schema.keys())]
    probs = float(model.predict_proba(df)[:, 1][0])
    threshold = float(model.threshold)
    res = {
        'stroke_probability': probs,
        'threshold': threshold,
        'prediction': int(probs >= threshold)
    }
    print(json.dumps(res))

if __name__ == '__main__':
    run()
