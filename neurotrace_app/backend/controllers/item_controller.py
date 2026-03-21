from sqlmodel import Session, select
from models.item import Item, ItemCreate, ItemUpdate
from typing import List, Optional

class ItemController:
    def __init__(self, session: Session):
        self.session = session

    def create_item(self, item_data: ItemCreate) -> Item:
        db_item = Item.from_orm(item_data)
        self.session.add(db_item)
        self.session.commit()
        self.session.refresh(db_item)
        return db_item

    def get_items(self) -> List[Item]:
        statement = select(Item)
        return self.session.exec(statement).all()

    def get_item_by_id(self, item_id: int) -> Optional[Item]:
        return self.session.get(Item, item_id)

    def update_item(self, item_id: int, item_data: ItemUpdate) -> Optional[Item]:
        db_item = self.get_item_by_id(item_id)
        if not db_item:
            return None
        
        # Update fields dynamically
        update_data = item_data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_item, key, value)
            
        self.session.add(db_item)
        self.session.commit()
        self.session.refresh(db_item)
        return db_item

    def delete_item(self, item_id: int) -> bool:
        db_item = self.get_item_by_id(item_id)
        if not db_item:
            return False
        self.session.delete(db_item)
        self.session.commit()
        return True
