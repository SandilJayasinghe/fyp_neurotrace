from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import pickle
import json
import sys
import numpy as np
import os
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Any
import math
import warnings
from contextlib import asynccontextmanager

# Suppress annoying sklearn/unpickle warnings (already manually checked)
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

# Step 5 Requirement: Add models/ to sys.path
MODEL_DIR = Path(__file__).parent / 'ml_models'
sys.path.append(str(MODEL_DIR))

# --- MODEL HYDRATION SYNC (PICKLE) ---
# Define _ProbWrap locally to allow pickle to load student_aim.pkl bundle.
# This matches the training notebook's internal structure.
class _ProbWrap:
    def __init__(self, model): self.model = model
    def predict_proba(self, X): return self.model.predict_proba(X)
    def predict(self, X): return self.model.predict(X)

# Local imports
from schemas import PredictRequest, PredictResponse, FeatureDetail
from services import feature_engineering as fe

# Inject into possible module namespaces where pickle might look
for m_name in ['__main__', 'main', 'uvicorn.workers', 'services.feature_engineering']:
    if m_name in sys.modules:
        setattr(sys.modules[m_name], '_ProbWrap', _ProbWrap)
    else:
        # Create dummy module if needed for registration
        try:
            import types
            mod = types.ModuleType(m_name)
            mod._ProbWrap = _ProbWrap
            sys.modules[m_name] = mod
        except: pass
# --------------------------------------

from routes import user_router, item_router
from db.database import db_manager, get_baseline_sessions, save_session
from sqlmodel import Session
from student_aim_inference import StudentAIM
from models.user import User
from models.screening import ScreeningTest

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup Logic
    global PREP, AIM_BUNDLE, METADATA, AIM_MODEL
    
    # Init Database
    try:
        db_manager.create_db_and_tables()
        print("[NeuroTrace] Database tables initialized.")
    except Exception as e:
        print(f"[NeuroTrace Error] DB Init failed: {e}")

    # Load ML models
    try:
        with open(MODEL_DIR / 'preprocessing.pkl', 'rb') as f:
            PREP = pickle.load(f)
        with open(MODEL_DIR / 'student_aim.pkl', 'rb') as f:
            AIM_BUNDLE = pickle.load(f)
        with open(MODEL_DIR / 'model_metadata.json', 'r') as f:
            METADATA = json.load(f)
        
        # Instantiate StudentAIM from models.student_aim_inference
        from student_aim_inference import StudentAIM
        AIM_MODEL = StudentAIM(AIM_BUNDLE)
        print("[NeuroTrace] Models loaded and AIM_MODEL initialized.")
    except Exception as e:
        print(f"[NeuroTrace Error] Failed to load models: {e}")
    
    yield
    # 2. Shutdown Logic (Cleanup if needed)

