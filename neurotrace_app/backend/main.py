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
from typing import List, Optional

# Step 5 Requirement: Add models/ to sys.path
MODEL_DIR = Path(__file__).parent / 'models'
sys.path.append(str(MODEL_DIR))

# --- MODEL HYDRATION SYNC (PICKLE) ---
# Define _ProbWrap locally to allow pickle to load student_aim.pkl bundle.
# This matches the training notebook's internal structure.
class _ProbWrap:
    def __init__(self, model): self.model = model
    def predict_proba(self, X): return self.model.predict_proba(X)
    def predict(self, X): return self.model.predict(X)

# Inject into possible module namespaces where pickle might look
for m_name in ['__main__', 'main', 'uvicorn.workers']:
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

# Local imports
from schemas import PredictRequest, PredictResponse
from services import feature_engineering as fe

# Auth & Database Imports (Restored for application functionality)
from routes import user_router, item_router
from db.database import db_manager
from sqlmodel import Session

app = FastAPI(title="NeuroTrace Parkinson's Screening API", version="2.2.0")

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

# Global variables for models
PREP = None
AIM_BUNDLE = None
METADATA = None
AIM_MODEL = None

@app.on_event("startup")
def load_and_init():
    global PREP, AIM_BUNDLE, METADATA, AIM_MODEL
    
    # 1. Load ML models (Strict ASCII logging for Windows)
    try:
        with open(MODEL_DIR / 'preprocessing.pkl', 'rb') as f:
            PREP = pickle.load(f)
        with open(MODEL_DIR / 'student_aim.pkl', 'rb') as f:
            AIM_BUNDLE = pickle.load(f)
        with open(MODEL_DIR / 'model_metadata.json', 'r') as f:
            METADATA = json.load(f)
        
        # Instantiate StudentAIM from models.student_aim_inference
        from student_aim_inference import StudentAIM
        AIM_MODEL = StudentAIM(AIM_BUNDLE, PREP)
        print("[NeuroTrace] Models loaded and AIM_MODEL initialized.")
    except Exception as e:
        print(f"[NeuroTrace Error] Failed to load models: {e}")
        # We don't exit, but endpoints will fail with 500
        
    # 2. Init Database (Restored)
    try:
        db_manager.create_db_and_tables()
        print("[NeuroTrace] Database tables initialized.")
    except Exception as e:
        print(f"[NeuroTrace Error] DB Init failed: {e}")

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
        'spike_ratio':         float(round(spike_ratio * 100, 1)),
        'reason':              ', '.join(reason) if reason else 'Session quality is good',
        'polling_hz':          polling_hz,
        'polling_score':       round(polling_score * 100, 1),
        'min_measurable_ms':   q_ms,
        'detection_confidence': detection_confidence,
    }

def generate_verdict(
    probability: float,
    confidence_band: str,
    top5: list,
    n_keystrokes: int,
    lr_ratio: float,
    threshold: float,
    quality: dict,
    polling_hz: int = 125
) -> str:
    if probability < 0.25:
        part_a = "Your keystroke timing patterns show no significant markers associated with motor control changes."
    elif probability < 0.40:
        part_a = "Your keystroke timing patterns show mild variation that is within the normal range for most people."
    elif probability < threshold:
        part_a = "Your keystroke timing patterns show some variation that warrants monitoring over time."
    elif probability < 0.65:
        part_a = "Your keystroke timing patterns show elevated variation in motor timing that the model associates with early motor changes."
    elif probability < 0.80:
        part_a = "Your keystroke timing patterns show notable irregularities in motor timing consistent with the patterns the model was trained to detect."
    else:
        part_a = "Your keystroke timing patterns show strong irregularities in motor timing that strongly resemble patterns seen in the training data."

    if confidence_band == "Low":
        part_b = "The result sits close to the decision boundary, meaning a repeat test is recommended before drawing any conclusions."
    elif confidence_band == "Moderate":
        part_b = "The result was produced with moderate confidence."
    else:
        part_b = "The result was produced with high confidence."

    raw_name = top5[0]["raw_name"]
    if 'ht' in raw_name:
        signal = "how long keys are held down"
    elif 'ft' in raw_name:
        signal = "the time between releasing one key and pressing the next"
    elif 'lat' in raw_name or 'iki' in raw_name:
        signal = "the interval between consecutive keypresses"
    elif 'bg' in raw_name:
        signal = "the timing of specific key pair combinations"
    elif 'dfa' in raw_name:
        signal = "the long-range rhythm consistency of your typing"
    elif 'pent' in raw_name:
        signal = "the complexity and predictability of your typing rhythm"
    else:
        signal = "your overall typing timing patterns"
    
    direction_word = "higher than" if top5[0]["direction"] == "UP" else "lower than"
    part_c = f"The strongest contributing factor was {signal}, which was {direction_word} typical for this model."

    if n_keystrokes < 200:
        part_d = f"Note: only {n_keystrokes} keystrokes were recorded. A longer session of 300+ keystrokes would improve result reliability."
    elif n_keystrokes >= 400:
        part_d = f"This result is based on a strong sample of {n_keystrokes} keystrokes, improving its reliability."
    else:
        part_d = ""

    if quality.get('grade') == 'Poor':
        prefix = (
            "Note: this session had a high rate of timing irregularities "
            f"({quality.get('spike_ratio', 0)}% spike rate), likely from typing "
            "corrections, which may have affected the score. "
            "Consider retesting with slower, more deliberate typing. "
        )
    elif quality.get('grade') == 'Fair':
        prefix = (
            "This session had moderate timing irregularities. "
            "Results should be interpreted with some caution. "
        )
    else:
        prefix = ""

    verdict_parts = [prefix, part_a, part_b, part_c] if prefix else [part_a, part_b, part_c]
    if part_d:
        verdict_parts.append(part_d)
    
    # Part E — hardware note
    q_ms = 1000.0 / float(polling_hz)
    if polling_hz >= 1000:
        hw_note = ""
    elif polling_hz >= 500:
        hw_note = "Your keyboard captures timing at high resolution, supporting reliable analysis."
    elif polling_hz >= 250:
        hw_note = (f"Your keyboard operates at {polling_hz}Hz polling. Results are generally reliable "
                   "but some fine-grained timing features have reduced accuracy.")
    else:
        hw_note = (f"Your keyboard operates at {polling_hz}Hz, which limits timing resolution to "
                   f"\xb1{q_ms:.0f}ms. Core timing patterns remain measurable, but entropy and rhythm "
                   "features have reduced precision. For higher accuracy, consider using a keyboard "
                   "with 1000Hz polling.")
    
    if hw_note:
        verdict_parts.append(hw_note)

    return " ".join(verdict_parts)

