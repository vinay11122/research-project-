from datetime import datetime, timezone
from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.contact import Contact
from app.models.campaign import Campaign, CampaignContact
from app.models.suppressed_email import SuppressedEmail
from app.models.email import Email, EmailEvent
from app.services.incident_service import (
    SOURCE_PROVIDER_DELIVERY,
    open_or_update_incident,
    resolve_open_incidents,
)


router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/events")
async def provider_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.form()

    event = payload.get("event")
    recipient = payload.get("recipient")
    message_id_header = payload.get("Message-Id")

    if not event or not recipient:
        return {"status": "ignored", "reason": "missing event or recipient"}

    # Map provider events to our event types and suppression reasons
    event_type_map = {
        "bounced": "bounce",
        "complained": "complaint",
        "unsubscribed": "unsubscribed", # Handled by unsubscribe router, but can be a fallback
        "delivered": "delivered",
        "opened": "open",
        "clicked": "click",
        # "failed" is often a transient bounce
    }
    
    suppression_reason_map = {
        "bounced": "bounced",
        "complained": "complained",
        "unsubscribed": "unsubscribed",
    }

    if event not in event_type_map:
        return {"status": "ignored", "reason": f"event '{event}' not handled"}

    # Try to find the Email record first using Message-Id if available
    email_record: Email | None = None
    if message_id_header:
        email_record = db.query(Email).filter(Email.ses_message_id == message_id_header).first()

    if not email_record:
        # Fallback: if no message_id or email not found, try to find by recipient and most recent
        # This is less reliable but can catch some cases.
        email_record = db.query(Email).filter(
            Email.to_address == recipient
        ).order_by(Email.sent_at.desc()).first()

    if not email_record:
        print(f"Email webhook: Email record not found for recipient {recipient} and Message-Id {message_id_header}. Skipping EmailEvent creation.")
        # Proceed to update CampaignContact and Suppression List without EmailEvent
        # This might happen for manual replies, or if Message-Id mapping is off
    
    # Update CampaignContact entries and Suppression List
    campaign_contacts = (
        db.query(CampaignContact)
        .join(Contact)
        .options(
            joinedload(CampaignContact.campaign).joinedload(Campaign.owner)
        )
        .filter(Contact.email == recipient)
        .all()
    )

    if not campaign_contacts:
        print(f"Email webhook: No campaign contact found for recipient {recipient}. Skipping CampaignContact and Suppression List update.")
        db.commit() # Ensure previous db operations are saved if any
        return {"status": "ignored", "reason": "no campaign contact found for recipient"}

    for cc in campaign_contacts:
        user = cc.campaign.owner
        # Update campaign-level flag
        if event == "bounced":
            cc.bounced = True
            if email_record: email_record.status = "bounced"
        elif event == "unsubscribed":
            cc.unsubscribed = True
            if email_record: email_record.status = "unsubscribed"
        elif event == "complained":
            cc.unsubscribed = True  # Treat complaints as unsubscribe at campaign level
            if email_record: email_record.status = "complained"
        elif event == "delivered":
            if email_record: email_record.status = "delivered"
        elif event == "opened":
            if email_record: email_record.status = "opened"
        elif event == "clicked":
            if email_record: email_record.status = "clicked"

        # Update workspace-wide suppression list if applicable
        if user and recipient and event in suppression_reason_map:
            existing_suppression = db.query(SuppressedEmail).filter(
                SuppressedEmail.user_id == user.id,
                SuppressedEmail.email == recipient
            ).first()

            if not existing_suppression:
                suppressed_entry = SuppressedEmail(
                    user_id=user.id,
                    email=recipient,
                    reason=suppression_reason_map[event]
                )
                db.add(suppressed_entry)

        # Create EmailEvent if we have a linked email record and user
        if email_record and user:
            new_event = EmailEvent(
                user_id=user.id,
                email_id=email_record.id,
                event_type=event_type_map[event],
                occurred_at=datetime.now(timezone.utc),
                # Add provider metadata such as IP or user-agent if available
            )
            db.add(new_event)
            email_record.last_event_at = new_event.occurred_at # Update last event on email

        if user:
            incident_started_at = email_record.sent_at if email_record and email_record.sent_at else datetime.now(timezone.utc)
            incident_detected_at = datetime.now(timezone.utc)
            if event in {"bounced", "complained"}:
                open_or_update_incident(
                    db=db,
                    user_id=user.id,
                    source=SOURCE_PROVIDER_DELIVERY,
                    title="Provider delivery failures",
                    campaign_id=cc.campaign_id,
                    started_at=incident_started_at,
                    detected_at=incident_detected_at,
                    details=f"Provider event: {event}",
                )
            elif event in {"delivered", "opened", "clicked"}:
                resolve_open_incidents(
                    db=db,
                    user_id=user.id,
                    source=SOURCE_PROVIDER_DELIVERY,
                    campaign_id=cc.campaign_id,
                    resolved_at=incident_detected_at,
                )
    
    db.commit()
    return {"status": "ok", "event": event}
