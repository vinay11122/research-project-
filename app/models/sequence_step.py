from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class SequenceStep(Base):
    __tablename__ = "sequence_steps"

    id = Column(Integer, primary_key=True, index=True)
    sequence_id = Column(
        Integer,
        ForeignKey("sequences.id", ondelete="CASCADE"),
        nullable=False,
    )

    step_number = Column(Integer, nullable=False)  # 1,2,3,...
    delay_days = Column(Integer, nullable=False, default=0)

    subject = Column(String(255), nullable=False)
    body_template = Column(String(4000), nullable=False)
    template_id = Column(Integer, ForeignKey("email_templates.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    sequence = relationship("Sequence", back_populates="steps")
    template = relationship("EmailTemplate")
    emails = relationship("Email", back_populates="sequence_step")
    campaign_contacts = relationship(
        "CampaignContact",
        back_populates="last_step",
    )
