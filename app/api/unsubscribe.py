from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.campaign import CampaignContact
from app.models.suppressed_email import SuppressedEmail

router = APIRouter(
    prefix="/unsubscribe",
    tags=["Unsubscribe"]
)


@router.get("/{token}")
def unsubscribe_by_token(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Secure one-click unsubscribe using token.
    Also adds the email to a workspace-wide suppression list.
    """

    cc = (
        db.query(CampaignContact)
        .options(
            joinedload(CampaignContact.campaign).joinedload(Campaign.owner),
            joinedload(CampaignContact.contact)
        )
        .filter(CampaignContact.unsubscribe_token == token)
        .first()
    )

    if not cc:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired unsubscribe link"
        )

    # --- Update Campaign-level flag ---
    if not cc.unsubscribed:
        cc.unsubscribed = True
        db.add(cc)

    # --- Update Workspace-wide suppression list ---
    user = cc.campaign.owner
    contact_email = cc.contact.email

    if user and contact_email:
        existing_suppression = db.query(SuppressedEmail).filter(
            SuppressedEmail.user_id == user.id,
            SuppressedEmail.email == contact_email
        ).first()

        if not existing_suppression:
            suppressed_entry = SuppressedEmail(
                user_id=user.id,
                email=contact_email,
                reason="unsubscribed"
            )
            db.add(suppressed_entry)
    
    db.commit()

    return {
        "message": "You have been unsubscribed successfully.",
        "campaign_id": cc.campaign_id
    }
