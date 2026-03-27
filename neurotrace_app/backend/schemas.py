from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime

# Class 1 — KeystrokeEvent
class KeystrokeEvent(BaseModel):
    timeStamp: Optional[int] = Field(None, description="Timestamp in ms since epoch")
    keyId: str = Field(..., description="Raw key ID / Character")
    type: str = Field(default="Unknown", description="Hand classification (L/R/Unknown)")
    username: Optional[str] = None
    password: Optional[str] = None
    # Biometric attributes from legacy implementation (required for functional parity)
    hold_time: float = Field(..., ge=0, le=10000)
    flight_time: Optional[float] = Field(None, ge=-5000, le=20000)
    latency: Optional[float] = Field(None, ge=0, le=20000)

# Class 2 — Session (Request wrapper)
class Session(BaseModel):
    sessionId: str
    startTime: int
    endTime: Optional[int] = None
    riskScore: float = 0.0
    keystrokeEvents: List[KeystrokeEvent] = Field(..., min_items=100)
    
    # Contextual metadata
    userId: Optional[str] = None
    historyProbs: List[float] = Field(default_factory=list, description="Last N risk probabilities for longitudinal analysis")
    keyboard_polling_hz: Optional[int] = 125
    keyboard_name: str = "Unknown"

    def calculateDuration(self) -> int:
        if self.endTime and self.startTime:
            return self.endTime - self.startTime
        return 0

# Class 4 — FeatureExtractor (Schema version)
class FeatureDetail(BaseModel):
    name: str
    raw_name: str
    importance: float
    pct: float
    value: float
    raw_value: float = 0.0
    direction: str

# Class 8 — DiagnosticReport (Response wrapper)
class DiagnosticReport(BaseModel):
    sessionId: str = Field(default="N/A", description="Unique session identifier")
    userId: Optional[str] = None
    riskLabel: float = Field(..., description="The predicted risk probability")
    timestamp: int = Field(default_factory=lambda: int(datetime.utcnow().timestamp() * 1000))
    topFactors: List[str] = Field(..., description="Top feature names contributing to result")
    
    # Technique 11 — Persistence vectors
    rawVector: List[float] = Field(default_factory=list)
    scaledVector: List[float] = Field(default_factory=list)
    
    # Technique 8 — Confidence Weighting & OOD
    windowConfidence: float = 0.0
    oodGrade: str = "Unknown"
    
    # Technique 6 — Longitudinal Score (Long-term stabilization)
    longitudinal_mean: Optional[float] = None
    delta_from_baseline: Optional[float] = None
    trend_slope: Optional[float] = None
    
    # New correction fields for Step 9
    raw_probability: float = 0.0
    age_correction: dict = Field(default_factory=dict)
    window_confidence: float = 0.0
    personal_baseline: dict = Field(default_factory=dict)
    ood_info: dict = Field(default_factory=dict)

    # Extended attributes for frontend rich UI compatibility
    label: int
    label_text: str
    threshold_used: float
    confidence: float
    confidence_band: str
    n_keystrokes: int
    n_windows: int
    all_features: List[FeatureDetail]
    top5_features: Optional[List[FeatureDetail]] = None
    session_quality: Optional[dict] = None
    keyboard_info: Optional[dict] = None
    verdict: str
    aim_auc: float
    disclaimer: str

    def exportPDF(self) -> None:
        """Export the clinical diagnostic report as a PDF."""
        # Logic for Class 8 PDF export (usually handled by a report service)
        pass

# Legacy compatibility stubs for main.py (to avoid breaking functionality)
class PredictRequest(Session):
    @property
    def keystrokes(self): return self.keystrokeEvents
    @property
    def session_id(self): return self.sessionId

class PredictResponse(DiagnosticReport):
    @property
    def probability(self): return self.riskLabel
