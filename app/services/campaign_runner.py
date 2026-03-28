# app/services/campaign_runner.py

from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import (
    Campaign,
    CampaignContact,
    Contact,
    Sequence,
    SequenceStep,
    Email,
    SequenceQueue,
)
# from app.workers.email_sender import send_sequence_email # No longer needed here as we are queuing to DB


def _get_sequence_for_campaign(db: Session, campaign: Campaign) -> Optional[Sequence]:
    """
    Get the main sequence for a campaign.
    Many systems: Campaign has sequence_id or 1-to-1.
    We try both patterns defensively.
    """
    seq = None

    seq_id = getattr(campaign, "sequence_id", None)
    if seq_id:
        seq = db.query(Sequence).get(seq_id)
    else:
        # Fallback: first sequence linked to campaign
        seq = (
            db.query(Sequence)
            .filter(Sequence.campaign_id == campaign.id)
            .order_by(Sequence.id.asc())
            .first()
        )

    return seq


def _get_ordered_steps(db: Session, sequence: Sequence) -> List[SequenceStep]:
    """
    Return sequence steps sorted by step_order if present, else by id.
    """
    q = db.query(SequenceStep).filter(SequenceStep.sequence_id == sequence.id)

    if hasattr(SequenceStep, "step_order"):
        q = q.order_by(SequenceStep.step_order.asc())
    elif hasattr(SequenceStep, "position"):
        q = q.order_by(SequenceStep.position.asc())
    else:
        q = q.order_by(SequenceStep.id.asc())

    return q.all()


def _find_next_step_for_contact(
    db: Session,
    contact: Contact,
    campaign: Campaign,
    steps: List[SequenceStep],
) -> Optional[SequenceStep]:
    """
    Enterprise-style behaviour:

    - If contact has no emails in this campaign → first step.
    - Otherwise, see which step was last sent.
    - Then apply delay_days before scheduling the next step.
    """
    last_email = (
        db.query(Email)
        .filter(
            Email.contact_id == contact.id,
            Email.campaign_id == campaign.id,
        )
        .order_by(Email.sent_at.desc())
        .first()
    )

    if not last_email:
        # First touch
        return steps[0] if steps else None

    # Find which step that email belonged to
    last_step = None
    if last_email.sequence_step_id:
        for s in steps:
            if s.id == last_email.sequence_step_id:
                last_step = s
                break

    if not last_step:
        # Can't map → be safe and stop (or restart at step 1 if you want)
        return None

    # Determine index in steps
    try:
        idx = next(i for i, s in enumerate(steps) if s.id == last_step.id)
    except StopIteration:
        return None

    # If that was the last step → sequence complete
    if idx == len(steps) - 1:
        return None

    # Otherwise go to next step, but check delay
    next_step = steps[idx + 1]

    delay_days = getattr(next_step, "delay_days", None) or 0
    if delay_days <= 0:
        return next_step

    # ensure enough days have passed
    if last_email.sent_at and last_email.sent_at + timedelta(days=delay_days) <= datetime.utcnow():
        return next_step

    # Not yet time
    return None


def _compute_schedule_time(
    base_time: datetime,
    campaign: Campaign,
    offset_index: int,
) -> datetime:
    """
    Enterprise-style scheduling:

    - Staggers sends by a few seconds per contact (offset_index).
    - Can enforce a sending window if fields exist on Campaign.
    """
    send_at = base_time + timedelta(seconds=offset_index * 5)

    # Optional: sending window support (if model has fields)
    window_start = getattr(campaign, "send_window_start", None)  # e.g. "09:00"
    window_end = getattr(campaign, "send_window_end", None)      # e.g. "18:00"

    if window_start and window_end:
        try:
            h1, m1 = map(int, window_start.split(":"))
            h2, m2 = map(int, window_end.split(":"))
            start_today = send_at.replace(hour=h1, minute=m1, second=0, microsecond=0)
            end_today = send_at.replace(hour=h2, minute=m2, second=0, microsecond=0)

            if send_at < start_today:
                send_at = start_today
            elif send_at > end_today:
                # bump to next day window start
                send_at = start_today + timedelta(days=1)
        except Exception:
            # if anything weird, just use original send_at
            pass

    return send_at


def start_campaign_scheduling(campaign_id: int, db: Session) -> int:
    """
    Main entry: called by API `POST /campaigns/{id}/start`.

    - Finds campaign and its sequence / steps
    - Iterates all campaign contacts
    - Determines next step for each
    - Enqueues email jobs into RQ with staggered schedule

    Returns number of emails queued.
    """
    campaign = db.query(Campaign).get(campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found")

    # Mark as running if such a field exists
    if hasattr(campaign, "status"):
        campaign.status = "running"
        db.commit()
        db.refresh(campaign)

    sequence = _get_sequence_for_campaign(db, campaign)
    if not sequence:
        raise ValueError("No Sequence associated with this Campaign.")

    steps = _get_ordered_steps(db, sequence)
    if not steps:
        raise ValueError("Sequence has no steps defined.")

    # Load all active contacts attached to the campaign
    # We assume CampaignContact has: campaign_id, contact_id, is_active or status
    link_q = db.query(CampaignContact).filter(
        CampaignContact.campaign_id == campaign.id
    )
    if hasattr(CampaignContact, "is_active"):
        link_q = link_q.filter(CampaignContact.is_active == True)  # noqa: E712

    links = link_q.all()
    contact_ids = [l.contact_id for l in links]

    contacts = (
        db.query(Contact)
        .filter(Contact.id.in_(contact_ids), Contact.is_active == True)  # noqa: E712
        .all()
    )

    # q = get_queue("email_queue") # RQ removed

    now = datetime.utcnow()
    queued = 0
    offset_index = 0

    # Optional daily limit
    daily_limit = getattr(campaign, "daily_limit", None)

    for c in contacts:
        if daily_limit and queued >= daily_limit:
            break

        next_step = _find_next_step_for_contact(db, c, campaign, steps)
        if not next_step:
            continue  # nothing to send yet / completed

        send_time = _compute_schedule_time(now, campaign, offset_index)

        # Create SequenceQueue entry
        queue_item = SequenceQueue(
            contact_id=c.id,
            campaign_id=campaign.id,
            sequence_step_id=next_step.id,
            scheduled_at=send_time,
            status="pending",
            queued_at=datetime.utcnow(),
        )
        db.add(queue_item)

        # q.enqueue_in(
        #     timedelta(seconds=delay),
        #     send_sequence_email,
        #     contact_id=c.id,
        #     campaign_id=campaign.id,
        #     sequence_step_id=next_step.id,
        # )

        queued += 1
        offset_index += 1

    db.commit()
    return queued

