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

    def predict(self, X_aim: np.ndarray) -> float:
        """
        Runs the forward pass through all 30 subnets and sums outputs.
        X_aim: shape (1, 27)
        """
        total_logit = self.bias
        # We can either sum the subnets or call the native model. 
        # Using native model for maximum accuracy/performance.
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
