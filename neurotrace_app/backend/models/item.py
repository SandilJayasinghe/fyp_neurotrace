from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime

class BaseItem(SQLModel):
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Item(BaseItem, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

class ItemCreate(BaseItem):
    pass

class ItemUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
