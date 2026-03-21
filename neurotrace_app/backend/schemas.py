from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any

class KeystrokeRecord(BaseModel):
    key: str
    hold_time: float = Field(..., ge=0, le=10000)
    flight_time: Optional[float] = Field(None, ge=-5000, le=20000)
    latency: Optional[float] = Field(None, ge=0, le=20000)

class PredictRequest(BaseModel):
    keystrokes: List[KeystrokeRecord]
    session_id: Optional[str] = None
    keyboard_polling_hz: int = 125
    keyboard_name: str = "Unknown"
    quantisation_warning: bool = True
    detection_method: str = "assumed"
    detection_confidence: str = "Low"

    @validator("keystrokes")
    def validate_min_length(cls, v):
        if len(v) < 150:
            raise ValueError("Insufficient data. Minimum 150 keystrokes required.")
        return v

class FeatureDetail(BaseModel):
    name: str
    raw_name: str
    importance: float
    pct: float
    value: float
    direction: str

class ScorecardRule(BaseModel):
    tree_index: int
    feature: str
    threshold: float
    user_value: float
    fired_left: bool
    contribution: float

class PredictResponse(BaseModel):
    probability: float
    label: int
    label_text: str
    threshold_used: float
    confidence: float
    confidence_band: str
    n_keystrokes: int
    n_windows: int
    left_count: int
    right_count: int
    lr_ratio: float
    top5_features: List[FeatureDetail]
    all_features: List[FeatureDetail]
    scorecard_rules: List[ScorecardRule]
    session_quality: Dict[str, Any]
    signal_cleaning: Dict[str, Any]
    keyboard_info: Dict[str, Any]
    unreliable_features: List[str]
    reliability_note: str
    verdict: str
    debug_logs: Optional[List[str]] = None
    aim_auc: float
    aim_sensitivity: float
    aim_specificity: float
    disclaimer: str
