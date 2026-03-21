from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from db.database import db_manager
from controllers.item_controller import ItemController
from models.item import Item, ItemCreate, ItemUpdate
from typing import List

router = APIRouter(prefix="/items", tags=["Items"])

def get_session():
    with Session(db_manager.engine) as session:
        yield session

@router.post("/", response_model=Item)
def create_item(item: ItemCreate, session: Session = Depends(get_session)):
    controller = ItemController(session)
    return controller.create_item(item)

@router.get("/", response_model=List[Item])
def get_items(session: Session = Depends(get_session)):
    controller = ItemController(session)
    return controller.get_items()

@router.get("/{item_id}", response_model=Item)
def get_item(item_id: int, session: Session = Depends(get_session)):
    controller = ItemController(session)
    item = controller.get_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.patch("/{item_id}", response_model=Item)
def update_item(item_id: int, item_update: ItemUpdate, session: Session = Depends(get_session)):
    controller = ItemController(session)
    updated_item = controller.update_item(item_id, item_update)
    if not updated_item:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated_item

@router.delete("/{item_id}")
def delete_item(item_id: int, session: Session = Depends(get_session)):
    controller = ItemController(session)
    if not controller.delete_item(item_id):
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}
