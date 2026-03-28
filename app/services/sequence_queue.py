from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models.contact import Contact
from app.models.campaign import Campaign
from app.models.sequence_step import SequenceStep
from app.models.sequence_queue import SequenceQueue


def queue_first_step_for_contact(
    db: Session,
    *,
    contact_id: int,
    campaign_id: int,
    sequence_id: int,
    start_time: datetime | None = None,
) -> bool:
    """
    Queue the FIRST step of a sequence for a contact.
    """

    # 1. Get the first step
    first_step = (
        db.query(SequenceStep)
        .filter(SequenceStep.sequence_id == sequence_id)
        .order_by(SequenceStep.step_number.asc())
        .first()
    )
    
    if not first_step:
        return False

    # 2. Check if already queued or processed
    existing_job = (
        db.query(SequenceQueue)
        .filter(
            SequenceQueue.campaign_id == campaign_id,
            SequenceQueue.contact_id == contact_id
        )
        .first()
    )
    if existing_job:
        return False

    # 3. Default time = now (UTC aware)
    if start_time is None:
        start_time = datetime.now(timezone.utc)
    elif start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)

    # 4. Calculate schedule time
    scheduled_at = start_time + timedelta(days=first_step.delay_days or 0)

    job = SequenceQueue(
        contact_id=contact_id,
        campaign_id=campaign_id,
        sequence_step_id=first_step.id,
        scheduled_at=scheduled_at,
        status="pending",
        queued_at=datetime.now(timezone.utc)
    )

    db.add(job)
    return True

def queue_sequence_for_contact(*args, **kwargs):
    """Alias for backward compatibility."""
    return queue_first_step_for_contact(*args, **kwargs)