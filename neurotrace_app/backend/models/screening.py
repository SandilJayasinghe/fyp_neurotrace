from sqlmodel import SQLModel, Field, Column, JSON
from typing import Optional, List, Dict
from datetime import datetime
import uuid

class ScreeningTest(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: str = Field(index=True)
    user_id: str = Field(index=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Biometrics summary
    accuracy: float
    wpm: float
    n_keystrokes: int
    n_windows: int
    
    # Technique 4/7/9 (Scoring)
    probability: float = Field(default=0.5)
    raw_probability: float = Field(default=0.0)
    label: int = Field(default=0)
    label_text: str = Field(default="Healthy")
    confidence_band: str = Field(default="Normal")
    
    # Technique 11 — Persistence vectors
    raw_feature_vector: Optional[str] = Field(default=None)
    scaled_feature_vector: Optional[str] = Field(default=None)
    
    # Strategy 10 — Detailed Diagnostics
    top_features: str = Field(default="[]") 
    decision_path: str = Field(default="[]")
    scorecard: str = Field(default="[]")
    
    # Technique 8 — Confidence Weighting & OOD
    ood_grade: str = Field(default="In-Distribution")
    
    # Personalization / Hardware
    age_at_session: int = Field(default=0)
    keyboard_polling: int = Field(default=125)
    
    # Storage reference
    raw_data_file: str 
