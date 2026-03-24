"""
TeacherEnsemble — standalone inference class for backend deployment.
No training code required. Loads from exported .pkl files.

Usage:
    from teacher_inference import TeacherEnsemble
    model = TeacherEnsemble.load('teacher_ensemble.pkl', 'preprocessing.pkl')

    # From raw keystroke DataFrame (columns: hold_time, flight_time, latency, key)
    result = model.predict_from_keystrokes(df)

    # From already-extracted feature vector (shape: [n_features])
    result = model.predict(feature_vector)
"""

import pickle, numpy as np
from dataclasses import dataclass
from typing import Optional, List


@dataclass
class PredictionResult:
    probability_pd: float       # P(Parkinson's Disease)
    probability_healthy: float  # P(Healthy)
    label: str                  # "Parkinson" or "Healthy"
    label_id: int               # 1 or 0
    confidence: float           # |P(PD) - 0.5| * 2 → [0, 1]
    threshold_used: float
    above_threshold: bool


class TeacherEnsemble:
    """
    Weighted ensemble of base classifiers for Parkinson's detection.
    Expects 80-dimensional scaled feature vectors as input.
    """

    def __init__(self, bundle: dict, prep_bundle: dict):
        self._models = bundle['base_models']        # [(name, model), ...]
        self._imb_models = bundle.get('imb_models', [])
        self._weights = np.array(bundle['weights'])
        self._imb_weights = np.array(bundle.get('imb_weights', []))
        self._threshold = float(bundle['threshold'])
        self._feat_names = bundle['feature_names']
        self._scaler = prep_bundle['scaler']
        self._vt = prep_bundle.get('variance_threshold')
        self._label_map = bundle.get('label_map', {0: 'Healthy', 1: 'Parkinson'})
        self._n_features = bundle['n_features_in']
        # Merge weights
        if len(self._imb_models) > 0 and len(self._imb_weights) > 0:
            self._all_models = self._models + self._imb_models
            self._all_weights = np.concatenate([self._weights, self._imb_weights])
        else:
            self._all_models = self._models
            self._all_weights = self._weights
        self._all_weights = self._all_weights / self._all_weights.sum()

    @classmethod
    def load(cls, bundle_path: str, prep_path: str) -> "TeacherEnsemble":
        with open(bundle_path, 'rb') as f:
            bundle = pickle.load(f)  # nosec: internal model bundle file
        with open(prep_path, 'rb') as f:
            prep = pickle.load(f)  # nosec: internal preprocessing bundle
        return cls(bundle, prep)

    def _raw_proba(self, X: np.ndarray) -> np.ndarray:
        """X: already scaled, shape (n_samples, n_features)."""
        preds = np.column_stack([
            m.predict_proba(X)[:, 1] for _, m in self._all_models
        ])
        return preds @ self._all_weights

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        X: shape (n_samples, n_features) — pre-scaled 80-feature vectors.
        Returns: (n_samples, 2) array of [P(Healthy), P(PD)].
        """
        X = np.atleast_2d(X)
        p = self._raw_proba(X)
        return np.column_stack([1 - p, p])

    def predict(self, X: np.ndarray,
                threshold: Optional[float] = None) -> List[PredictionResult]:
        """
        X: shape (n_samples, n_features) or (n_features,).
        Returns list of PredictionResult.
        """
        X = np.atleast_2d(X)
        thr = threshold if threshold is not None else self._threshold
        p = self._raw_proba(X)
        results = []
        for pi in p:
            label_id = int(pi >= thr)
            results.append(PredictionResult(
                probability_pd=float(pi),
                probability_healthy=float(1 - pi),
                label=self._label_map[label_id],
                label_id=label_id,
                confidence=float(abs(pi - 0.5) * 2),
                threshold_used=thr,
                above_threshold=bool(pi >= thr),
            ))
        return results

    def predict_single(self, feature_vector: np.ndarray,
                       threshold: Optional[float] = None) -> PredictionResult:
        """Convenience: single sample, returns one PredictionResult."""
        return self.predict(feature_vector.reshape(1, -1), threshold)[0]

    @property
    def model_names(self) -> List[str]:
        return [nm for nm, _ in self._all_models]

    @property
    def n_features(self) -> int:
        return self._n_features

    @property
    def threshold(self) -> float:
        return self._threshold

    def __repr__(self):
        return (f"TeacherEnsemble(models={self.model_names}, "
                f"threshold={self._threshold:.4f})")
