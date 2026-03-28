from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


# ============================================================
# CAMPAIGN
# ============================================================
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Time

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    status = Column(String(50), default="draft")  # draft, validated, running, paused, completed
    
    # Scheduling & Throttling
    start_at = Column(DateTime(timezone=True), nullable=True)
    daily_send_limit = Column(Integer, nullable=True)
    sending_window_start = Column(Time, nullable=True)
    sending_window_end = Column(Time, nullable=True)
    sending_days = Column(String(100), default="mon,tue,wed,thu,fri") # e.g. "mon,tue,wed"

    # Internal state
    limit_reset_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    owner = relationship("User", back_populates="campaigns")
    sequences = relationship(
        "Sequence",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )

    contacts = relationship(
        "CampaignContact",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )

    emails = relationship(
        "Email",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )



# ============================================================
# SEQUENCE
# ============================================================
class Sequence(Base):
    __tablename__ = "sequences"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    name = Column(String(255), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    campaign = relationship("Campaign", back_populates="sequences")

    steps = relationship(
        "SequenceStep",
        back_populates="sequence",
        cascade="all, delete-orphan",
    )


# ============================================================
# CAMPAIGN ↔ CONTACT (JUNCTION TABLE)
# ============================================================
class CampaignContact(Base):
    __tablename__ = "campaign_contacts"

    id = Column(Integer, primary_key=True, index=True)

    contact_id = Column(
        Integer,
        ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=False,
    )

    campaign_id = Column(
        Integer,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )

    # 🔐 UNSUBSCRIBE / REPLY TRACKING
    unsubscribe_token = Column(String(64), unique=True, index=True)
    unsubscribed = Column(Boolean, default=False)
    replied = Column(Boolean, default=False)
    bounced = Column(Boolean, default=False)

    # Optional progress tracking
    last_step_id = Column(
        Integer,
        ForeignKey("sequence_steps.id"),
        nullable=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    contact = relationship("Contact", back_populates="campaign_links")
    campaign = relationship("Campaign", back_populates="contacts")

    last_step = relationship(
        "SequenceStep",
        back_populates="campaign_contacts",
    )
