"""
StudentAIM — standalone inference class for the AIM (GBR) student model.
No training code required. Loads from exported .pkl files.

Usage:
    from student_aim_inference import StudentAIM
    model = StudentAIM.load('student_aim.pkl', 'preprocessing.pkl')

    # From raw keystroke DataFrame (columns: hold_time, flight_time, latency, key)
    result = model.predict_from_keystrokes(df)

    # From already-extracted feature vector (shape: [n_features])
    result = model.predict(feature_vector)
"""

import pickle
import numpy as np
from dataclasses import dataclass
from typing import Optional, List


@dataclass
class AIMPredictionResult:
    probability_pd: float
    probability_healthy: float
    label: str
    label_id: int
    confidence: float
    threshold_used: float
    above_threshold: bool
    top_features: list       # [(feature_name, importance), ...]
    scorecard_summary: list  # root split per tree [(feature, threshold, direction), ...]


class StudentAIM:
    """
    AIM (Additive Interpretable Model) student — GradientBoostingRegressor
    distilled from the teacher ensemble.
    Intrinsically interpretable: every prediction is a sum of shallow tree outputs.
    """

    def __init__(self, bundle: dict, prep_bundle: dict):
        self._model       = bundle['model']           # _ProbWrap(GBR)
        self._model_raw   = bundle['model_raw']       # raw GBR
        self._threshold   = float(bundle['threshold'])
        self._feat_names  = bundle['feature_names']
        self._st_idx      = np.array(bundle['st_idx'])
        self._top5_feats  = bundle['top5_features']
        self._fi          = np.array(bundle['feature_importances'])
        self._scaler      = prep_bundle['scaler']
        self._vt          = prep_bundle.get('variance_threshold')
        self._label_map   = bundle.get('label_map', {0: 'Healthy', 1: 'Parkinson'})
        self._n_feat      = bundle['n_features_in']
        self._input_builder = bundle['input_builder']

    @classmethod
    def load(cls, bundle_path: str, prep_path: str) -> 'StudentAIM':
        with open(bundle_path, 'rb') as f:
            bundle = pickle.load(f)
        with open(prep_path, 'rb') as f:
            prep = pickle.load(f)
        assert bundle['model_type'] == 'student_aim', (
            f"Wrong bundle type: {bundle['model_type']}")
        return cls(bundle, prep)

    def _build_aim_input(self, X_scaled_sel: np.ndarray) -> np.ndarray:
        """
        Build the 27-dimensional AIM input from the 80-feature scaled vector.
        X_scaled_sel: shape (n_samples, 80)
        Returns: shape (n_samples, 27)
        """
        base = X_scaled_sel[:, self._st_idx]           # (n, 25)
        ix0, ix1, ix2 = 0, 1, 2
        inter1 = (base[:, ix0] * base[:, ix1]).reshape(-1, 1)
        inter2 = (base[:, ix0] * base[:, ix2]).reshape(-1, 1)
        return np.hstack([base, inter1, inter2])       # (n, 27)

    def predict(self, X_scaled: np.ndarray) -> AIMPredictionResult:
        """
        X_scaled: 1-D or 2-D array, shape (80,) or (1, 80).
        The vector must already be RobustScaler-scaled and feature-selected (80 features).
        """
        if X_scaled.ndim == 1:
            X_scaled = X_scaled.reshape(1, -1)
        X_aim = self._build_aim_input(X_scaled)
        prob  = float(np.clip(self._model_raw.predict(X_aim)[0], 0., 1.))
        label_id = int(prob >= self._threshold)
        conf  = abs(prob - 0.5) * 2.0

        scorecard = []
        for est in self._model_raw.estimators_[:, 0]:
            tree = est.tree_
            if tree.feature[0] >= 0 and tree.feature[0] < len(self._feat_names):
                val = float(X_aim[0, tree.feature[0]])
                direction = '<= ' + f"{tree.threshold[0]:.4f}" if val <= tree.threshold[0] else '> ' + f"{tree.threshold[0]:.4f}"
                scorecard.append(dict(
                    feature=self._feat_names[tree.feature[0]],
                    value=round(val, 4),
                    direction=direction,
                ))

        return AIMPredictionResult(
            probability_pd=round(prob, 4),
            probability_healthy=round(1. - prob, 4),
            label=self._label_map[label_id],
            label_id=label_id,
            confidence=round(conf, 4),
            threshold_used=self._threshold,
            above_threshold=bool(prob >= self._threshold),
            top_features=self._top5_feats,
            scorecard_summary=scorecard[:10],
        )

    def explain(self) -> dict:
        """Return a human-readable summary of all model rules."""
        rules = []
        for i, est in enumerate(self._model_raw.estimators_[:, 0]):
            tree = est.tree_
            fn = (self._feat_names[tree.feature[0]]
                  if tree.feature[0] < len(self._feat_names) else f'f{tree.feature[0]}')
            lv = float(tree.value[tree.children_left[0]][0][0])
            rv = float(tree.value[tree.children_right[0]][0][0])
            rules.append(
                f"Tree {i+1:>3}: IF {fn} <= {tree.threshold[0]:.4f} "
                f"THEN add {lv:+.4f} ELSE add {rv:+.4f}"
            )
        return dict(
            model_type='AIM — Additive Interpretable Model',
            n_trees=self._model_raw.n_estimators,
            max_depth=self._model_raw.max_depth,
            threshold=self._threshold,
            top5_features=self._top5_feats,
            rules=rules,
            note=('Final score = sum of all tree outputs. '
                  'Apply sigmoid if needed. '
                  'Threshold applied to raw GBR output ∈ [0,1].'),
        )
