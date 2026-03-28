from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import Optional


# ========== Base Class ==========
class ContactBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: str
    company_name: Optional[str] = None
    title: Optional[str] = None
    email: EmailStr
    email_confidence: Optional[str] = None
    linkedin_url: Optional[str] = None
    external_id: Optional[str] = None
    category: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    is_active: Optional[bool] = True


# ========== Create ==========
class ContactCreate(ContactBase):
    pass


# ========== Update ==========
class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[EmailStr] = None
    email_confidence: Optional[str] = None
    linkedin_url: Optional[str] = None
    external_id: Optional[str] = None
    category: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    is_active: Optional[bool] = None


# ========== Read Model ==========
class ContactRead(ContactBase):
    id: int
    external_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

