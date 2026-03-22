from sqlmodel import create_engine, SQLModel, Session, text, select
import os
import json
from datetime import datetime
from sqlalchemy.exc import OperationalError

class DatabaseManager:
    def __init__(self, db_name="neurotrace.db"):
        self.db_path = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", db_name))
        self.sqlite_url = f"sqlite:///{self.db_path}"
        self.engine = create_engine(self.sqlite_url, echo=False)

    def create_db_and_tables(self):
        # 1. Ensure SQLModel tables are present
        SQLModel.metadata.create_all(self.engine)
        
        # 2. Apply manual migrations for Step 1
        with self.engine.begin() as conn:
            # Users table enhancements
            cols_users = [
                ("age", "INTEGER DEFAULT 0"),
                ("full_name", "TEXT DEFAULT ''"),
            ]
            for col, attr in cols_users:
                try:
                    conn.execute(text(f"ALTER TABLE user ADD COLUMN {col} {attr};"))
                except OperationalError: pass # Already exists

            # Sessions/Item table enhancements (The app uses 'item' or 'screeningtest' tables)
            # Based on the Class Diagram, we'll ensure 'sessions' or its substitute exists.
            # If the user specifically asks for 'sessions', we'll make sure it's there.
            cols_sessions = [
                ("raw_feature_vector", "TEXT DEFAULT NULL"),
                ("scaled_feature_vector", "TEXT DEFAULT NULL"),
                ("n_windows", "INTEGER DEFAULT 0"),
                ("ood_grade", "TEXT DEFAULT NULL"),
                ("age_at_session", "INTEGER DEFAULT 0"),
                ("keyboard_polling", "INTEGER DEFAULT 125"),
                ("raw_probability", "REAL DEFAULT 0.0"),
            ]
            # Try to alter 'screeningtest' as it seems to be the one storing test results
            for col, attr in cols_sessions:
                try:
                    conn.execute(text(f"ALTER TABLE screeningtest ADD COLUMN {col} {attr};"))
                except OperationalError: pass

    def get_session(self):
        with Session(self.engine) as session:
            yield session

# Singleton instance for the app
db_manager = DatabaseManager()

# --- BACKEND FUNCTIONS (Requested by Step 1) ---

def create_user(email: str, password_hash: str, name: str, age: int, full_name: str):
    from models.user import User
    with Session(db_manager.engine) as session:
        user = User(
            email=email,
            hashed_password=password_hash,
            name=name,
            age=age,
            # We'll map full_name if available in User model update next
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

def save_session(user_id, session_id, probability, raw_probability, label, n_keystrokes, n_windows,
                 raw_feature_vector=None, scaled_feature_vector=None, 
                 ood_grade="In-Distribution", age_at_session=0, keyboard_polling=125):
    from models.screening import ScreeningTest
    with Session(db_manager.engine) as session:
        test = ScreeningTest(
            user_id=user_id,
            session_id=session_id,
            probability=probability,
            raw_probability=raw_probability,
            label=label,
            label_text="Elevated" if label == 1 else "Healthy",
            confidence_band="N/A", # Will be updated if needed
            n_keystrokes=n_keystrokes,
            n_windows=n_windows,
            accuracy=0.0, # Placeholder
            wpm=0.0,      # Placeholder
            top_features="[]", 
            decision_path="[]",
            scorecard="[]",
            raw_data_file="",
            # New fields
            raw_feature_vector=json.dumps(raw_feature_vector) if raw_feature_vector else None,
            scaled_feature_vector=json.dumps(scaled_feature_vector) if scaled_feature_vector else None,
            ood_grade=ood_grade,
            age_at_session=age_at_session,
            keyboard_polling=keyboard_polling
        )
        session.add(test)
        session.commit()
        return test

def get_sessions_for_user(user_id: str):
    from models.screening import ScreeningTest
    with Session(db_manager.engine) as session:
        stmt = select(ScreeningTest).where(ScreeningTest.user_id == user_id).order_by(ScreeningTest.timestamp.desc())
        results = session.exec(stmt).all()
        return [r.dict() for r in results]

def get_baseline_sessions(user_id: str, limit: int = 5):
    """Returns the first N sessions for this user, ordered by recorded_at ASC."""
    from models.screening import ScreeningTest
    with Session(db_manager.engine) as session:
        # Use timestamp as recorded_at equivalent
        stmt = select(ScreeningTest).where(ScreeningTest.user_id == user_id).order_by(ScreeningTest.timestamp.asc()).limit(limit)
        results = session.exec(stmt).all()
        return [r.dict() for r in results]

def get_db_session():
    return db_manager.get_session()
