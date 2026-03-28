from datetime import datetime, time # Import time for sending_window_start/end
from typing import Optional
from pydantic import BaseModel

class CampaignBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "draft"
    start_at: Optional[datetime] = None # Move from CampaignUpdate to CampaignBase

    # New scheduling and throttling fields
    daily_send_limit: Optional[int] = None
    sending_window_start: Optional[time] = None # Use Pydantic's time type
    sending_window_end: Optional[time] = None # Use Pydantic's time type
    sending_days: Optional[str] = "mon,tue,wed,thu,fri" # Default to weekdays

class CampaignCreate(CampaignBase):
    pass

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_at: Optional[datetime] = None

    # New scheduling and throttling fields (allow partial updates)
    daily_send_limit: Optional[int] = None
    sending_window_start: Optional[time] = None
    sending_window_end: Optional[time] = None
    sending_days: Optional[str] = None # No default for update, so it can be unset
    
class CampaignRead(CampaignBase):
    id: int
    created_at: datetime
    updated_at: datetime
    limit_reset_at: Optional[datetime] = None

    class Config:
        from_attributes = True
