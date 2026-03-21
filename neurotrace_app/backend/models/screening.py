from sqlmodel import SQLModel, Field, Column, JSON
from typing import Optional, List, Dict
from datetime import datetime
import uuid

class ScreeningTest(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: str = Field(index=True)
    user_id: Optional[uuid.UUID] = Field(default=None, index=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Biometrics summary
    accuracy: float
    wpm: float
    n_keystrokes: int
    n_windows: int
    
    # AI Results
    probability: float
    label: int
    label_text: str
    confidence_band: str
    
    # Expert interpretability (stored as JSON)
    top_features: List[Dict] = Field(sa_column=Column(JSON))
    decision_path: List[str] = Field(sa_column=Column(JSON))
    scorecard: List[float] = Field(sa_column=Column(JSON))
    
    # Storage reference
    raw_data_file: str # Relative path in backend/data/sessions/
