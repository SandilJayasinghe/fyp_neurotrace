from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import date
import uuid

class UserBase(SQLModel):
    name: str = Field(index=True)
    email: str = Field(unique=True, index=True)
    dob: Optional[date] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    country: Optional[str] = None

class User(UserBase, table=True):
    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str

class UserCreate(UserBase):
    password: str

class UserLogin(SQLModel):
    email: str
    password: str

class UserResetPassword(SQLModel):
    email: str
    new_password: str

class UserResponse(UserBase):
    id: uuid.UUID

class Token(SQLModel):
    access_token: str
    token_type: str

class TokenData(SQLModel):
    email: Optional[str] = None
