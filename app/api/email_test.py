from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.utils.transactional_email import send_email # Use the new transactional email sender
from app.workers.email_sender import wrap_in_html_layout # Keep wrap_in_html_layout from email_sender
from app.core.database import get_db
from app.core.config import settings
from app.models.email_template import EmailTemplate
from app.models.contact import Contact
from app.utils.template_renderer import render_template, render_template_html
from app.utils.template_context import build_template_context

from app.utils.email_validation import validate_email_domain

from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/email",
    tags=["Email"]
)

class TestEmailRequest(BaseModel):
    to_email: EmailStr


@router.post("/test")
def send_test_email(payload: TestEmailRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    to_email = payload.to_email.strip().lower()
    validate_email_domain(to_email)
    
    subject = "Averitas Reach – Email Tracking Test ✔"
    html_body_content = """
    <html><body><h2>Tracking Test</h2><p>Working.</p></body></html>
    """
    
    # Use the user's tracking domain if configured, otherwise fallback to app BASE_URL
    tracking_domain = current_user.tracking_domain or settings.BASE_URL
    unsubscribe_text = current_user.unsubscribe_footer_text or "To stop receiving emails, please unsubscribe."

    # Need a mock unsubscribe_url and open_pixel_url for wrapping layout
    mock_unsubscribe_url = f"http://{tracking_domain}/unsubscribe/test-token"
    mock_open_pixel_url = f"http://{tracking_domain}/track/open/test-email-id.png"


    html_body = wrap_in_html_layout(
        content=html_body_content,
        unsubscribe_url=mock_unsubscribe_url,
        open_pixel_url=mock_open_pixel_url,
        unsubscribe_text=unsubscribe_text
    )

    try:
        send_email(user=current_user, to_email=to_email, subject=subject, html_content=html_body)
        return {"status": "ok", "message": f"Sent test to {to_email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TestRenderRequest(BaseModel):
    template_id: int
    contact_id: int
    to_email: EmailStr


@router.post("/test-render")
def send_test_render(
    payload: TestRenderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    to_email = payload.to_email.strip().lower()
    validate_email_domain(to_email)

    template = db.query(EmailTemplate).filter(EmailTemplate.id == payload.template_id, EmailTemplate.user_id == current_user.id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    contact = db.query(Contact).filter(Contact.id == payload.contact_id, Contact.user_id == current_user.id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Build context with mock unsubscribe
    tracking_domain = current_user.tracking_domain or settings.BASE_URL
    unsubscribe_url = f"http://{tracking_domain}/unsubscribe/test-token" # Use user's tracking domain
    context = build_template_context(contact, None, unsubscribe_url)

    try:
        subject = render_template(template.subject_template, context)
        html_content = render_template_html(template.body_template, context)
        
        # Use mock open pixel and user's unsubscribe text for layout
        mock_open_pixel_url = f"http://{tracking_domain}/track/open/test-email-id.png"
        unsubscribe_text = current_user.unsubscribe_footer_text or "To stop receiving emails, please unsubscribe."

        html_body = wrap_in_html_layout(
            content=html_content,
            unsubscribe_url=unsubscribe_url,
            open_pixel_url=mock_open_pixel_url,
            unsubscribe_text=unsubscribe_text
        )
        
        send_email(
            user=current_user, # Pass the current user
            to_email=to_email,
            subject=f"[TEST] {subject}",
            html_content=html_body
        )
        return {
            "status": "ok",
            "message": f"Test email sent to {to_email}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send test: {str(e)}")
