from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import base64
from urllib.parse import urlparse

from app.core.database import SessionLocal
from app.models.email import Email, EmailEvent
from app.models.email_link import EmailLink

router = APIRouter(prefix="/track", tags=["Tracking"])

# -------------------------------------------------------------------
# 1×1 Transparent PNG (Open Tracking)
# -------------------------------------------------------------------
TRANSPARENT_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
)


# -------------------------------------------------------------------
# OPEN TRACKING
# -------------------------------------------------------------------
@router.get("/open/{email_id}.png")
def track_email_open(email_id: int, request: Request):
    db: Session = SessionLocal()
    try:
        email = db.query(Email).filter(Email.id == email_id).first()

        # Always return image (email clients must never break)
        if not email:
            return Response(content=TRANSPARENT_PNG, media_type="image/png")

        already_opened = (
            db.query(EmailEvent)
            .filter(
                EmailEvent.email_id == email_id,
                EmailEvent.event_type == "open",
            )
            .first()
        )

        if not already_opened:
            event = EmailEvent(
                user_id=email.user_id, # Link event to user
                email_id=email_id,
                event_type="open",
                occurred_at=datetime.now(timezone.utc),
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
            db.add(event)
            email.last_event_at = datetime.now(timezone.utc)
            db.commit()

        response = Response(content=TRANSPARENT_PNG, media_type="image/png")
        response.headers["ngrok-skip-browser-warning"] = "true"
        return response

    finally:
        db.close()


# -------------------------------------------------------------------
# CLICK TRACKING (PHASE 1.1)
# -------------------------------------------------------------------
def is_safe_url(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.scheme in ("http", "https") and bool(p.netloc)
    except Exception:
        return False


@router.get("/click/{email_id}/{link_id}")
def track_email_click(email_id: int, link_id: int, request: Request):
    db: Session = SessionLocal()

    try:
        link = (
            db.query(EmailLink)
            .filter(
                EmailLink.id == link_id,
                EmailLink.email_id == email_id,
            )
            .first()
        )

        if not link:
            raise HTTPException(status_code=404, detail="Tracked link not found")
        
        email = db.query(Email).filter(Email.id == email_id).first()
        if not email:
            raise HTTPException(status_code=404, detail="Email not found for tracked link")

        # Log click event
        event = EmailEvent(
            user_id=email.user_id, # Link event to user
            email_id=email_id,
            event_type="click",
            occurred_at=datetime.now(timezone.utc),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            url=link.url,
        )
        db.add(event)
        email.last_event_at = datetime.now(timezone.utc) # Update last event on email
        db.commit()

        if not is_safe_url(link.url):
            raise HTTPException(status_code=400, detail="Unsafe redirect URL")

        response = RedirectResponse(url=link.url, status_code=302)
        response.headers["ngrok-skip-browser-warning"] = "true"
        return response

    finally:
        db.close()

