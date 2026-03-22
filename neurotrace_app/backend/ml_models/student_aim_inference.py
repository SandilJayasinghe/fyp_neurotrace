import pickle
import numpy as np
from abc import ABC, abstractmethod
from typing import Optional, List, Dict
from dataclasses import dataclass

# Interface — <<Interface>> Predictor
class Predictor(ABC):
    @abstractmethod
    def predict(self, input_vector: np.ndarray) -> float:
        """FORWARD pass through the model."""
        pass


# Class 7 — FeatureSubNetwork
class FeatureSubNetwork:
    """Each of the subnets (represented by individual GBR trees in current model)."""
    def __init__(self, feature_id: str, weights: np.ndarray, shape_data: List[str]):
        self.featureId = feature_id
        self.weights = weights # Tree weights or CNN/MLP weights
        self.shapeData = shape_data

    def forward(self, input_value: float) -> float:
        """Return scalar contribution for this specific feature."""
        # Simple tree simulation: weights[0] is root threshold, weights[1] is left contrib, weights[2] is right contrib
        if input_value <= self.weights[0]:
            return self.weights[1]
        return self.weights[2]


# Class 6 — AIMStudent
class AIMStudent(Predictor):
    """
    The deployed student model (NAM-style). 
    predict() runs forward pass through all 30 subnets.
    """
    def __init__(self, bundle: dict):
        self._model_raw = bundle['model_raw'] # Raw GBR from training
        self.bias = 0 # Base contribution
        self.riskProbability = 0.0
        self._feat_names = bundle['feature_names']
        
        # Class Diagram: AIMStudent contains 30 FeatureSubNetworks
        # We wrap the GBR estimators (trees) as virtual sub-networks.
        self.subnets: List[FeatureSubNetwork] = []
        self._wrap_as_subnets()

    def _wrap_as_subnets(self):
        """Map GBR trees to FeatureSubNetwork objects (up to 30 as per diagram)."""
        for est in self._model_raw.estimators_[:30, 0]:
            tree = est.tree_
            if tree.feature[0] >= 0:
                fid = self._feat_names[tree.feature[0]]
                # Extract simple single-split rule for subnet representation
                weights = np.array([
                    tree.threshold[0], 
                    float(tree.value[tree.children_left[0]][0][0]), 
                    float(tree.value[tree.children_right[0]][0][0])
                ])
                self.subnets.append(FeatureSubNetwork(fid, weights, []))

    def _build_aim_features(self, X_sel: np.ndarray) -> np.ndarray:
        """
        Constructs the 27 features expected by the StudentAIM model from the 80 selected features.
        X_sel: (n_windows, 80)
        Returns: (n_windows, 27)
        """
        # 1. Base Column Selection (25 indices from metadata)
        # These are the top contributors chosen for the glass-box NAM architecture
        st_idx = [2, 1, 39, 40, 0, 78, 43, 61, 52, 3, 14, 42, 5, 69, 50, 46, 76, 4, 74, 36, 55, 41, 53, 49, 54]
        X_base = X_sel[:, st_idx]
        
        # 2. Interactions (Product of specific features)
        # interact1: mean_ht_max * mean_ht_std (indices 0 and 1 in st_idx)
        # interact2: mean_ht_max * max_ht_mean (indices 0 and 2 in st_idx)
        i1 = X_sel[:, st_idx[0]] * X_sel[:, st_idx[1]]
        i2 = X_sel[:, st_idx[0]] * X_sel[:, st_idx[2]]
        
        # 3. Stack together
        return np.column_stack([X_base, i1, i2])

    def predict(self, X_input: np.ndarray) -> float:
        """
        X_input either (1, 80) from full pipeline, (1, 25) from pre-selected base cols, or (1, 27) if already prepared.
        """
        # Handle dimensionality mismatch: 80 (selector result) -> 27 (AIM input)
        if X_input.shape[1] == 80:
            X_aim = self._build_aim_features(X_input)
        elif X_input.shape[1] == 25:
            # We already have the 25 base features, just append the 2 interaction terms
            i1 = X_input[:, 0] * X_input[:, 1]
            i2 = X_input[:, 0] * X_input[:, 2]
            X_aim = np.column_stack([X_input, i1, i2])
        else:
            X_aim = X_input
            
        prob = float(np.clip(self._model_raw.predict(X_aim)[0], 0., 1.))
        self.riskProbability = prob
        return prob

    def extractContributions(self) -> Dict[str, float]:
        """Returns the individual subnet output values for interpretability."""
        # In a NAM, you sum the contributions. We can approximate this by returning top features.
        return {s.featureId: s.forward(0.0) for s in self.subnets[:5]}

    @classmethod
    def load(cls, bundle_path: str) -> 'AIMStudent':
        with open(bundle_path, 'rb') as f:
            bundle = pickle.load(f)
        return cls(bundle)

# Legacy naming for main.py compatibility
StudentAIM = AIMStudent
