from sqlmodel import create_engine, SQLModel, Session
import os

class DatabaseManager:
    def __init__(self, db_name="neurotrace.db"):
        self.db_path = os.path.join(os.path.dirname(__file__), db_name)
        self.sqlite_url = f"sqlite:///{self.db_path}"
        self.engine = create_engine(self.sqlite_url, echo=True)

    def create_db_and_tables(self):
        SQLModel.metadata.create_all(self.engine)

    def get_session(self):
        with Session(self.engine) as session:
            yield session

# Singleton instance for the app
db_manager = DatabaseManager()
def get_db_session():
    return db_manager.get_session()
