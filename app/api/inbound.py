from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.contact import Contact
from app.models.campaign import CampaignContact

router = APIRouter(prefix="/inbound", tags=["Inbound"])

@router.post("/reply")
async def inbound_reply(request: Request, db: Session = Depends(get_db)):
    form = await request.form()

    sender = form.get("sender")
    subject = form.get("subject")
    body = form.get("body-plain")

    if not sender:
        return {"status": "ignored", "reason": "no sender"}

    # 1. Find contact first
    contact = db.query(Contact).filter(Contact.email == sender).first()
    if not contact:
        return {"status": "ignored", "reason": "contact not found"}

    # 2. Find campaign contact
    cc = (
        db.query(CampaignContact)
        .filter(CampaignContact.contact_id == contact.id)
        .first()
    )

    if not cc:
        return {"status": "ignored", "reason": "campaign contact not found"}

    # ✅ MARK AS REPLIED
    cc.replied = True
    db.commit()

    print("✉️ REPLY DETECTED")
    print("From:", sender)
    print("Subject:", subject)

    return {"status": "ok", "replied": sender}