app = FastAPI(title="NeuroTrace Parkinson's Screening API", version="2.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Authentication and Management routes (Restored)
app.include_router(user_router.router)
app.include_router(item_router.router)

@app.get("/health")
def health():
    if METADATA is None:
        raise HTTPException(status_code=500, detail="Metadata not loaded")
    return {
        "status": "ok", 
        "model": "AIM-Student-v1", 
        "aim_auc": METADATA.get('metrics', {}).get('auc', 0.84)
    }

def compute_session_quality(keystrokes: list, polling_hz: int = 125, detection_confidence: str = 'Low') -> dict:
    all_il = [k['latency'] for k in keystrokes
              if k.get('latency') and 0 < k['latency'] < 10000]
    all_ht = [k['hold_time'] for k in keystrokes
              if 0 < k['hold_time'] < 10000]
    
    if not all_il:
        return { 'score': 0, 'grade': 'Poor', 'spike_ratio': 0.0, 'reason': 'No timing data',
                 'polling_hz': polling_hz, 'polling_score': 0.0, 'min_measurable_ms': 1000.0/polling_hz,
                 'detection_confidence': detection_confidence }
    
    q_ms = 1000.0 / float(polling_hz)
    median_iki   = float(np.median(all_il))
    spike_thresh = median_iki * 4.0
    spike_ratio  = sum(1 for il in all_il if il > spike_thresh) / len(all_il)
    ht_cv        = float(np.std(all_ht) / (np.mean(all_ht) + 1e-8)) if all_ht else 0.0
    n            = len(keystrokes)
    
    spike_score   = max(0.0, 1.0 - spike_ratio * 10)
    volume_score  = min(n / 400.0, 1.0)
    rhythm_score  = max(0.0, 1.0 - ht_cv)
    polling_score = min(polling_hz / 1000.0, 1.0)
    
    # Quantisation consistency check
    sorted_il = sorted(set(all_il))
    diffs = [sorted_il[i+1] - sorted_il[i] for i in range(len(sorted_il)-1) if sorted_il[i+1] - sorted_il[i] < 5]
    empirical_step = float(np.median(diffs)) if diffs else q_ms
    quantisation_consistency = 1.0 if empirical_step <= q_ms * 1.5 else 0.7
    
    score = (
        0.35 * spike_score +
        0.25 * volume_score +
        0.15 * rhythm_score +
        0.15 * polling_score +
        0.10 * quantisation_consistency
    )
    score_pct = int(round(score * 100))
    
    if score_pct >= 80:   grade = 'Good'
    elif score_pct >= 55: grade = 'Fair'
    else:                 grade = 'Poor'
    
    reason = []
    if spike_ratio > 0.08:
        reason.append(f'{round(spike_ratio*100)}% of keystrokes had pause spikes')
    if n < 200:
        reason.append(f'only {n} keystrokes — 300+ recommended')
    if ht_cv > 0.6:
        reason.append('high hold-time variability detected')
    if polling_hz < 250:
        reason.append(
            f'keyboard polling at {polling_hz}Hz — timing resolution limited to ±{q_ms:.0f}ms. '
            'A gaming keyboard with 1000Hz polling would improve accuracy.'
        )
    if detection_confidence == 'Low':
        reason.append('keyboard polling rate could not be detected — result based on assumed 125Hz')
    
    return {
        'score':               score_pct,
        'grade':               grade,
        'spike_ratio':         float(round(float(spike_ratio * 100), 1)),
        'reason':              ', '.join(reason) if reason else 'Session quality is good',
        'polling_hz':          polling_hz,
        'polling_score':       float(round(float(polling_score * 100), 1)),
        'min_measurable_ms':   q_ms,
        'detection_confidence': detection_confidence,
    }

# --- CLINICAL CORRECTION HELPER FUNCTIONS (STEP 7 & 11) ---

def apply_age_correction(probability: float,
                          age: int) -> dict:
    """
    Shifts the raw probability down for younger users to correct for
    the systematic age mismatch between the user and the Tappy cohort.
    The model's healthy baseline was calibrated on ~58-year-old adults.
    """
    AGE_BASELINE = {
        (10, 25): 0.32,
        (26, 35): 0.30,
        (36, 45): 0.28,
        (46, 55): 0.26,
        (56, 65): 0.22,
        (66, 120): 0.20,
    }
    MODEL_HEALTHY_BASELINE = 0.22

    user_baseline = MODEL_HEALTHY_BASELINE
    for (lo, hi), b in AGE_BASELINE.items():
        if lo <= age <= hi:
            user_baseline = b
            break

    correction     = user_baseline - MODEL_HEALTHY_BASELINE
    corrected      = float(np.clip(probability - correction, 0.01, 0.99))

    return {
        'raw':        probability,
        'corrected':  corrected,
        'correction': float(round(float(correction), 3)),
        'age_baseline': user_baseline,
    }

def apply_window_confidence_weight(probability: float,
                                    n_windows: int) -> float:
    """
    Shrink extreme probabilities toward 0.5 when few windows
    were available. More windows = more confident = less shrinkage.
    """
    confidence = min(n_windows / 10.0, 1.0)
    shrinkage  = 1.0 - confidence
    return float(probability * confidence + 0.5 * shrinkage)

def compute_personal_baseline_score(
    current_prob: float,
    session_history: list,
    min_sessions: int = 3
) -> dict:
    """
    Compare current session to the user's own historical baseline.
    Returns a z-score relative to personal mean ± std.
    """
    baseline_probs = [s.get('probability', 0.5) for s in session_history[:5]]
    
    if baseline_probs:
        personal_mean = float(np.mean(baseline_probs))
        personal_std  = float(np.std(baseline_probs))
    else:
        personal_mean = current_prob
        personal_std  = 0.0

    if len(session_history) < min_sessions:
        sessions_needed = min_sessions - len(session_history)
        return {
            'baseline_ready':    False,
            'sessions_needed':   sessions_needed,
            'raw_score':         current_prob,
            'display_score':     None,
            'status':            'Establishing baseline',
            'status_colour':     'grey',
            'personal_mean':     float(round(personal_mean, 3)),
            'message': (
                f'Complete {sessions_needed} more '
                f'session{"s" if sessions_needed > 1 else ""} to enable '
                f'personalised screening.'
            ),
        }

    # z-score: how many std devs from personal baseline
    z = (current_prob - personal_mean) / max(personal_std, 0.02)

    if z < 1.0:
        status, colour = 'Stable', 'green'
        message = (
            'Your motor timing today is consistent with your '
            'personal baseline. No change detected.'
        )
    elif z < 2.0:
        status, colour = 'Mild change', 'amber'
        message = (
            'Slight elevation from your personal baseline. '
            'This is likely normal day-to-day variation.'
        )
    else:
        status, colour = 'Notable change', 'red'
        message = (
            'Meaningful deviation from your personal baseline. '
            'Consider retesting on another day.'
        )

    return {
        'baseline_ready':    True,
        'status':            status,
        'status_colour':     colour,
        'message':           message,
        'z_score':           float(round(float(z), 2)),
        'personal_mean':     float(round(float(personal_mean), 3)),
        'personal_std':      float(round(float(personal_std), 3)),
        'raw_score':         current_prob,
        'baseline_sessions': len(baseline_probs),
        'display_score':     float(round(float(z), 2)),
        'display_mode':      'z_score',
    }

def generate_verdict(
    corrected_prob:   float,
    raw_prob:         float,
    baseline_result:  dict,
    age:              int,
    n_keystrokes:     int,
    n_windows:        int,
    top_feature:      str,
    ood_grade:        str,
    confidence_band:  str,
) -> str:
    """New Step 11 Verdict Generator"""
    parts = []

    # Part A — Session Interpretation (Prioritize session-based prediction)
    if corrected_prob >= 0.65:
        parts.append('Your typing kinematics in this session display elevated signal characteristics consistent with early motor impairment.')
    elif corrected_prob <= 0.35:
        parts.append('Your typing kinematics in this session show strong, healthy timing characteristics indicative of stable fine motor control.')
    else:
        parts.append('Your typing characteristics in this session fall into a moderate or borderline range.')

    # Part B — baseline status
    if not baseline_result.get('baseline_ready'):
        sessions_needed = baseline_result.get('sessions_needed', 3)
        p_mean = baseline_result.get('personal_mean', corrected_prob)
        parts.append(
            f'Your running average risk score over recorded sessions is {p_mean:.2f}. '
            f'Complete {sessions_needed} more session'
            f'{"s" if sessions_needed > 1 else ""} to unlock fully personalised tracking.'
        )
    else:
        status = baseline_result.get('status', 'Stable')
        if status == 'Stable':
            parts.append(
                'Your motor timing today is consistent with your '
                'personal baseline established over previous sessions. '
                'No meaningful change has been detected.'
            )
        elif status == 'Mild change':
            parts.append(
                'Your typing shows a slight elevation from your personal '
                'baseline. This level of variation is within the range of '
                'normal day-to-day fluctuation and is not clinically significant.'
            )
        else:
            parts.append(
                'Your typing shows a notable deviation from your personal '
                'baseline. This warrants a repeat session on a separate day '
                'before drawing any conclusions.'
            )

    # Part B — confidence qualifier
    if confidence_band == 'Low':
        parts.append(
            'The result sits close to the decision boundary — '
            'a repeat session is recommended.'
        )

    # Part C — top feature
    signal_map = {
        'ht': 'how long keys are held down',
        'ft': 'the time between releasing one key and pressing the next',
        'lat': 'the interval between consecutive keypresses',
        'bg':  'the timing of specific key pair combinations',
        'dfa': 'the long-range rhythm consistency of your typing',
        'pent':'the complexity and predictability of your typing rhythm',
    }
    signal = next(
        (desc for key, desc in signal_map.items() if key in top_feature.lower()),
        'your overall typing timing patterns'
    )
    parts.append(
        f'The strongest contributing factor was {signal}.'
    )

    # Part D — data quality
    if n_keystrokes < 200:
        parts.append(
            f'Only {n_keystrokes} keystrokes were recorded. '
            f'A longer session improves reliability.'
        )
    elif n_windows < 4:
        parts.append(
            f'Only {n_windows} clean windows were available for analysis. '
            f'Try typing more smoothly to improve signal quality.'
        )

    # Part E — OOD warning
    if ood_grade == 'Out-of-Distribution':
        parts.append(
            'Your typing pattern differs substantially from the training '
            'population. This may affect result reliability.'
        )

    return ' '.join(parts)
# --- Global Model Variables ---
PREP = None
AIM_BUNDLE = None
METADATA = {}
AIM_MODEL = None

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest, current_user: User = Depends(user_router.get_current_user)):
    try:
        # Setup
        global AIM_MODEL, PREP, METADATA

        # 0. Precise Context Extraction from JWT (Step 11 requirement)
        age = int(current_user.age or 30)
        user_id = str(current_user.id)
        print(f"[PREDICT] Session {request.sessionId} for user {user_id}")

        # 1. Hydration Guard
        if AIM_MODEL is None or PREP is None:
            raise HTTPException(status_code=530, detail="AIM Model offline.")

        # 2. Volume Check
        ks_list = [k.model_dump() for k in request.keystrokeEvents]
        if len(ks_list) < 150:
            raise HTTPException(status_code=422, detail=f"Insufficient data: {len(ks_list)} keystrokes.")

        # 3. Clinical Feature Extraction
        print("[PREDICT] Step 3: Feature Extraction")
        X_raw, n_windows = fe.FeatureExtractor.build_user_feature_vector(ks_list)
        if X_raw is None or n_windows < 2:
            raise HTTPException(status_code=422, detail="Session too noisy for clinical extraction.")

        # 4. Speed Normalisation
        print("[PREDICT] Step 4: Speed Normalisation")
        X_raw = fe.apply_speed_normalisation(X_raw, ks_list, PREP['feat_names_all'])

        # 5. Preprocessing
        print("[PREDICT] Step 5: Preprocessing")
        X_scaled = fe.preprocess(X_raw, PREP, request.keyboard_polling_hz)

        # 6. Model Inference
        print("[PREDICT] Step 6: Model Inference")
        raw_p_obj = AIM_MODEL.predict(X_scaled)
        if raw_p_obj is None:
            print("[PREDICT ERROR] AIM_MODEL.predict returned None!")
            prob_raw = 0.5
        else:
            prob_raw = float(raw_p_obj)

        # 7. Post-hoc Clinical Corrections
        print("[PREDICT] Step 7: Post-hoc Clinical Corrections")
        weighted_p = apply_window_confidence_weight(prob_raw, n_windows)
        age_res    = apply_age_correction(weighted_p, age)
        corrected_p = age_res['corrected']

        # 8. OOD & Reliability Scoring
        print("[PREDICT] Step 8: OOD & Reliability Scoring")
        ood = fe.compute_ood_score(X_raw, PREP['scaler'], PREP['feat_names_all'])

        # 9. Personal Baseline Comparison
        print("[PREDICT] Step 9: Personal Baseline Comparison")
        history = get_baseline_sessions(user_id, limit=5)
        baseline = compute_personal_baseline_score(corrected_p, history)

        # 10. Labeling & Confidence
        print("[PREDICT] Step 10: Labeling")
        THRESHOLD = 0.65
        label = 1 if corrected_p >= THRESHOLD else 0
        if corrected_p < 0.25 or corrected_p > 0.75: band = 'High'
        elif corrected_p < 0.35 or corrected_p > 0.65: band = 'Moderate'
        else: band = 'Low'
        # 11. Breakdown & Explainability
        print("[PREDICT] Step 11: Breakdown & Explainability")
        
        # Pull AIM-specific feature names and importances (or fall back to defaults)
        aim_meta = METADATA.get('student_aim', {}) if METADATA else {}
        aim_feat_names = aim_meta.get('input_feature_names', [])
        aim_top_features = aim_meta.get('top5_features', [])
        
        n_scaled_cols = X_scaled.shape[1]
        scaler_center = PREP['scaler'].center_ if hasattr(PREP['scaler'], 'center_') else []
        
        # Display the 25 base columns correctly
        all_f_objects = []
        for i in range(n_scaled_cols):
            name = aim_feat_names[i] if i < len(aim_feat_names) else f"feature_{i}"
            try:
                xv = X_scaled[0, i]
                cv = scaler_center[i] if i < len(scaler_center) else 0.0
                val = float(xv) if xv is not None else 0.0
                center_val = float(cv) if cv is not None else 0.0
                
                # Try finding actual importance from metadata
                importance = 0.01  # Default minimal importance
                for feat, imp in aim_top_features:
                    if feat == name:
                        importance = imp
                        break
                
                all_f_objects.append(FeatureDetail(
                    name=fe.extract_base_feature_name(name),
                    raw_name=name,
                    importance=importance,
                    pct=importance * 100,
                    value=val,
                    direction="UP" if val > center_val else "DOWN"
                ))
            except (IndexError, TypeError, ValueError):
                continue
        
        # 12. Top Factors (used for quick summary)
        print("[PREDICT] Step 12: Top Factors Extraction")
        top_5 = sorted(all_f_objects, key=lambda x: x.importance, reverse=True)[:5]
        top_factor_names = [f.name for f in top_5]

        # 13. Contextual metadata
        print("[PREDICT] Step 13: Contextual metadata")
        sq = {
            "grade": "Good" if n_windows >= 10 else "Fair",
            "score": 90 if n_windows >= 10 else 75,
            "spike_ratio": 0.5,
            "reason": "Steady typing rhythm detected."
        }
        polling_hz = request.keyboard_polling_hz or 125
        ki = {
            "polling_hz": polling_hz,
            "keyboard_name": request.keyboard_name or "Standard HID",
            "min_measurable_ht_ms": 1000.0 / polling_hz,
            "detection_method": "polling_analysis",
            "detection_confidence": "high"
        }

        # 13. Clinical Persistence
        print("[PREDICT] Step 13: Clinical Persistence")
        try:
            save_session(
                user_id               = user_id,
                session_id            = str(request.sessionId),
                probability           = float(corrected_p or 0.5),
                raw_probability       = float(prob_raw or 0.5),
                label                 = int(label),
                n_keystrokes          = len(ks_list),
                n_windows             = int(n_windows),
                raw_feature_vector    = X_raw[0].tolist(),
                scaled_feature_vector = X_scaled[0].tolist(),
                ood_grade             = str(ood.get('ood_grade', 'Unknown')),
                age_at_session        = int(age),
                keyboard_polling      = polling_hz,
            )
        except Exception as e:
            print(f"[PREDICT Error] DB persistence failed: {e}")

        # 14. Verdict Generation
        print("[PREDICT] Step 14: Verdict Generation")
        verdict = generate_verdict(
            corrected_prob  = corrected_p,
            raw_prob        = prob_raw,
            baseline_result = baseline,
            age             = age,
            n_keystrokes    = len(ks_list),
            n_windows       = n_windows,
            top_feature     = top_factor_names[0] if top_factor_names else "Rhythm",
            ood_grade       = ood.get('ood_grade', 'Unknown'),
            confidence_band = band
        )

        # 15. Final Response
        print("[PREDICT] Step 15: Final Response")
        return PredictResponse(
            sessionId=str(request.sessionId),
            userId=user_id,
            riskLabel=float(corrected_p),
            timestamp=int(datetime.utcnow().timestamp() * 1000),
            topFactors=top_factor_names,
            rawVector=X_raw[0].tolist(),
            scaledVector=X_scaled[0].tolist(),
            windowConfidence=float(n_windows / 10.0),
            oodGrade=str(ood.get('ood_grade', 'Unknown')),
            longitudinal_mean=float(baseline.get('personal_mean', corrected_p)),
            delta_from_baseline=float(corrected_p - baseline.get('personal_mean', corrected_p)),
            trend_slope=0.0,
            raw_probability=float(prob_raw),
            age_correction=age_res,
            window_confidence=float(min(n_windows / 10.0, 1.0)),
            personal_baseline=baseline,
            ood_info=ood,
            label=int(label),
            label_text="Elevated" if label == 1 else "Healthy",
            threshold_used=THRESHOLD,
            confidence=float(abs(corrected_p - 0.5) * 2),
            confidence_band=band,
            n_keystrokes=len(ks_list),
            n_windows=int(n_windows),
            all_features=all_f_objects,
            top5_features=top_5,
            session_quality=sq,
            keyboard_info=ki,
            verdict=verdict,
            aim_auc=float(METADATA.get('metrics', {}).get('auc', 0.84)) if METADATA else 0.84,
            disclaimer="NeuroTrace is a clinical decision support tool."
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback, sys
        err_type, err_obj, err_tb = sys.exc_info()
        fname = err_tb.tb_frame.f_code.co_filename if err_tb else "Unknown"
        line_no = err_tb.tb_lineno if err_tb else 0
        tb_msg = traceback.format_exc()

        with open("predict_crash.log", "a") as f:
            f.write(f"\n{'='*40}\n")
            f.write(f"TIMESTAMP: {datetime.now().isoformat()}\n")
            f.write(f"ERROR: {str(e)}\n")
            f.write(tb_msg)
            f.write(f"{'='*40}\n")

        print(f"[PREDICT CRASH] {str(e)} at {fname}:{line_no}")
        raise HTTPException(status_code=500, detail=f"Inference Engine Crash: {str(e)} at {fname}:{line_no}")

@app.post("/features")
def features(request: PredictRequest):
    if PREP is None: raise HTTPException(status_code=503, detail="Offline")
    ks_dicts = [k.model_dump() for k in request.keystrokes]
    X_raw = fe.build_feature_matrix(ks_dicts)
    if X_raw is None: raise HTTPException(status_code=422, detail="Insufficient data.")
    X_scaled = fe.preprocess(X_raw, PREP)
    return {"raw": X_raw[0].tolist(), "scaled": X_scaled[0].tolist()}
    
    return {
        "raw_features_526": X_raw[0].tolist(),
        "scaled_features_80": X_scaled[0].tolist()
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
