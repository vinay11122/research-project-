from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.services.imports.contact_file_parser import parse_contact_file
from app.services.imports.contact_bulk_upsert import bulk_upsert_contacts
from app.api.auth import get_current_user
from app.models.user import User
from app.models.contact import Contact
from app.schemas.bulk_import import ImportPreviewResponse, ImportCommitRequest, ImportCommitResponse

router = APIRouter(prefix="/contacts/import", tags=["Contact Import"])


@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_contacts_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    content = await file.read()

    parsed = parse_contact_file(content, filename=file.filename)

    valid = parsed.get("valid", [])
    invalid = parsed.get("invalid", [])
    duplicates = parsed.get("duplicates", [])

    # --- Check for DB Existence ---
    if valid:
        emails = [r["email"] for r in valid if r.get("email")]
        external_ids = [r["external_id"] for r in valid if r.get("external_id")]
        
        query = db.query(Contact).filter(Contact.user_id == current_user.id)
        conditions = []
        if emails:
            conditions.append(Contact.email.in_(emails))
        if external_ids:
            conditions.append(Contact.external_id.in_(external_ids))
        
        if conditions:
            query = query.filter(or_(*conditions))
            existing_records = query.all()
            
            existing_emails = {c.email.lower() for c in existing_records}
            existing_ext_ids = {c.external_id for c in existing_records if c.external_id}
            
            for row in valid:
                email_match = row.get("email") and row["email"].lower() in existing_emails
                id_match = row.get("external_id") and row["external_id"] in existing_ext_ids
                
                if email_match or id_match:
                    row["exists_in_db"] = True
                    # Optional: Add detail about why
                    # row["match_reason"] = "external_id" if id_match else "email"

    return {
        "total_rows": parsed.get("total_rows", 0),
        "valid_count": len(valid),
        "invalid_count": len(invalid),
        "duplicate_count": len(duplicates),
        "valid_rows": valid,
        "invalid_rows": invalid,
        "duplicates": duplicates,
        "errors": parsed.get("errors", []),
    }


@router.post("/commit-json", response_model=ImportCommitResponse)
async def commit_contacts_json(
    payload: ImportCommitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Commit a list of contacts (e.g. after editing in the UI preview).
    """
    result = bulk_upsert_contacts(
        db=db,
        contacts=payload.contacts,
        source="web_import_json",
        created_by_user_id=current_user.id,
        mode=payload.mode,
    )
    return result


@router.post("/commit")
async def commit_contacts_import(
    file: UploadFile = File(...),
    mode: str = Query("skip", pattern="^(skip|update)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if mode not in ("skip", "update"):
        raise HTTPException(status_code=400, detail="Invalid mode")

    content = await file.read()
    parsed = parse_contact_file(content, filename=file.filename)

    # Use file extension as source
    source = "csv"
    if file.filename:
        ext = file.filename.split(".")[-1].lower()
        source = f"upload_{ext}"

    result = bulk_upsert_contacts(
        db=db,
        contacts=parsed["valid"],
        source=source,
        created_by_user_id=current_user.id,
        mode=mode,
    )

    return result
