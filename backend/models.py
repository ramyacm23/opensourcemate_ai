import enum
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime
from sqlalchemy.sql import func
from database import Base

class UserType(str, enum.Enum):
    freelancer = "Freelancer"
    student = "Student"
    enterprise = "Enterprise"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=True)

    # onboarding fields
    name = Column(String, nullable=True)
    mobile = Column(String, nullable=True)
    user_type = Column(Enum(UserType), nullable=True)
    website = Column(String, nullable=True)
    linkedin = Column(String, nullable=True)
    onboarding_completed = Column(Boolean, default=False)

    # GitHub OAuth fields
    github_id = Column(Integer, unique=True, index=True, nullable=True)
    github_username = Column(String, nullable=True)
    github_avatar_url = Column(String, nullable=True)
    github_access_token = Column(String, nullable=True)
    github_connected_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
