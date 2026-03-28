from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import SessionLocal
from app.models.sequence_step import SequenceStep
from app.models.email_template import EmailTemplate
from app.models.campaign import Sequence, Campaign
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/sequence-steps", tags=["Sequence Steps"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class SequenceStepCreate(BaseModel):
    campaign_id: int
    step_number: int
    delay_days: int

class SequenceStepUpdate(BaseModel):
    step_number: Optional[int] = None
    delay_days: Optional[int] = None


@router.post("", status_code=201)
def create_sequence_step(
    payload: SequenceStepCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Ensure Sequence exists for campaign and belongs to user
    campaign = db.query(Campaign).filter(Campaign.id == payload.campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    sequence = db.query(Sequence).filter(Sequence.campaign_id == payload.campaign_id).first()
    if not sequence:
        sequence = Sequence(
            campaign_id=payload.campaign_id,
            name=f"Sequence for Campaign {payload.campaign_id}"
        )
        db.add(sequence)
        db.flush()

    # 2. Create SequenceStep
    # Note: subject and body_template are NOT nullable in the model
    new_step = SequenceStep(
        sequence_id=sequence.id,
        step_number=payload.step_number,
        delay_days=payload.delay_days,
        subject="[No Subject]",
        body_template="[No Body]"
    )
    db.add(new_step)
    db.commit()
    db.refresh(new_step)

    return new_step


@router.patch("/{step_id}")
def update_sequence_step(
    step_id: int,
    payload: SequenceStepUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    step = db.query(SequenceStep).join(Sequence).join(Campaign).filter(
        SequenceStep.id == step_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not step:
        raise HTTPException(status_code=404, detail="Sequence step not found")

    if payload.step_number is not None:
        step.step_number = payload.step_number
    if payload.delay_days is not None:
        step.delay_days = payload.delay_days

    db.commit()
    db.refresh(step)
    return step


@router.post("/{step_id}/attach-template/{template_id}")
def attach_template(
    step_id: int,
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    step = db.query(SequenceStep).join(Sequence).join(Campaign).filter(
        SequenceStep.id == step_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not step:
        raise HTTPException(status_code=404, detail="Sequence step not found")

    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id, EmailTemplate.user_id == current_user.id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Email template not found")

    step.template_id = template.id
    # Sync content
    step.subject = template.subject_template
    step.body_template = template.body_template
    
    db.commit()

    return {
        "status": "ok",
        "step_id": step.id,
        "template_id": template.id
    }