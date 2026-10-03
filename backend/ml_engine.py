import json
import subprocess
from pathlib import Path

class MLRiskEngine:
    def __init__(self, python_exe=None, worker_path=None):
        self.python_exe = Path(python_exe or r'E:\Unversity\Stroke_Aegis\DONEEEE\ML_modelllll\stroke_v2_env313\Scripts\python.exe')
        current_dir = Path(__file__).resolve().parent
        self.worker_path = Path(worker_path or current_dir / 'ml_worker.py')
        self.threshold = 0.49

    def predict(self, patient_dict: dict):
        p = subprocess.Popen(
            [str(self.python_exe), str(self.worker_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        out, err = p.communicate(input=json.dumps(patient_dict))
        if p.returncode != 0:
            raise RuntimeError(f'ML worker error: {err}')
            
        data = json.loads(out.strip().splitlines()[-1])
        prob = data['stroke_probability']
        prob_pct = round(prob * 100, 2)
        
        if prob < 0.20:
            tier = 'Low'
            tier_color = '#10B981'
            tier_desc = 'Mild / baseline probability. Continue standard routine health maintenance.'
        elif prob < 0.50:
            tier = 'Moderate'
            tier_color = '#F59E0B'
            tier_desc = 'Elevated cardiovascular and metabolic risk markers detected. Lifestyle and clinical intervention advised.'
        else:
            tier = 'High'
            tier_color = '#EF4444'
            tier_desc = 'Significant danger tier for cerebrovascular accident. Immediate clinical assessment and prophylactic treatment recommended.'
            
        factors = []
        age = float(patient_dict.get('age', 0))
        glucose = float(patient_dict.get('avg_glucose_level', 0))
        bmi = float(patient_dict.get('bmi', 0))
        hyp = int(patient_dict.get('hypertension', 0))
        heart = int(patient_dict.get('heart_disease', 0))
        smoke = patient_dict.get('smoking_status', 'never smoked')
        
        if age >= 65:
            factors.append({'factor': 'Advanced Age (>=65)', 'level': 'High', 'impact': f'Patient is {age:.0f} years old; age is the primary demographic stroke risk multiplier.'})
        elif age >= 50:
            factors.append({'factor': 'Mature Age (50-64)', 'level': 'Moderate', 'impact': f'Age {age:.0f} increases vascular stiffness.'})
            
        if hyp == 1:
            factors.append({'factor': 'Chronic Hypertension', 'level': 'High', 'impact': 'Elevated blood pressure compromises cerebral arterial walls.'})
            
        if heart == 1:
            factors.append({'factor': 'Cardiac Disease History', 'level': 'High', 'impact': 'Increases cardioembolic stroke and thrombotic vulnerability.'})
            
        if glucose >= 200:
            factors.append({'factor': 'Severe Hyperglycemia / Diabetes', 'level': 'High', 'impact': f'Avg glucose {glucose:.1f} mg/dL induces microvascular and endothelial damage.'})
        elif glucose >= 140:
            factors.append({'factor': 'Impaired Fasting Glucose', 'level': 'Moderate', 'impact': f'Avg glucose {glucose:.1f} mg/dL indicates prediabetic insulin resistance.'})
            
        if bmi >= 35:
            factors.append({'factor': 'Class II/III Obesity', 'level': 'High', 'impact': f'BMI {bmi:.1f} promotes chronic vascular inflammation and obstructive sleep apnea.'})
        elif bmi >= 30:
            factors.append({'factor': 'Class I Obesity', 'level': 'Moderate', 'impact': f'BMI {bmi:.1f} is an independent vascular risk contributor.'})
            
        if smoke in ('smokes', 'formerly smoked'):
            factors.append({'factor': f'Tobacco Exposure ({smoke})', 'level': 'Moderate' if smoke == 'formerly smoked' else 'High', 'impact': 'Accelerates atherosclerotic plaque formation and vessel constriction.'})
            
        recommendations = [
            'Maintain regular blood pressure monitoring (<130/80 mmHg).',
            'Optimize glycemic control (target HbA1c < 7.0%).',
            'Follow a Mediterranean cardioprotective dietary plan.',
            'Educate family members on the F.A.S.T. stroke warning signs (Face drooping, Arm weakness, Speech difficulty, Time to call 911).'
        ]
        if hyp == 1 or heart == 1:
            recommendations.insert(0, 'Consult a cardiologist/neurologist for antihypertensive and antiplatelet regimen review.')
            
        return {
            'stroke_probability': prob,
            'stroke_probability_pct': prob_pct,
            'threshold': data['threshold'],
            'prediction': data['prediction'],
            'risk_tier': tier,
            'risk_tier_color': tier_color,
            'risk_tier_description': tier_desc,
            'clinical_factors': factors,
            'recommendations': recommendations,
            'patient_summary': patient_dict
        }
