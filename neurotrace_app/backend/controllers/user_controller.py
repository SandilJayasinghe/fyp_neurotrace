from sqlmodel import Session, select
from models.user import User, UserCreate, UserLogin, UserResetPassword, UserResponse, Token
from utils.auth import get_password_hash, verify_password, create_access_token
from typing import Optional

class UserController:
    def __init__(self, session: Session):
        self.session = session

    def register_user(self, user_data: UserCreate) -> Optional[User]:
        # Check if user already exists
        existing_user = self.get_user_by_email(user_data.email)
        if existing_user:
            return None
        
        hashed_password = get_password_hash(user_data.password)
        db_user = User(
            name=user_data.name,
            email=user_data.email,
            dob=user_data.dob,
            age=user_data.age,
            gender=user_data.gender,
            country=user_data.country,
            hashed_password=hashed_password
        )
        self.session.add(db_user)
        self.session.commit()
        self.session.refresh(db_user)
        return db_user

    def authenticate_user(self, credentials: UserLogin) -> Optional[Token]:
        user = self.get_user_by_email(credentials.email)
        if not user or not verify_password(credentials.password, user.hashed_password):
            return None
        
        access_token = create_access_token(data={"sub": user.email, "id": str(user.id)})
        return Token(access_token=access_token, token_type="bearer")

    def reset_password(self, payload: UserResetPassword) -> bool:
        user = self.get_user_by_email(payload.email)
        if not user:
            return False
        
        user.hashed_password = get_password_hash(payload.new_password)
        self.session.add(user)
        self.session.commit()
        return True

    def get_user_by_email(self, email: str) -> Optional[User]:
        statement = select(User).where(User.email == email)
        return self.session.exec(statement).first()
