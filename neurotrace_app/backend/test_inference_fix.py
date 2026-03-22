import sys, os, pickle, warnings
import numpy as np
from pathlib import Path

warnings.filterwarnings('ignore')
# Find ourselves
here = Path(__file__).parent.absolute()
# Setup PYTHONPATH
sys.path.insert(0, str(here)) # backend/
sys.path.insert(0, str(here / 'models')) # backend/models/

from services import feature_engineering as fe
from models.student_aim_inference import StudentAIM

model_path = here / 'models' / 'student_aim.pkl'
prep_path = here / 'models' / 'preprocessing.pkl'

print(f"Loading {prep_path}")
with open(prep_path, 'rb') as f:
    PREP = pickle.load(f)

print(f"Loading {model_path}")
with open(model_path, 'rb') as f:
    AIM_BUNDLE = pickle.load(f)

print("Instantiating Model")
AIM_MODEL = StudentAIM(AIM_BUNDLE)

# Mock data
ks = [{'keyId':'a','hold_time':100.0,'latency':200.0,'type':'L'}] * 150

print("Pipeline Stage 3: Extraction")
X_raw, n_win = fe.FeatureExtractor.build_user_feature_vector(ks)

print("Pipeline Stage 4: Speed Norm")
X_raw = fe.apply_speed_normalisation(X_raw, ks, PREP['feat_names_all'])

print("Pipeline Stage 5: Preprocess")
X_scaled = fe.preprocess(X_raw, PREP)
print(f"X_scaled shape: {X_scaled.shape}")

print("Pipeline Stage 6: Predict")
prob = AIM_MODEL.predict(X_scaled)
print(f"Result: {prob}")
