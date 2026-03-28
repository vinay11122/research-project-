from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.campaign import CampaignContact, Campaign
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(tags=["Campaign Contacts"])

@router.post("/campaign-contacts/{contact_id}/{campaign_id}/mark-replied")
def mark_replied(
    contact_id: int, 
    campaign_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Ensure campaign belongs to user
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    cc = (
        db.query(CampaignContact)
        .filter(
            CampaignContact.contact_id == contact_id,
            CampaignContact.campaign_id == campaign_id,
        )
        .first()
    )

    if not cc:
        raise HTTPException(status_code=404, detail="CampaignContact not found")

    cc.replied = True
    db.commit()

    return {"status": "ok", "message": "Contact marked as replied"}
