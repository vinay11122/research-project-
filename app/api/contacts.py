from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.contact import ContactRead, ContactCreate, ContactUpdate
from app.services.contact_service import ContactService
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/contacts", tags=["contacts"])


# -----------------------------------------------------------
# LIST CONTACTS
# -----------------------------------------------------------
@router.get("/", response_model=list[ContactRead])
def list_contacts(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Return paginated list of contacts.
    """
    return ContactService.get_all(db, current_user.id, skip, limit)


# -----------------------------------------------------------
# GET SINGLE CONTACT
# -----------------------------------------------------------
@router.get("/{contact_id}", response_model=ContactRead)
def get_contact(
    contact_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Return a single contact by ID.
    """
    contact = ContactService.get_by_id(db, contact_id, current_user.id)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found",
        )
    return contact


# -----------------------------------------------------------
# CREATE CONTACT
# -----------------------------------------------------------
@router.post("/", response_model=ContactRead, status_code=status.HTTP_201_CREATED)
def create_contact(
    payload: ContactCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new contact.
    """
    return ContactService.create(db, payload, current_user.id)


# -----------------------------------------------------------
# UPDATE CONTACT
# -----------------------------------------------------------
@router.put("/{contact_id}", response_model=ContactRead)
def update_contact(
    contact_id: int,
    payload: ContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing contact.
    """
    contact = ContactService.get_by_id(db, contact_id, current_user.id)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found",
        )
    return ContactService.update(db, contact, payload)


# -----------------------------------------------------------
# DELETE ALL CONTACTS
# -----------------------------------------------------------
@router.delete("/all", status_code=status.HTTP_200_OK)
def delete_all_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete all contacts for the current user.
    """
    count = ContactService.delete_all(db, current_user.id)
    return {"message": f"All {count} contacts deleted successfully"}


# -----------------------------------------------------------
# DELETE CONTACT
# -----------------------------------------------------------
@router.delete("/{contact_id}", status_code=status.HTTP_200_OK)
def delete_contact(
    contact_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a contact by ID.
    """
    contact = ContactService.get_by_id(db, contact_id, current_user.id)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found",
        )

    ContactService.delete(db, contact)
    return {"message": f"Contact {contact_id} deleted successfully"}