"""Auth schemas for request/response models."""
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.enums import UserRole


class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    # NOTE: role is intentionally omitted — public registration always creates CUSTOMER accounts.
    # ADMIN and DELIVERY_AGENT accounts must be created through privileged back-office operations.


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str]
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True
