from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from fastapi import HTTPException
from datetime import datetime, timezone

from app.models.contact import Contact
from app.models.campaign import CampaignContact
from app.models.email import Email, EmailReply
from app.schemas.contact import ContactCreate, ContactUpdate


from app.utils.email_validation import validate_email_domain


class ContactService:

    @staticmethod
    def get_all(db: Session, user_id: int, skip: int = 0, limit: int = 50):
        return db.query(Contact).filter(Contact.user_id == user_id).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, contact_id: int, user_id: int) -> Optional[Contact]:
        return db.query(Contact).filter(Contact.id == contact_id, Contact.user_id == user_id).first()

    @staticmethod
    def create(db: Session, data: ContactCreate, user_id: int) -> Contact:
        # Normalize
        data.email = data.email.strip().lower()
        
        # Validate Domain
        validate_email_domain(data.email)
        
        # Check External ID collision
        if data.external_id:
            existing_ext = db.query(Contact).filter(Contact.user_id == user_id, Contact.external_id == data.external_id).first()
            if existing_ext:
                raise HTTPException(
                    status_code=400,
                    detail=f"Contact with External ID '{data.external_id}' already exists."
                )

        now = datetime.now(timezone.utc)
        contact = Contact(
            **data.dict(), 
            user_id=user_id,
            created_at=now,
            updated_at=now
        )
        db.add(contact)
        try:
            db.commit()
            db.refresh(contact)
            return contact
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"Contact with email '{data.email}' already exists."
            )

    @staticmethod
    def update(db: Session, contact: Contact, data: ContactUpdate) -> Contact:
        # Note: contact is already filtered by user_id in get_by_id
        update_data = data.dict(exclude_unset=True)
        
        if "email" in update_data:
            # Normalize
            update_data["email"] = update_data["email"].strip().lower()
            # Validate Domain
            validate_email_domain(update_data["email"])
            
        if "external_id" in update_data and update_data["external_id"]:
            # Check collision with OTHER contacts
            existing_ext = db.query(Contact).filter(
                Contact.user_id == contact.user_id, 
                Contact.external_id == update_data["external_id"],
                Contact.id != contact.id
            ).first()
            if existing_ext:
                raise HTTPException(
                    status_code=400,
                    detail=f"Another contact with External ID '{update_data['external_id']}' already exists."
                )

        for field, value in update_data.items():
            setattr(contact, field, value)
            
        contact.updated_at = datetime.now(timezone.utc)

        try:
            db.commit()
            db.refresh(contact)
            return contact
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"Another contact with this email already exists."
            )

    @staticmethod
    def delete(db: Session, contact: Contact) -> None:
        db.delete(contact)
        db.commit()

    @staticmethod
    def delete_all(db: Session, user_id: int) -> int:
        # Get all contact IDs for this user
        contact_ids = db.query(Contact.id).filter(Contact.user_id == user_id).all()
        contact_ids = [c[0] for c in contact_ids]
        
        if not contact_ids:
            return 0
            


        deleted_count = db.query(Contact).filter(Contact.user_id == user_id).delete(synchronize_session=False)
        db.commit()
        return deleted_count

