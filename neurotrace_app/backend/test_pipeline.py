
import sys, os, pickle, json, warnings
import numpy as np
from pathlib import Path
from datetime import datetime

warnings.filterwarnings('ignore')
sys.path.insert(0, 'backend')

from services import feature_engineering as fe
from models.student_aim_inference import StudentAIM

# 1. Load data
MODEL_DIR = Path('backend/models')
with open(MODEL_DIR / 'preprocessing.pkl', 'rb') as f:
    PREP = pickle.load(f)
with open(MODEL_DIR / 'student_aim.pkl', 'rb') as f:
    AIM_BUNDLE = pickle.load(f)

AIM_MODEL = StudentAIM(AIM_BUNDLE)

# 2. Mock keystrokes (150)
ks_list = []
for i in range(150):
    ks_list.append({
        'keyId': 'a',
        'hold_time': 100.0,
        'latency': 200.0,
        'type': 'L'
    })

print("Pipeline Start")
# 3. Clinical Feature Extraction
X_raw, n_windows = fe.FeatureExtractor.build_user_feature_vector(ks_list)
print(f"X_raw shape: {X_raw.shape}, n_windows: {n_windows}")

# 4. Speed Normalisation
X_raw = fe.apply_speed_normalisation(X_raw, ks_list, PREP['feat_names_all'])
print("Speed Normalisation OK")

# 5. Preprocessing
X_scaled = fe.preprocess(X_raw, PREP, 125)
print(f"X_scaled shape: {X_scaled.shape}")

# 6. Model Inference
prob_raw = float(AIM_MODEL.predict(X_scaled))
print(f"prob_raw: {prob_raw}")

# 7. Post-hoc
def apply_window_confidence_weight(probability: float, n_windows: int) -> float:
    confidence = min(n_windows / 10.0, 1.0)
    shrinkage  = 1.0 - confidence
    return float(probability * confidence + 0.5 * shrinkage)

weighted_p = apply_window_confidence_weight(prob_raw, n_windows)
print(f"weighted_p: {weighted_p}")

print("Pipeline Finished successfully")
