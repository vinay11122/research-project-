from datetime import datetime
from pydantic import BaseModel, ConfigDict

class QueueItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    contact_id: int
    contact_email: str | None = None

    sequence_step_id: int
    step_number: int | None = None
    template_id: int | None = None

    status: str
    scheduled_at: datetime
    queued_at: datetime | None = None
