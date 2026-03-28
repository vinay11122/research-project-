from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    owner_approved = Column(Boolean, default=False) # New field for owner approval
    status = Column(String, default='PENDING') # New field for user status (PENDING, ACTIVE, REJECTED, EXPIRED, DISABLED)
    is_superuser = Column(Boolean, default=False)

    # Relationships
    campaigns = relationship("Campaign", back_populates="owner")
    suppressed_emails = relationship("SuppressedEmail", back_populates="owner")
    emails = relationship("Email", back_populates="user")
    email_events = relationship("EmailEvent", back_populates="user")

    # Workspace/User Settings
    smtp_host = Column(String, nullable=True)
    smtp_port = Column(Integer, nullable=True)
    smtp_username = Column(String, nullable=True)
    smtp_password_encrypted = Column(String, nullable=True) # Encrypted
    from_name = Column(String, nullable=True)
    from_email = Column(String, nullable=True)
    reply_to_email = Column(String, nullable=True)
    tracking_domain = Column(String, nullable=True)
    unsubscribe_footer_text = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