@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    print("First 10 key values:", [k['key'] for k in request.keystrokes[:10]])
    print("Unique key values:", set(k['key'] for k in request.keystrokes))
    try:
        # Step 5: Validate keystrokes length
        if len(request.keystrokes) < 150:
            raise HTTPException(status_code=422, detail="Minimum 150 keystrokes required.")
        
        if AIM_MODEL is None:
            raise HTTPException(status_code=503, detail="AIM Model offline.")


        # 1. Extract keyboard info from request
        polling_hz = request.keyboard_polling_hz or 125
        q_ms = 1000.0 / float(polling_hz)

        # 2. Build Features (polling-aware + motor-clean filtering)
        ks_dicts = [k.dict() for k in request.keystrokes]
        raw_ks_count = len(ks_dicts)
        print("[DEBUG] Number of raw keystrokes:", raw_ks_count)
        # Report cleaning stats (filter runs inside build_feature_matrix too)
        cleaned_ks = fe.motor_clean_filter(ks_dicts)
        cleaned_count = len(cleaned_ks)
        removed_count = raw_ks_count - cleaned_count
        cleaning_pct = round((removed_count / max(raw_ks_count, 1)) * 100, 1)
        print(f"[DEBUG] Cleaned keystrokes: {cleaned_count}, Removed: {removed_count}, Cleaning %: {cleaning_pct}")

        X_raw = fe.build_feature_matrix(ks_dicts, polling_hz=polling_hz)
        print("[DEBUG] X_raw shape:", None if X_raw is None else X_raw.shape)
        if X_raw is None:
            print("[DEBUG] Feature extraction failed — only", cleaned_count, "clean keystrokes after filtering", removed_count, "corrections.")
            raise HTTPException(status_code=422, detail=f"Feature extraction failed — only {cleaned_count} clean keystrokes after filtering {removed_count} corrections. Type more without corrections, or use Tappy mode.")

        # 3. Preprocess (polling-aware scale + select)
        X_scaled = fe.preprocess(X_raw, PREP, polling_hz=polling_hz)
        print("[DEBUG] X_scaled shape:", X_scaled.shape)
        print("[DEBUG] First 10 scaled features:", X_scaled[0, :10])

        # 3. Predict (AIM-Student-v1)
        res = AIM_MODEL.predict(X_scaled)
        prob = res.probability_pd

        # 4. Compute confidence_band
        if prob < 0.25 or prob > 0.75: band = "High"
        elif prob < 0.35 or prob > 0.65: band = "Moderate"
        else: band = "Low"

        # 5. Build features breakdown
        feature_importances = AIM_BUNDLE.get('feature_importances', [])
        feature_names = AIM_BUNDLE.get('feature_names', [])
        sum_imp = float(sum(feature_importances)) if sum(feature_importances) > 0 else 1.0
        
        all_features = []
        for i in range(len(feature_names)):
            r_name = feature_names[i]
            d_name = r_name.replace('_', ' ').strip().upper()
            imp = float(feature_importances[i])
            pct = (imp / sum_imp) * 100.0
            val = float(X_scaled[0, i])
            all_features.append({
                "name": d_name,
                "raw_name": r_name,
                "importance": imp,
                "pct": pct,
                "value": val
            })
        right_chars = set("67890^&*()yuiophjklnmYUIOPHJKLNM")
        left_count = sum(1 for k in ks_dicts if str(k.get('key', '')) in left_chars)
        right_count = sum(1 for k in ks_dicts if str(k.get('key', '')) in right_chars)
        lr_ratio = left_count / max(right_count, 1)

        threshold_used = 0.65   # Raised from 0.5 — reduces false positives from free-text typing
        session_quality = compute_session_quality(
            ks_dicts,
            polling_hz=polling_hz,
            detection_confidence=request.detection_confidence
        )
        

        # --- NEW RELIABILITY WEIGHTING LOGIC (per user instructions) ---
        def is_unreliable(feature_name, polling_hz):
            # Features with these substrings are unreliable below 1000Hz
            unreliable_keywords = ["dfa", "pentropy", "tremor", "entropy"]
            if polling_hz >= 1000:
                return False
            fname = feature_name.lower()
            return any(kw in fname for kw in unreliable_keywords)

        unreliable_raw = [name for name in feature_names if is_unreliable(name, polling_hz)]
        unreliable_display = sorted(set([
            n.replace('_', ' ').strip().upper()[:30] for n in unreliable_raw
        ]))

        if polling_hz >= 1000:
            reliability_note = "All features are fully reliable at 1000Hz polling."
        elif polling_hz >= 500:
            reliability_note = "Most features are reliable. Minor downweighting applied to entropy, DFA, and tremor features."
        elif polling_hz >= 250:
            reliability_note = "Moderate downweighting applied to entropy, DFA, and tremor features. Consider using a higher polling rate keyboard."
        else:
            reliability_note = (
                f"Standard keyboard detected ({polling_hz}Hz). Entropy, DFA, and tremor features have been "
                "downweighted. Core timing features (hold time, IKI, flight time) remain fully reliable. "
                "A gaming keyboard with 1000Hz polling would significantly improve result accuracy."
            )

        keyboard_info_dict = {
            'polling_hz':           polling_hz,
            'keyboard_name':        request.keyboard_name,
            'is_gaming_keyboard':   polling_hz >= 500,
            'quantisation_warning': request.quantisation_warning,
            'detection_method':     request.detection_method,
            'detection_confidence': request.detection_confidence,
            'min_measurable_ht_ms': q_ms,
        }

        verdict = generate_verdict(
            probability=prob,
            confidence_band=band,
            top5=top_feats,
            n_keystrokes=len(request.keystrokes),
            lr_ratio=lr_ratio,
            threshold=threshold_used,
            quality=session_quality,
            polling_hz=polling_hz
        )
        
        aim_metrics = METADATA.get('metrics', {})

        return {
            "probability": prob,
            "label": res.label_id,
            "label_text": res.label,
            "threshold_used": threshold_used,
            "confidence": abs(prob - 0.5) * 2,
            "confidence_band": band,
            "n_keystrokes": len(request.keystrokes),
            "n_windows": int(X_raw[0, -1]),
            "left_count": left_count,
            "right_count": right_count,
            "lr_ratio": lr_ratio,
            "top5_features": top_feats,
            "all_features": all_features,
            "scorecard_rules": scorecard_rules,
            "session_quality": session_quality,
            "signal_cleaning": {
                "raw_keystrokes": raw_ks_count,
                "clean_keystrokes": cleaned_count,
                "removed_keystrokes": removed_count,
                "correction_rate_pct": cleaning_pct,
            },
            "keyboard_info":   keyboard_info_dict,
            "unreliable_features": unreliable_display,
            "reliability_note":    reliability_note,
            "verdict": verdict,
            "aim_auc": aim_metrics.get('auc', 0.84),
            "aim_sensitivity": aim_metrics.get('sensitivity', 0.8),
            "aim_specificity": aim_metrics.get('specificity', 0.8),
            "disclaimer": "This result is a statistical screening signal only. It is not a clinical diagnosis. The model was trained on a research dataset and has not been clinically validated. Please consult a neurologist for any medical evaluation.",
            "debug_logs": debug_logs
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Inference Engine Crash: {str(e)}")

@app.post("/features")
def features(request: PredictRequest):
    ks_dicts = [k.dict() for k in request.keystrokes]
    X_raw = fe.build_feature_matrix(ks_dicts)
    if X_raw is None:
        raise HTTPException(status_code=422, detail="Insufficient data.")
    X_scaled = fe.preprocess(X_raw, PREP)
    
    return {
        "raw_features_526": X_raw[0].tolist(),
        "scaled_features_80": X_scaled[0].tolist()
    }

if __name__ == "__main__":
    import uvicorn
    # Bound to clinicians port 8421
    uvicorn.run(app, host="127.0.0.1", port=8421)
