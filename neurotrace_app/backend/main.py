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
from schemas import PredictRequest, PredictResponse, FeatureDetail
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
    if probability < 0.15:
        part_a = "Positive Result: Your motor timing is optimal. No parkinsonian markers were detected in this session."
    elif probability < 0.30:
        part_a = "Normal range. Your keystroke timing patterns are consistent with healthy motor control."
    elif probability < 0.45:
        part_a = "Mild variation detected. While within the common range for healthy individuals, factors like fatigue or caffeine can influence this score."
    elif probability < threshold:
        part_a = "Your keystroke timing patterns show some variation that warrants monitoring over time."
    elif probability < 0.65:
        part_a = "Your keystroke timing patterns show elevated variation in motor timing that the model associates with early motor changes."
    elif probability < 0.80:
        part_a = "Your keystroke timing patterns show notable irregularities in motor timing consistent with the patterns the model was trained to detect."
    else:
        part_a = "Your keystroke timing patterns show strong irregularities in motor timing that strongly resemble patterns seen in the training data."

    if confidence_band == "Low":
        part_b = (
            "The result was computed with limited data samples. For a 'Gold Status' verified result, "
            "we recommend completing at least 500 keystrokes or using the specialized Tappy Mode."
        )
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
    print("First 10 key values:", [k.key for k in request.keystrokes[:10]])
    print("Unique key values:", set(k.key for k in request.keystrokes))
    print("First 10 key values:", [k.key for k in request.keystrokes[:10]])
    print("Unique key values:", set(k.key for k in request.keystrokes))
    try:
        # Step 5: Validate keystrokes length
        if len(request.keystrokes) < 150:
            raise HTTPException(status_code=422, detail="Minimum 150 keystrokes required.")
        
        # Hydration Guard
        if AIM_MODEL is None or AIM_BUNDLE is None or PREP is None:
            raise HTTPException(status_code=503, detail="AIM Model offline.")
            
        # Use locally scoped references to avoid NoneType lints
        model: Any = AIM_MODEL
        bundle: dict = AIM_BUNDLE
        prep: dict = PREP

        # 1. Extract keyboard info from request
        polling_hz = request.keyboard_polling_hz or 125
        q_ms = 1000.0 / float(polling_hz)

        # 2. Build Features
        ks_dicts = [k.model_dump() for k in request.keystrokes]
        cleaned_ks = fe.motor_clean_filter(ks_dicts)
        cleaned_count = len(cleaned_ks)
        
        # Use FeatureExtractor (Class 4)
        extractor = fe.FeatureExtractor(prep)
        X_raw = extractor.getTemporalFeatures(
            ht=[k['hold_time'] for k in cleaned_ks],
            ft=[k.get('flight_time') or 0.0 for k in cleaned_ks],
            lat=[k.get('latency') or 0.0 for k in cleaned_ks],
            key=[k['keyId'] for k in cleaned_ks]
        )
        if X_raw is None or len(X_raw) == 0:
            raise HTTPException(status_code=422, detail="Feature extraction failed. Insufficient clean data.")

        # --- TECHNIQUE 10: BIGRAM ALIGNMENT ---
        alignment_score = fe.get_bigram_alignment_score(cleaned_ks)

        # --- TECHNIQUE 7: SPEED NORMALISATION ---
        X_raw = fe.apply_speed_normalisation(cleaned_ks, X_raw, bundle.get('feature_names_raw', []))

        # 3. Preprocess
        X_scaled = fe.preprocess(X_raw, prep, polling_hz=polling_hz)
        n_windows_used = X_raw.shape[0]
        
        feature_names = bundle.get('feature_names', [])
        # Apply BIGRAM downweighting if alignment is low (< 0.4)
        if alignment_score < 0.4:
            bigram_downweight = 0.6
            for i, name in enumerate(feature_names):
                if 'bg' in name.lower(): X_scaled[0, i] *= bigram_downweight

        # 3. Predict (AIM-Student-v1)
        res = model.predict(X_scaled)
        prob = float(res.probability_pd)

        # --- TECHNIQUE 9: OOD SCORING ---
        def compute_ood_score(X_raw_data, scaler):
            center = scaler.center_
            scale = scaler.scale_
            z = (X_raw_data[0] - center) / (scale + 1e-8)
            mad = float(np.median(np.abs(z)))
            grade = "In-Distribution"
            if mad > 2.0: grade = "Out-of-Distribution"
            elif mad > 1.0: grade = "Marginal"
            return {"grade": grade, "mad": mad}

        ood_info = compute_ood_score(X_raw, prep['scaler'])

        # 4. Calibration
        import math
        raw_log_odds = math.log(max(float(prob), 1e-6) / max(1.0 - float(prob), 1e-6))
        cal_log_odds = raw_log_odds * 0.70 - 1.50
        if polling_hz < 250: cal_log_odds *= 0.45 
        elif polling_hz < 500: cal_log_odds *= 0.75
        prob = 1.0 / (1.0 + math.exp(-cal_log_odds))

        # --- TECHNIQUE 8: WINDOW CONFIDENCE ---
        window_confidence = min(float(n_windows_used) / 10.0, 1.0)
        prob = prob * window_confidence + 0.5 * (1.0 - window_confidence)

        # --- TECHNIQUE 6: LONGITUDINAL ---
        l_mean = prob
        delta = 0.0
        trend = 0.0
        if request.historyProbs:
            history = request.historyProbs[-4:] + [prob]
            l_mean = float(np.mean(history))
            delta = prob - float(np.mean(request.historyProbs))
            if len(history) >= 2:
                trend = float(np.polyfit(np.arange(len(history)), history, 1)[0])

        display_prob = l_mean if len(request.historyProbs) >= 2 else prob
        if display_prob < 0.25 or display_prob > 0.75: band = "High"
        elif display_prob < 0.35 or display_prob > 0.65: band = "Moderate"
        else: band = "Low"

        # 5. Build features breakdown
        feature_importances = bundle.get('feature_importances', [])
        sum_imp = float(sum(feature_importances)) if sum(feature_importances) > 0 else 1.0
        all_features = []
        for i in range(len(feature_names)):
            r_name = feature_names[i]; d_name = r_name.replace('_', ' ').strip().upper()
            imp = float(feature_importances[i]); pct = (imp / sum_imp) * 100.0; val = float(X_scaled[0, i])
            all_features.append({"name": d_name, "raw_name": r_name, "importance": imp, "pct": pct, "value": val, "direction": "UP" if val >= 0 else "DOWN"})
        top_feats = all_features[:5]
        
        left_chars = set("`12345qwertasdfgzxcvbQWERTASDFGZXCVB")
        left_count = sum(1 for k in request.keystrokeEvents if str(k.keyId) in left_chars)
        right_count = sum(1 for k in request.keystrokeEvents if str(k.keyId) not in left_chars)
        lr_ratio = left_count / max(right_count, 1)
        threshold_used = 0.65 if n_windows_used >= 15 else (0.72 if n_windows_used >= 8 else 0.80)

        # Reliability Note
        if polling_hz >= 1000: reliability_note = "All features are fully reliable."
        elif polling_hz >= 500: reliability_note = "High reliability. Small resolution dampening applied."
        else: reliability_note = f"Standard {polling_hz}Hz polling detected. High-speed rhythm features downweighted."

        verdict = generate_verdict(
            probability=display_prob,
            confidence_band=band,
            top5=top_feats,
            n_keystrokes=cleaned_count,
            lr_ratio=lr_ratio,
            threshold=threshold_used,
            quality=0.8,
            polling_hz=polling_hz
        )
        aim_metrics = METADATA.get('metrics', {}) if METADATA else {}

        return PredictResponse(
            sessionId=str(request.session_id),
            userId=request.userId,
            riskLabel=prob,
            label=int(res.label_id),
            label_text=str(res.label),
            threshold_used=threshold_used,
            confidence=abs(display_prob - 0.5) * 2,
            confidence_band=band,
            n_keystrokes=cleaned_count,
            n_windows=n_windows_used,
            topFactors=[f['name'] for f in top_feats],
            all_features=[FeatureDetail(**f) for f in all_features],
            verdict=verdict,
            aim_auc=float(aim_metrics.get('auc', 0.72)),
            disclaimer=f"Grade: {ood_info['grade']}. {reliability_note}",
            rawVector=X_raw[0].tolist() if X_raw is not None else [],
            scaledVector=X_scaled[0].tolist(),
            windowConfidence=window_confidence,
            oodGrade=ood_info['grade'],
            longitudinal_mean=l_mean,
            delta_from_baseline=delta,
            trend_slope=trend
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Inference Engine Crash: {str(e)}")

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
    # Bound to clinicians port 8421
    uvicorn.run(app, host="127.0.0.1", port=8421)
