"""
Central model registry for SQLAlchemy.

Importing this module ensures:
- All models are loaded into the SQLAlchemy metadata registry
- Base.metadata.create_all() can see every table
- FastAPI startup does not miss any model relationships
"""

# ============================
# User / Authentication Models
# ============================

from .user import User
from .password_reset_token import PasswordResetToken
from .email_verification_token import EmailVerificationToken
from .suppressed_email import SuppressedEmail


# ============================
# Contact & Campaign Models
# ============================

from .contact import Contact
from .campaign import Campaign, Sequence, CampaignContact
from .sequence_step import SequenceStep


# ============================
# Email System Models
# ============================

from .email import Email, EmailEvent, EmailReply
from .email_link import EmailLink
from .email_template import EmailTemplate
from .incident import Incident


# ============================
# Exported Model Symbols
# ============================
from .sequence_queue import SequenceQueue

__all__ = [
    # User
    "User",
    "PasswordResetToken",
    "EmailVerificationToken",
    "SuppressedEmail",

    # Contacts / Campaigns
    "Contact",
    "Campaign",
    "Sequence",
    "CampaignContact",
    "SequenceStep",

    # Email System
    "Email",
    "EmailEvent",
    "EmailReply",
     
]

__all__.append("SequenceQueue")
__all__.append("EmailLink")
__all__.append("EmailTemplate")
__all__.append("Incident")
