from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select, func, text
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
import secrets

from app.core.database import get_db
from app.core.config import settings # Import settings to get MAIL_FROM fallback
from app.models.campaign import Campaign, Sequence, CampaignContact
from app.models.sequence_step import SequenceStep
from app.models.sequence_queue import SequenceQueue
from app.models.contact import Contact
from app.models.email import EmailReply, Email
from app.schemas.campaign import CampaignCreate, CampaignRead, CampaignUpdate
from app.schemas.queue import QueueItemOut
from app.services.sequence_queue import queue_first_step_for_contact
from app.workers.email_sender import wrap_in_html_layout # keep wrap_in_html_layout from here
from app.utils.transactional_email import send_email # Use transactional send_email
from app.utils.template_renderer import format_as_html
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

# --- Request Schemas ---

class EnrollContactsRequest(BaseModel):
    contact_ids: List[int]

class SendManualReplyRequest(BaseModel):
    subject: str
    body: str

# --- Endpoints ---

@router.get("/", response_model=List[CampaignRead])
def list_campaigns(
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Campaign).filter(Campaign.user_id == current_user.id).offset(skip).limit(limit).all()


@router.get("/{campaign_id}/queue", response_model=list[QueueItemOut])
def list_campaign_queue(
    campaign_id: int,
    status: str | None = None,   # pending/sent/failed...
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Ensure campaign belongs to user
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    q = (
        db.query(
            SequenceQueue,
            Contact.email.label("contact_email"),
            SequenceStep.step_number.label("step_number"),
            SequenceStep.template_id.label("template_id"),
        )
        .join(Contact, Contact.id == SequenceQueue.contact_id)
        .join(SequenceStep, SequenceStep.id == SequenceQueue.sequence_step_id)
        .filter(SequenceQueue.campaign_id == campaign_id)
    )

    if status:
        q = q.filter(SequenceQueue.status == status)

    rows = q.order_by(SequenceQueue.scheduled_at.asc()).limit(limit).all()

    # Convert to QueueItemOut-friendly dicts
    out = []
    for sq, email, step_number, template_id in rows:
        out.append({
            "id": sq.id,
            "campaign_id": sq.campaign_id,
            "contact_id": sq.contact_id,
            "contact_email": email,
            "sequence_step_id": sq.sequence_step_id,
            "step_number": step_number,
            "template_id": template_id,
            "status": sq.status,
            "scheduled_at": sq.scheduled_at,
            "queued_at": getattr(sq, "queued_at", None),
        })
    return out


@router.get("/{campaign_id}/sequence")
def get_campaign_sequence(
    campaign_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the sequence and its steps for a campaign.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    sequence = db.query(Sequence).filter(Sequence.campaign_id == campaign_id).first()
    if not sequence:
        return {"steps": []}

    steps = (
        db.query(SequenceStep)
        .filter(SequenceStep.sequence_id == sequence.id)
        .order_by(SequenceStep.step_number.asc())
        .all()
    )

    # Convert to a stable format for frontend
    return {
        "id": sequence.id,
        "name": sequence.name,
        "steps": [
            {
                "id": s.id,
                "step_number": s.step_number,
                "delay_days": s.delay_days,
                "template_id": s.template_id,
                "subject": s.subject,
                "body_template": s.body_template,
            }
            for s in steps
        ],
    }


@router.post("/{campaign_id}/conversations/{contact_id}/send")
def send_manual_reply(
    campaign_id: int, 
    contact_id: int, 
    payload: SendManualReplyRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    contact = db.query(Contact).get(contact_id)
    
    if not campaign or not contact:
        raise HTTPException(status_code=404, detail="Campaign or Contact not found")

    # 1. Send via SMTP
    # We treat manual replies as HTML and wrap them in our standard layout
    html_body_content = format_as_html(payload.body)

    # Use user's tracking domain for unsubscribe URL and open pixel URL
    tracking_domain = current_user.tracking_domain or settings.BASE_URL
    unsubscribe_text = current_user.unsubscribe_footer_text or "To stop receiving emails, please unsubscribe."
    mock_unsubscribe_url = f"http://{tracking_domain}/unsubscribe/test-token"
    mock_open_pixel_url = f"http://{tracking_domain}/track/open/manual-email.png"


    html_body = wrap_in_html_layout(
        content=html_body_content,
        unsubscribe_url=mock_unsubscribe_url,
        open_pixel_url=mock_open_pixel_url,
        unsubscribe_text=unsubscribe_text
    )

    from_address = current_user.from_email or settings.MAIL_FROM

    sent_ok = send_email(
        user=current_user,
        to_email=contact.email,
        subject=payload.subject,
        html_content=html_body
    )

    if not sent_ok:
        raise HTTPException(status_code=500, detail="Failed to send email via SMTP")

    # 2. Store in outbound table (Email)
    new_email = Email(
        user_id=current_user.id, # Link email to user
        campaign_id=campaign_id,
        contact_id=contact_id,
        from_address=from_address,
        to_address=contact.email,
        subject=payload.subject,
        body=payload.body,
        status="sent",
        sent_at=datetime.now(timezone.utc)
    )
    db.add(new_email)
    db.commit()
    db.refresh(new_email)

    return {
        "status": "ok",
        "email_id": new_email.id,
        "sent_at": new_email.sent_at
    }


@router.get("/{campaign_id}/conversations")
def list_campaign_conversations(
    campaign_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List unique contacts who have interactions in a specific campaign.
    """
    # Ensure campaign belongs to user
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    sql = text("""
        SELECT 
            c.id AS contact_id,
            c.email,
            (
                SELECT MAX(at) FROM (
                    SELECT reply_at as at FROM email_replies WHERE campaign_id = :cid AND contact_id = c.id
                    UNION ALL
                    SELECT sent_at as at FROM emails WHERE campaign_id = :cid AND contact_id = c.id
                ) t
            ) as last_message_at,
            (
                SELECT msg FROM (
                    SELECT reply_text as msg, reply_at as at FROM email_replies WHERE campaign_id = :cid AND contact_id = c.id
                    UNION ALL
                    SELECT subject as msg, sent_at as at FROM emails WHERE campaign_id = :cid AND contact_id = c.id
                ) t ORDER BY at DESC LIMIT 1
            ) as last_snippet
        FROM contacts c
        JOIN campaign_contacts cc ON cc.contact_id = c.id
        WHERE cc.campaign_id = :cid
        AND EXISTS (
            SELECT 1 FROM email_replies WHERE campaign_id = :cid AND contact_id = c.id
            UNION ALL
            SELECT 1 FROM emails WHERE campaign_id = :cid AND contact_id = c.id
        )
        ORDER BY last_message_at DESC NULLS LAST
    """)
    
    res = db.execute(sql, {"cid": campaign_id}).mappings().all()
    out = []
    for r in res:
        d = dict(r)
        if not d.get("last_snippet"):
            d["last_snippet"] = "No message content"
        out.append(d)
    return out


@router.get("/{campaign_id}/conversations/{contact_id}")
def get_conversation_thread(
    campaign_id: int, 
    contact_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the full thread (outbound subjects + inbound replies) for a specific contact in a campaign.
    """
    # Ensure campaign belongs to user
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # 1. Fetch Outbound
    outbound = db.execute(text("""
        SELECT 
            'outbound' AS direction,
            subject,
            body,
            sent_at AS at
        FROM emails
        WHERE campaign_id = :cid AND contact_id = :ctid
    """), {"cid": campaign_id, "ctid": contact_id}).mappings().all()
    
    # 2. Fetch Inbound
    inbound = db.execute(text("""
        SELECT 
            'inbound' AS direction,
            NULL AS subject,
            reply_text AS body,
            reply_at AS at
        FROM email_replies
        WHERE campaign_id = :cid AND contact_id = :ctid
    """), {"cid": campaign_id, "ctid": contact_id}).mappings().all()
    
    combined = [dict(m) for m in list(outbound) + list(inbound)]
    messages = sorted(
        combined,
        key=lambda x: x["at"] if x["at"] else datetime.min.replace(tzinfo=timezone.utc)
    )
    
    contact = db.query(Contact).get(contact_id)
    
    return {
        "contact_id": contact_id,
        "email": contact.email if contact else "Unknown",
        "messages": messages
    }


@router.get("/{campaign_id}/contacts")
def list_campaign_contacts(
    campaign_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all contacts enrolled in a campaign.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    results = (
        db.query(Contact, CampaignContact)
        .join(CampaignContact, Contact.id == CampaignContact.contact_id)
        .filter(CampaignContact.campaign_id == campaign_id)
        .all()
    )

    out = []
    for contact, cc in results:
        contact_dict = {
            "id": contact.id,
            "full_name": contact.full_name,
            "email": contact.email,
            "company_name": contact.company_name,
            "status": "enrolled", # Default
        }
        
        # Determine specific status
        if cc.unsubscribed:
            contact_dict["status"] = "unsubscribed"
        elif cc.bounced:
            contact_dict["status"] = "bounced"
        elif cc.replied:
            contact_dict["status"] = "replied"
        
        out.append(contact_dict)

    return out


@router.post("/{campaign_id}/contacts")
def enroll_contacts(
    campaign_id: int, 
    payload: EnrollContactsRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not payload.contact_ids:
        return {"enrolled": 0, "skipped": 0}

    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Make sure contacts exist
    existing_contacts = db.execute(
        select(Contact.id).where(Contact.id.in_(payload.contact_ids))
    ).scalars().all()
    existing_set = set(existing_contacts)

    # Already enrolled
    already = db.execute(
        select(CampaignContact.contact_id).where(
            CampaignContact.campaign_id == campaign_id,
            CampaignContact.contact_id.in_(payload.contact_ids),
        )
    ).scalars().all()
    already_set = set(already)

    to_insert = [cid for cid in payload.contact_ids if cid in existing_set and cid not in already_set]

    for cid in to_insert:
        db.add(CampaignContact(
            campaign_id=campaign_id, 
            contact_id=cid,
            unsubscribe_token=secrets.token_urlsafe(16)
        ))

    # ✅ BUG FIX: If campaign is already running, queue the first step for new arrivals
    queued_count = 0
    if campaign.status == "running" and to_insert:
        sequence = db.query(Sequence).filter(Sequence.campaign_id == campaign_id).first()
        if sequence:
            now = datetime.now(timezone.utc)
            # Use campaign start_at if it's in the future, otherwise use now
            # Handle start_at being naive or aware
            base_time = campaign.start_at
            if base_time:
                if base_time.tzinfo is None:
                    base_time = base_time.replace(tzinfo=timezone.utc)
                if base_time < now:
                    base_time = now
            else:
                base_time = now

            for cid in to_insert:
                if queue_first_step_for_contact(
                    db, 
                    contact_id=cid, 
                    campaign_id=campaign_id, 
                    sequence_id=sequence.id,
                    start_time=base_time
                ):
                    queued_count += 1

    db.commit()

    return {
        "enrolled": len(to_insert),
        "queued": queued_count,
        "skipped": len(payload.contact_ids) - len(to_insert),
        "missing_contacts": sorted(list(set(payload.contact_ids) - existing_set)),
    }


@router.get("/{campaign_id}", response_model=CampaignRead)
def get_campaign(
    campaign_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.post("/", response_model=CampaignRead, status_code=status.HTTP_201_CREATED)
def create_campaign(
    payload: CampaignCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    campaign = Campaign(
        **payload.model_dump(), 
        user_id=current_user.id,
        created_at=now,
        updated_at=now
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.put("/{campaign_id}", response_model=CampaignRead)
def update_campaign(
    campaign_id: int, 
    payload: CampaignUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    data = payload.model_dump(exclude_unset=True)

    # Manually handle time fields as they might be Pydantic Time objects
    if "sending_window_start" in data:
        campaign.sending_window_start = data.pop("sending_window_start")
    if "sending_window_end" in data:
        campaign.sending_window_end = data.pop("sending_window_end")
    if "sending_days" in data:
        campaign.sending_days = data.pop("sending_days")

    # OPTIONAL safety: if frontend sends a naive datetime, assume UTC
    if "start_at" in data and data["start_at"] is not None:
        dt = data["start_at"]
        if dt.tzinfo is None:
            from datetime import timezone
            data["start_at"] = dt.replace(tzinfo=timezone.utc)

    for field, value in data.items():
        setattr(campaign, field, value)

    db.commit()
    db.refresh(campaign)
    return campaign


@router.patch("/{campaign_id}", response_model=CampaignRead)
def patch_campaign(
    campaign_id: int, 
    payload: CampaignUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return update_campaign(campaign_id, payload, db, current_user)


@router.delete("/{campaign_id}", status_code=status.HTTP_200_OK)
def delete_campaign(
    campaign_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    db.delete(campaign)
    db.commit()
    return {"message": "Campaign deleted"}


# ---------------------------------------------------------
# SEQUENCE STEPS
# ---------------------------------------------------------

class StepCreate(BaseModel):
    step_number: Optional[int] = None
    delay_days: int
    template_id: Optional[int] = None
    subject: Optional[str] = None
    body_template: Optional[str] = None


@router.post("/{campaign_id}/steps", status_code=201)
def add_campaign_step(
    campaign_id: int,
    payload: StepCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Ensure Campaign exists and belongs to user
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # 2. Ensure Sequence exists
    sequence = db.query(Sequence).filter(Sequence.campaign_id == campaign_id).first()
    if not sequence:
        sequence = Sequence(
            campaign_id=campaign_id,
            name=f"Sequence for {campaign.name}"
        )
        db.add(sequence)
        db.flush()

    # 3. Upsert Logic
    if payload.step_number is not None:
        existing = (
            db.query(SequenceStep)
            .filter(
                SequenceStep.sequence_id == sequence.id,
                SequenceStep.step_number == payload.step_number,
            )
            .one_or_none()
        )

        if existing:
            existing.delay_days = payload.delay_days
            existing.subject = payload.subject or "[No Subject]"
            existing.body_template = payload.body_template or "[No Body]"
            existing.template_id = payload.template_id
            existing.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(existing)
            return {"id": existing.id, "step_number": existing.step_number, "action": "updated"}
        
        step_number = payload.step_number
    else:
        # Auto-increment
        max_step = (
            db.query(func.max(SequenceStep.step_number))
            .filter(SequenceStep.sequence_id == sequence.id)
            .scalar()
        ) or 0
        step_number = max_step + 1

    # 4. Create New Step
    new_step = SequenceStep(
        sequence_id=sequence.id,
        step_number=step_number,
        delay_days=payload.delay_days,
        subject=payload.subject or "[No Subject]",
        body_template=payload.body_template or "[No Body]",
        template_id=payload.template_id
    )
    db.add(new_step)
    
    try:
        db.commit()
        db.refresh(new_step)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Step number already exists (race)")

    return {"id": new_step.id, "step_number": new_step.step_number, "action": "created"}


# ---------------------------------------------------------
# CAMPAIGN CONTROL
# ---------------------------------------------------------

@router.post("/{campaign_id}/start")
def start_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Load Campaign and ensure it belongs to user
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # 2. RUN VALIDATION
    validation = validate_campaign(campaign_id, db, current_user)
    if not validation["is_valid"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Campaign validation failed: {', '.join(validation['issues'])}"
        )

    # 3. Ensure contacts are enrolled
    contacts_count = db.query(CampaignContact).filter(CampaignContact.campaign_id == campaign_id).count()
    if contacts_count == 0:
        raise HTTPException(status_code=400, detail="No contacts enrolled in this campaign.")

    # 4. Get Sequence
    sequence = db.query(Sequence).filter(Sequence.campaign_id == campaign_id).first()
    if not sequence:
        raise HTTPException(status_code=400, detail="Campaign has no sequence.")

    # 5. Queue First Step for ALL enrolled contacts (Backfill)
    # The service checks idempotency, so safe to call for everyone.
    campaign_contacts = db.query(CampaignContact).filter(CampaignContact.campaign_id == campaign_id).all()
    queued_count = 0
    
    now = datetime.now(timezone.utc)
    base_time = campaign.start_at
    if base_time:
        if base_time.tzinfo is None:
            base_time = base_time.replace(tzinfo=timezone.utc)
        if base_time < now:
            base_time = now
    else:
        base_time = now

    for cc in campaign_contacts:
        if queue_first_step_for_contact(
            db, 
            contact_id=cc.contact_id, 
            campaign_id=campaign_id, 
            sequence_id=sequence.id,
            start_time=base_time
        ):
            queued_count += 1

    # 6. Update Status
    campaign.status = "running"
    if not campaign.started_at:
        campaign.started_at = datetime.now(timezone.utc)
    
    db.commit()

    return {
        "status": "ok",
        "campaign_id": campaign_id,
        "new_status": "running",
        "contacts_enrolled": contacts_count,
        "newly_queued": queued_count
    }


@router.post("/{campaign_id}/pause")
def pause_campaign(
    campaign_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.status != "running":
        raise HTTPException(status_code=400, detail=f"Cannot pause campaign in {campaign.status} state")

    campaign.status = "paused"
    db.commit()
    return {"status": "ok", "new_status": "paused"}


@router.post("/{campaign_id}/resume")
def resume_campaign(
    campaign_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.status != "paused":
        raise HTTPException(status_code=400, detail=f"Cannot resume campaign in {campaign.status} state")

    campaign.status = "running"
    db.commit()
    return {"status": "ok", "new_status": "running"}


@router.post("/{campaign_id}/validate")
def validate_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    issues = []
    
    # 1. Check Sequence
    sequence = db.query(Sequence).filter(Sequence.campaign_id == campaign_id).first()
    if not sequence or not sequence.steps:
        issues.append("Campaign has no sequence steps defined.")
    else:
        for step in sequence.steps:
            # 2. Check Templates attached
            if not step.template_id:
                issues.append(f"Step {step.step_number} has no template attached.")
            
            # 3. Check Subjects
            if not step.subject or step.subject == "[No Subject]":
                issues.append(f"Step {step.step_number} has an empty subject line.")
            
            # 4. Check Unsubscribe Variable
            if "{{unsubscribe_url}}" not in (step.body_template or ""):
                issues.append(f"Step {step.step_number} is missing the mandatory {{unsubscribe_url}} variable.")

    is_valid = len(issues) == 0
    if is_valid and campaign.status == "draft":
        campaign.status = "validated"
        db.commit()

    return {
        "campaign_id": campaign_id,
        "is_valid": is_valid,
        "issues": issues,
        "new_status": campaign.status
    }