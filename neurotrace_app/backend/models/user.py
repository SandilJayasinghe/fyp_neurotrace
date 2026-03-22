from sqlmodel import SQLModel, Field, Relationship
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import uuid

# Class 3 — User (General Usage Database)
class UserBase(SQLModel):
    name: str = Field(index=True)
    email: str = Field(unique=True, index=True)
    username: str = Field(unique=True, index=True)
    dob: Optional[date] = None
    age: Optional[int] = Field(description="Contextual age for result normalization")
    full_name: str = Field(default="", description="Full legal name")
    gender: Optional[str] = None
    country: Optional[str] = None

class Profile(BaseModel):
    """Represent the user's professional/clinical profile."""
    uid: uuid.UUID
    name: str
    age: int
    has_sessions: bool

class User(UserBase, table=True):
    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    
    # Class Diagram: Has 1..* Sessions (Conceptual mapping)
    # Stored locally or in a remote DB. Linking here logically.
    
    def getProfile(self) -> 'Profile':
        from pydantic import BaseModel # Late import to avoid cycles
        class ProfileInternal(BaseModel):
            uid: uuid.UUID
            name: str
            age: int
            has_sessions: bool = True
        return ProfileInternal(uid=self.id, name=self.name, age=self.age or 0)

# Create classes matching diagram naming
class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(UserBase):
    id: uuid.UUID

# Classes for Authentication Logic (Internal support)
class UserResetPassword(SQLModel):
    email: str
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str
