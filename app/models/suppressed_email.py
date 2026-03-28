from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship

from app.core.database import Base

class SuppressedEmail(Base):
    __tablename__ = "suppressed_emails"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), index=True, nullable=False)
    reason = Column(String(50), nullable=False)  # "unsubscribed", "bounced", "complained"
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User")
