"""
Standalone script to diagnose the predict pipeline crash.
Run: python debug_predict.py
"""
import sys, traceback, pickle, warnings, random
import numpy as np
from pathlib import Path

warnings.filterwarnings('ignore')
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 60)
print("STEP 1: Load preprocessing bundle")
with open("models/preprocessing.pkl", "rb") as f:
    PREP = pickle.load(f)
print("Keys:", list(PREP.keys()))
print("feat_names_all:", len(PREP.get('feat_names_all', [])))
print("feat_names_sel:", len(PREP.get('feat_names_sel', [])))
print("scaler.center_ shape:", PREP['scaler'].center_.shape)
vt = PREP.get('variance_threshold') or PREP.get('vt')
print("variance_threshold:", vt)
sel_idx = PREP.get('selected_feat_idx') or PREP.get('selected_idx')
print("selected_feat_idx:", type(sel_idx), getattr(sel_idx, 'shape', len(sel_idx) if sel_idx else None))

print()
print("=" * 60)
print("STEP 2: Generate fake keystrokes (300 keystrokes)")
import random, time
rng = random.Random(42)
keystrokes = []
for i in range(300):
    keystrokes.append({
        'keyId': rng.choice('abcdefghijklmnopqrstuvwxyz '),
        'hold_time': rng.uniform(60, 200),
        'flight_time': rng.uniform(10, 80),
        'latency': rng.uniform(100, 400),
        'type': rng.choice(['L', 'R']),
    })

print("Generated:", len(keystrokes), "keystrokes")

print()
print("=" * 60)
print("STEP 3: Feature Extraction (FeatureExtractor.build_user_feature_vector)")
from services import feature_engineering as fe
try:
    X_raw, n_windows = fe.FeatureExtractor.build_user_feature_vector(keystrokes)
    print(f"X_raw shape: {X_raw.shape if X_raw is not None else None}")
    print(f"n_windows: {n_windows}")
    print(f"Any NaN in X_raw: {np.any(np.isnan(X_raw)) if X_raw is not None else 'N/A'}")
    print(f"Any None in X_raw: {any(v is None for v in X_raw.flatten()) if X_raw is not None else 'N/A'}")
except Exception as e:
    print("CRASH in build_user_feature_vector:")
    traceback.print_exc()
    sys.exit(1)

print()
print("=" * 60)
print("STEP 4: Speed Normalisation")
try:
    X_norm = fe.apply_speed_normalisation(X_raw, keystrokes, PREP['feat_names_all'])
    print(f"X_norm shape: {X_norm.shape}")
    print(f"Any NaN: {np.any(np.isnan(X_norm))}")
except Exception as e:
    print("CRASH in apply_speed_normalisation:")
    traceback.print_exc()
    sys.exit(1)

print()
print("=" * 60)
print("STEP 5: Preprocess")
try:
    X_scaled = fe.preprocess(X_norm, PREP)
    print(f"X_scaled shape: {X_scaled.shape}")
    print(f"Any NaN: {np.any(np.isnan(X_scaled))}")
    print(f"Any None: {any(v is None for v in X_scaled.flatten())}")
except Exception as e:
    print("CRASH in preprocess:")
    traceback.print_exc()
    sys.exit(1)

print()
print("=" * 60)
print("STEP 6: Load StudentAIM model and predict")
try:
    AIM_BUNDLE = pickle.load(open("models/student_aim.pkl", "rb"))
    from models.student_aim_inference import StudentAIM
    AIM_MODEL = StudentAIM(AIM_BUNDLE)
    print(f"Model loaded. Input X_scaled shape: {X_scaled.shape}")
    prob = AIM_MODEL.predict(X_scaled)
    print(f"prob_raw: {prob}")
    prob_float = float(prob)
    print(f"float(prob): {prob_float}")
except Exception as e:
    print("CRASH in predict:")
    traceback.print_exc()
    sys.exit(1)

print()
print("=" * 60)
print("STEP 7: Explainability block")
try:
    n_scaled_cols = X_scaled.shape[1]
    feat_names_for_display = (
        PREP.get('feat_names_sel') or
        PREP.get('feat_names_all', [])[:n_scaled_cols]
    )
    scaler_center = PREP['scaler'].center_
    print(f"n_scaled_cols: {n_scaled_cols}")
    print(f"feat_names_for_display count: {len(feat_names_for_display)}")
    print(f"scaler_center shape: {scaler_center.shape}")
    # Only iterate up to min of all three
    n_iter = min(n_scaled_cols, len(feat_names_for_display), len(scaler_center))
    print(f"n_iter: {n_iter}")
    for i in range(n_iter):
        val = float(X_scaled[0, i])
        cval = float(scaler_center[i])
    print("Explainability loop: OK")
except Exception as e:
    print("CRASH in explainability:")
    traceback.print_exc()
    sys.exit(1)

print()
print("=" * 60)
print("ALL STEPS PASSED - pipeline diagnosis complete")
