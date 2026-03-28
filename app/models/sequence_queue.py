from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class SequenceQueue(Base):
    __tablename__ = "sequence_queue"

    id = Column(Integer, primary_key=True, index=True)

    contact_id = Column(
        Integer,
        ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=False
    )
    campaign_id = Column(
        Integer,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False
    )
    sequence_step_id = Column(
        Integer,
        ForeignKey("sequence_steps.id", ondelete="CASCADE"),
        nullable=False
    )

    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    queued_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)

    status = Column(String(50), nullable=False, default="pending")
    # pending / sending / sent / failed / skipped

    # Relationships
    contact = relationship("Contact")
    campaign = relationship("Campaign")
    sequence_step = relationship("SequenceStep")

