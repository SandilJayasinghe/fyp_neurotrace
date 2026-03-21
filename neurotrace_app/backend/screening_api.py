from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pickle, numpy as np, json
from pathlib import Path
from schemas import PredictRequest, PredictResponse
from services.feature_engineering import build_feature_matrix

# Use as a router or merge with existing app
app = FastAPI(title="PD Keystroke Screening API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Electron renderer origin or specific
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model Loading ─────────────────────────────────────────────────────────────
MODEL_DIR = Path(__file__).parent / "ml_models"
MODEL_DIR.mkdir(exist_ok=True)

# Helper for mocking or actual loading
def load_ml_dependency(filename):
    path = MODEL_DIR / filename
    if not path.exists():
        print(f"⚠️ Warning: {filename} not found in {MODEL_DIR}. Using mock values for now.")
        return None
    with open(path, "rb") as f:
        return pickle.load(f)

STUDENT = load_ml_dependency("aim_student.pkl")       
SCALER = load_ml_dependency("scaler.pkl")        
SELECTOR = load_ml_dependency("feature_selector.pkl")      
FEAT_NAMES_PATH = MODEL_DIR / "feat_names.txt"
FEAT_NAMES = FEAT_NAMES_PATH.read_text().splitlines() if FEAT_NAMES_PATH.exists() else [f"feature_{i}" for i in range(80)]
OPT_THRESHOLD = 0.42               

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model": "AIM-Student-v1"}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    ks = [k.model_dump() for k in req.keystrokes]

    # 1. Feature engineering
    X_raw = build_feature_matrix(ks)
    if X_raw is None:
        raise HTTPException(422, detail="Insufficient keystrokes (need ≥ 150)")

    # 2. Aggregate windows → user-level vector (median robust to outlier windows)
    X_user = np.median(X_raw, axis=0).reshape(1, -1)

    # If models are not loaded, provide mock results
    if STUDENT is None or SCALER is None or SELECTOR is None:
        # Mock prediction logic for development
        prob = float(np.random.uniform(0.1, 0.8))
        label = int(prob >= OPT_THRESHOLD)
        band = "Low" if prob < 0.3 else ("Moderate" if prob < 0.6 else "High")
        top_feats = [
            {"name": FEAT_NAMES[i], "value": 1.2, "importance": 0.1, "direction": "↑"}
            for i in range(5)
        ]
        path_rules = ["Mock Rule 1: Feature X > 0.5", "Mock Rule 2: Feature Y <= 0.2"]
    else:
        # actual pipeline
        vt = SELECTOR["vt"]
        sel_idx = SELECTOR["selected_idx"]

        X_vt = vt.transform(X_user)                     # VarianceThreshold
        X_sel = X_vt[:, sel_idx]                         # top-80 selection
        X_scaled = SCALER.transform(X_sel)               # RobustScaler

        prob = float(STUDENT.predict_proba(X_scaled)[0, 1])
        label = int(prob >= OPT_THRESHOLD)

        if prob < 0.25 or prob > 0.75:
            band = "High"
        elif prob < 0.35 or prob > 0.65:
            band = "Moderate"
        else:
            band = "Low"

        importances = STUDENT.feature_importances_
        top_idx = np.argsort(importances)[::-1][:5]
        top_feats = [
            {
                "name": FEAT_NAMES[i],
                "value": round(float(X_scaled[0, i]), 4),
                "importance": round(float(importances[i]), 4),
                "direction": "↑" if X_scaled[0, i] > 0 else "↓",
            }
            for i in top_idx
        ]

        # Decision path (intrinsic interpretability — glass-box DT)
        node_indicator = STUDENT.decision_path(X_scaled)
        feature_idx = STUDENT.tree_.feature
        threshold_arr = STUDENT.tree_.threshold
        node_ids = node_indicator.indices[
            node_indicator.indptr[0]: node_indicator.indptr[1]
        ]
        path_rules = []
        for node_id in node_ids[:-1]:
            feat_i = feature_idx[node_id]
            thresh = threshold_arr[node_id]
            val = float(X_scaled[0, feat_i])
            direction = "≤" if val <= thresh else ">"
            path_rules.append(
                f"{FEAT_NAMES[feat_i]} {direction} {thresh:.3f}  (actual: {val:.3f})"
            )

    return PredictResponse(
        probability=round(prob, 4),
        label=label,
        threshold_used=OPT_THRESHOLD,
        confidence_band=band,
        n_keystrokes=len(ks),
        n_windows=X_raw.shape[0],
        top_features=top_feats,
        decision_path=path_rules,
        disclaimer=(
            "This result is a statistical screening signal only. "
            "It is not a clinical diagnosis. Please consult a neurologist "
            "for any medical evaluation."
        ),
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8421)
