from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jinja2 import TemplateSyntaxError

from app.core.database import SessionLocal
from app.core.config import settings
from app.models.email_template import EmailTemplate
from app.models.contact import Contact
from app.models.campaign import Campaign, CampaignContact
from app.utils.template_renderer import render_template, render_template_html
from app.utils.template_validator import validate_template
from app.utils.template_context import build_template_context
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/templates", tags=["Templates"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TemplateOut(BaseModel):
    id: int
    user_id: int | None
    name: str
    subject_template: str
    body_template: str
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class TemplatePreviewRequest(BaseModel):
    template: str
    context: dict


class TemplateCreate(BaseModel):
    name: str
    subject_template: str
    body_template: str


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.user_id == current_user.id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return template


@router.post("/preview")
def preview_template(payload: TemplatePreviewRequest, current_user: User = Depends(get_current_user)):
    try:
        rendered = render_template_html(payload.template, payload.context)
        return {"rendered": rendered}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class RenderRequest(BaseModel):
    contact_id: int
    campaign_id: int


@router.post("/{template_id}/render")
def render_template_for_contact(
    template_id: int,
    payload: RenderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id, EmailTemplate.user_id == current_user.id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    contact = db.query(Contact).filter(Contact.id == payload.contact_id, Contact.user_id == current_user.id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    campaign = db.query(Campaign).filter(Campaign.id == payload.campaign_id, Campaign.user_id == current_user.id).first()
    
    # 1. Get CampaignContact for unsubscribe token
    cc = db.query(CampaignContact).filter(
        CampaignContact.campaign_id == payload.campaign_id,
        CampaignContact.contact_id == payload.contact_id
    ).first()
    
    unsubscribe_url = f"{settings.BASE_URL}/unsubscribe/{cc.unsubscribe_token if cc else 'test-token'}"

    # 2. Build Context
    context = build_template_context(contact, campaign, unsubscribe_url)

    # 3. Render
    try:
        subject = render_template(template.subject_template, context)
        html = render_template_html(template.body_template, context)
        text = render_template(template.body_template, context)
        return {
            "subject": subject,
            "html": html,
            "text": text
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Rendering error: {str(e)}")


@router.post("", response_model=TemplateOut, status_code=201)
def create_template(
    payload: TemplateCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 🔒 Validate Jinja BEFORE saving
    try:
        validate_template(payload.subject_template)
        validate_template(payload.body_template)
    except TemplateSyntaxError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Template syntax error: {str(e)}"
        )

    tpl = EmailTemplate(
        name=payload.name,
        user_id=current_user.id,
        subject_template=payload.subject_template,
        body_template=payload.body_template,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)

    return tpl


@router.put("/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: int,
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.user_id == current_user.id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # 🔒 Validate Jinja BEFORE saving
    try:
        validate_template(payload.subject_template)
        validate_template(payload.body_template)
    except TemplateSyntaxError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Template syntax error: {str(e)}"
        )

    template.name = payload.name
    template.subject_template = payload.subject_template
    template.body_template = payload.body_template
    template.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(template)
    return template


@router.get("", response_model=list[TemplateOut])
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(EmailTemplate).filter(EmailTemplate.user_id == current_user.id).order_by(EmailTemplate.created_at.desc()).all()