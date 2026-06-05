from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from models import UserType

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterStartRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterVerifyRequest(BaseModel):
    email: EmailStr
    otp: str

class ForgotPasswordStartRequest(BaseModel):
    email: EmailStr

class ForgotPasswordVerifyRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

class OkResponse(BaseModel):
    ok: bool = True
    message: Optional[str] = None

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
    bio: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    github_username: Optional[str] = None
    github_avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    user_type: Optional[UserType] = None
    website: Optional[str] = None
    linkedin: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None


class AnalyzeRequest(BaseModel):
    issue_url: Optional[str] = None
    repo_url: Optional[str] = None
    error_log: Optional[str] = None
    merge_conflict: Optional[str] = None


class AnalysisResponse(BaseModel):
    id: int
    user_id: int
    issue_url: Optional[str] = None
    repo_url: Optional[str] = None
    error_log: Optional[str] = None
    merge_conflict: Optional[str] = None
    issue_title: Optional[str] = None
    issue_body: Optional[str] = None
    repo_name: Optional[str] = None
    repo_language: Optional[str] = None
    summary: Optional[str] = None
    difficulty: Optional[str] = None
    files_involved: Optional[str] = None
    tech_stack: Optional[str] = None
    root_cause: Optional[str] = None
    solution_steps: Optional[str] = None
    git_commands: Optional[str] = None
    pr_title: Optional[str] = None
    pr_description: Optional[str] = None
    code_suggestions: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    model_used: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisListItem(BaseModel):
    id: int
    issue_url: Optional[str]
    repo_name: Optional[str]
    summary: Optional[str]
    difficulty: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatMessage(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    user_message: ChatMessage
    assistant_message: ChatMessage


class ContributionRunResponse(BaseModel):
    id: int
    analysis_id: int
    status: str
    fork_repo: Optional[str] = None
    branch_name: Optional[str] = None
    pr_url: Optional[str] = None
    pr_number: Optional[int] = None
    pr_state: Optional[str] = None
    pr_merged_at: Optional[datetime] = None
    pr_checked_at: Optional[datetime] = None
    files_changed: int = 0
    files_skipped: int = 0
    steps: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
