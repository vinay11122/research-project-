import re
from fastapi import APIRouter, Request, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text
from sqlalchemy.sql import func

from app.core.database import get_db
from app.models.contact import Contact
from app.models.campaign import CampaignContact
from app.models.email import EmailReply, Email


# ============================================================
# 🔹 CLEAN REPLY EXTRACTION (Gmail / Outlook / SMTP-provider safe)
# ============================================================
def extract_clean_reply(text: str) -> str:
    if not text:
        return ""

    text = text.replace("\r\n", "\n").strip()

    # Split once at reply boundary (non-greedy)
    split_patterns = [
        r"\nOn .* wrote:",
        r"\nFrom: .*",
        r"\n-----Original Message-----"
    ]

    for pattern in split_patterns:
        parts = re.split(pattern, text, flags=re.IGNORECASE)
        if parts:
            text = parts[0]
            break

    # Remove quoted lines
    lines = []
    for line in text.split("\n"):
        if line.strip().startswith(">"):
            break
        lines.append(line)

    return "\n".join(lines).strip()


# ============================================================
# 🔹 ROUTER
# ============================================================
router = APIRouter(
    prefix="/email/webhook",
    tags=["Email Webhooks"]
)


# ============================================================
# 🔹 INBOUND EMAIL WEBHOOK
# ============================================================
@router.post("/inbound")
async def inbound_email_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    def normalize_sender(raw: str) -> str:
        raw = (raw or "").strip()
        match = re.search(r"<([^>]+)>", raw)
        email = match.group(1) if match else raw
        return email.strip().lower()

    form = await request.form()

    sender_raw = form.get("sender") or form.get("from")
    sender = normalize_sender(sender_raw)

    print("🔍 RAW SENDER:", sender_raw)
    print("🔍 NORMALIZED SENDER:", sender)

    if not sender:
        return {"status": "ignored", "reason": "no sender"}

    # 1️⃣ Find the most likely contact
    # Since multiple users can have the same contact email, 
    # we look for the contact who was most recently emailed.
    best_contact_query = sql_text("""
        SELECT c.id, c.user_id, e.campaign_id, e.id as email_id
        FROM contacts c
        LEFT JOIN emails e ON e.contact_id = c.id
        WHERE c.email = :sender
        ORDER BY e.sent_at DESC NULLS LAST
        LIMIT 1
    """)
    
    result = db.execute(best_contact_query, {"sender": sender}).mappings().first()

    if not result:
        return {
            "status": "ignored",
            "reason": "contact not found",
            "sender": sender
        }

    contact_id = result["id"]
    campaign_id = result["campaign_id"]
    last_email_id = result["email_id"]

    # 2️⃣ If no email was found, fallback to the first enrollment link
    if not campaign_id:
        first_link = db.query(CampaignContact).filter(CampaignContact.contact_id == contact_id).first()
        if first_link:
            campaign_id = first_link.campaign_id

    # 3️⃣ Mark specific campaign-contact as replied
    if campaign_id:
        cc_to_mark = db.query(CampaignContact).filter(
            CampaignContact.contact_id == contact_id,
            CampaignContact.campaign_id == campaign_id
        ).first()
        if cc_to_mark:
            cc_to_mark.replied = True

    # 4️⃣ Extract clean reply text
    raw_text = form.get("body-plain") or ""
    clean_text = extract_clean_reply(raw_text)

    if not clean_text:
        print("⚠️ Empty reply ignored")
        db.commit()
        return {"status": "ignored", "reason": "empty reply"}

    # 5️⃣ Store reply
    reply = EmailReply(
        contact_id=contact_id,
        campaign_id=campaign_id,
        email_id=last_email_id,
        reply_text=clean_text,
        reply_at=func.now()
    )

    db.add(reply)
    db.commit()

    print("✉️ Reply stored:", clean_text)

    return {
        "status": "ok",
        "stored": True,
        "sender": sender
    }
