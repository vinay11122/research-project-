from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Boolean,
    Index,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


# ============================================================
# EMAIL (ONE ROW = ONE SENT EMAIL)
# ============================================================
class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, index=True)

    # --- Ownership ---
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contact_id = Column(
        Integer,
        ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    campaign_id = Column(
        Integer,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    sequence_step_id = Column(
        Integer,
        ForeignKey("sequence_steps.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --- Transport metadata ---
    ses_message_id = Column(String(255), nullable=True, index=True)
    from_address = Column(String(255), nullable=False)
    to_address = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(String(10000), nullable=True)

    # sent | bounced | failed | delivered | replied
    status = Column(String(50), default="sent", index=True)

    # --- Time tracking ---
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    last_event_at = Column(DateTime(timezone=True), nullable=True)

    # --- Relationships ---
    user = relationship("User", back_populates="emails")
    contact = relationship("Contact", back_populates="emails")
    campaign = relationship("Campaign", back_populates="emails")
    sequence_step = relationship("SequenceStep", back_populates="emails")

    events = relationship(
        "EmailEvent",
        back_populates="email",
        cascade="all, delete-orphan",
    )

    replies = relationship(
        "EmailReply",
        back_populates="email",
        cascade="all, delete-orphan",
    )


# ============================================================
# EMAIL EVENTS (OPEN / CLICK / BOUNCE / DELIVERED)
# ============================================================
class EmailEvent(Base):
    __tablename__ = "email_events"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email_id = Column(
        Integer,
        ForeignKey("emails.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # open | click | bounce | delivered | complaint
    event_type = Column(String(50), nullable=False, index=True)

    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # --- Analytics metadata ---
    ip_address = Column(String(100), nullable=True)
    user_agent = Column(String(500), nullable=True)
    url = Column(String(1000), nullable=True)

    user = relationship("User", back_populates="email_events")
    email = relationship("Email", back_populates="events")


# ============================================================
# EMAIL REPLIES (INBOUND HANDLING)
# ============================================================
class EmailReply(Base):
    __tablename__ = "email_replies"

    id = Column(Integer, primary_key=True, index=True)

    email_id = Column(
        Integer,
        ForeignKey("emails.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    contact_id = Column(
        Integer,
        ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    campaign_id = Column(
        Integer,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    reply_text = Column(String(8000), nullable=False)
    reply_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # positive | negative | neutral | question | unsubscribe
    classified_intent = Column(String(50), nullable=True)
    classifier_meta = Column(String(2000), nullable=True)

    email = relationship("Email", back_populates="replies")
    contact = relationship("Contact", back_populates="replies")


# ============================================================
# OPTIONAL PERFORMANCE INDEXES
# ============================================================
Index("ix_email_campaign_sent", Email.campaign_id, Email.sent_at)
Index("ix_email_event_email_type", EmailEvent.email_id, EmailEvent.event_type)
Index("ix_email_user_id", Email.user_id)
Index("ix_email_event_user_id", EmailEvent.user_id)

