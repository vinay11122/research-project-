from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.core.auth import encrypt_data, decrypt_data

router = APIRouter(prefix="/settings", tags=["Settings"])

class UserSettings(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = Field(None, description="Provide plaintext password to update. Will be returned as null.")
    from_name: Optional[str] = None
    from_email: Optional[EmailStr] = None
    reply_to_email: Optional[EmailStr] = None
    tracking_domain: Optional[str] = None
    unsubscribe_footer_text: Optional[str] = None

    class Config:
        from_attributes = True

class UserSettingsResponse(UserSettings):
    smtp_password: Optional[str] = Field(None, description="Password is write-only and not returned.")


@router.get("", response_model=UserSettingsResponse)
def get_user_settings(current_user: User = Depends(get_current_user)):
    """
    Retrieve the current user's settings.
    """
    settings = UserSettingsResponse.model_validate(current_user)
    # The password is not returned, so no need to decrypt here for the response.
    return settings

@router.put("", response_model=UserSettingsResponse)
def update_user_settings(
    payload: UserSettings, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Update the current user's settings.
    """
    update_data = payload.model_dump(exclude_unset=True)

    # Encrypt the password if it's provided
    if 'smtp_password' in update_data and update_data['smtp_password']:
        current_user.smtp_password_encrypted = encrypt_data(update_data['smtp_password'])
    
    # Update other fields
    for field, value in update_data.items():
        if field != 'smtp_password':
            setattr(current_user, field, value)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return UserSettingsResponse.model_validate(current_user)
