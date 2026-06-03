from pydantic import BaseModel, EmailStr
from typing import Optional
from models import UserType

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OnboardingRequest(BaseModel):
    name: str
    mobile: str
    user_type: UserType
    website: Optional[str] = None
    linkedin: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    mobile: Optional[str]
    user_type: Optional[UserType]
    website: Optional[str]
    linkedin: Optional[str]
    onboarding_completed: bool
    github_username: Optional[str] = None
    github_avatar_url: Optional[str] = None

    class Config:
        from_attributes = True
