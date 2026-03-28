from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    # --- Basic Personal Details ---
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    full_name = Column(String(200), nullable=False, index=True)

    # --- Company / Role ---
    company_name = Column(String(255), nullable=True, index=True)
    title = Column(String(255), nullable=True)  # CEO, Founder, etc.

    # --- Email + LinkedIn ---
    email = Column(String(255), nullable=False, unique=False, index=True)
    email_confidence = Column(String(20), nullable=True)  # high / medium / low
    external_id = Column(String(255), nullable=True, index=True)
    linkedin_url = Column(String(500), nullable=True)

    # --- Classification ---
    category = Column(String(50), nullable=True)  # investor, founder, etc.
    source = Column(String(50), default="direct", index=True) # direct, csv, xlsx
    created_by_user_id = Column(Integer, nullable=True, index=True)

    country = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)

    # --- Status ---
    is_active = Column(Boolean, default=True)

    # --- Timestamps ---
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # ================================
    # RELATIONSHIPS
    #
    # Recommendation: For better data integrity and to avoid manual deletion logic
    # (like in ContactService.delete_all), consider ensuring foreign key constraints
    # in the database are set with ON DELETE CASCADE for these relationships.
    # ================================
    # Contact ↔ CampaignContact (many-to-many via join table)
    campaign_links = relationship(
        "CampaignContact",
        back_populates="contact",
        cascade="all, delete-orphan",
    )

    # Contact ↔ Email (1-to-many: outbound emails sent to this contact)
    emails = relationship(
        "Email",
        back_populates="contact",
        cascade="all, delete-orphan",
    )

    # Contact ↔ EmailReply (1-to-many: replies from this contact)
    replies = relationship(
        "EmailReply",
        back_populates="contact",
        cascade="all, delete-orphan",
    )

