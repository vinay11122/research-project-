# backend/app/services/imports/contact_bulk_upsert.py

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime, timezone

from app.models.contact import Contact


from app.utils.email_validation import BLOCKED_DOMAINS


def bulk_upsert_contacts(
    db: Session,
    contacts: list[dict],
    *,
    source: str = "csv",
    created_by_user_id: int | None = None,
    mode: str = "skip",  # skip | update
) -> dict:
    result = {
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "errors": [],
        "skipped_contacts": [],
    }

    if not contacts:
        return result
    
    now = datetime.now(timezone.utc)

    # Standardize data: ensure company mapping and full_name
    valid_contacts = []
    for idx, c in enumerate(contacts):
        try:
            # Normalize company and linkedin
            if "company" in c and "company_name" not in c:
                c["company_name"] = c.pop("company")
            elif "company" in c:
                c.pop("company")
            
            if "linkedin" in c and "linkedin_url" not in c:
                c["linkedin_url"] = c.pop("linkedin")
            elif "linkedin" in c:
                c.pop("linkedin")

            if "full_name" not in c:
                c["full_name"] = f"{c.get('first_name', '')} {c.get('last_name', '')}".strip()
            
            # Ensure all required fields are present
            c.setdefault("company_name", "no company name")
            c.setdefault("linkedin_url", None)
            c.setdefault("title", None)
            c.setdefault("first_name", None)
            c.setdefault("last_name", None)
            c.setdefault("external_id", None)
            c.setdefault("category", None)
            c.setdefault("country", None)
            c.setdefault("city", None)
            c.setdefault("email_confidence", None)
            c.setdefault("is_active", True)


            valid_contacts.append(c)
        except Exception as e:
            result["errors"].append(f"Row {idx+1}: {str(e)}")

    if not valid_contacts:
        return result

    emails = [c["email"] for c in valid_contacts]
    external_ids = [c["external_id"] for c in valid_contacts if c.get("external_id")]

    # Pre-fetch existing contacts by email OR external_id for this user
    query = db.query(Contact).filter(Contact.user_id == created_by_user_id)
    
    # We need an OR condition: email IN (...) OR external_id IN (...)
    from sqlalchemy import or_
    conditions = [Contact.email.in_(emails)]
    if external_ids:
        conditions.append(Contact.external_id.in_(external_ids))
    
    query = query.filter(or_(*conditions))
        
    existing_records = query.all()
    
    # Create lookups
    existing_by_email = {c.email.lower(): c for c in existing_records}
    existing_by_ext_id = {c.external_id: c for c in existing_records if c.external_id}

    # Track processed records in this batch to handle duplicates within the import file
    processed_records = set()

    try:
        for data in valid_contacts:
            import logging
            logging.info(f"Processing contact: {data}")
            email = data["email"]
            ext_id = data.get("external_id")

            # Intra-batch deduplication
            if (email, ext_id) in processed_records:
                result["duplicates_in_batch"] = result.get("duplicates_in_batch", 0) + 1
                result["skipped_contacts"].append({"email": email, "external_id": ext_id, "reason": "duplicate_in_batch"})
                continue
            processed_records.add((email, ext_id))

            # --- MATCHING LOGIC ---
            match = None

            # 1. Match by External ID (Priority)
            if ext_id and ext_id in existing_by_ext_id:
                match = existing_by_ext_id[ext_id]
            
            # 2. Check for Email Collision / Fallback Match
            if not match and email in existing_by_email:
                potential_match = existing_by_email[email]
                
                if ext_id:
                    # We have an ID, but didn't find it in DB. However, email was found.
                    if potential_match.external_id and potential_match.external_id != ext_id:
                        # Email exists on a record with a DIFFERENT ID.
                        # Rule: "If External_ID is different -> NEVER merge"
                        # But we can't insert because email is unique.
                        result["errors"].append(
                            f"Email '{email}' is already used by contact with External ID '{potential_match.external_id}'"
                        )
                        result["skipped_contacts"].append({"email": email, "external_id": ext_id, "reason": "email_exists_with_different_external_id"})
                        continue
                    elif not potential_match.external_id:
                        # Email exists, and it has NO external_id.
                        # We claim this record (Hydrate ID).
                        match = potential_match
                else:
                    # No external ID provided. Fallback to Email Match.
                    match = potential_match

            # --- UPSERT ---
            if match:
                if mode == "update":
                    for key, value in data.items():
                        setattr(match, key, value)
                    match.updated_at = now
                    result["updated"] += 1
                else:
                    result["skipped"] += 1
                    result["skipped_contacts"].append({"email": email, "reason": "skipped_existing_contact"})
                continue

            # Insert new
            contact = Contact(
                **data,
                source=source,
                user_id=created_by_user_id,
                created_by_user_id=created_by_user_id,
                created_at=now,
                updated_at=now,
            )

            db.add(contact)
            db.flush() # Send the INSERT to the DB to catch potential errors
            result["inserted"] += 1

        db.commit()

    except SQLAlchemyError as e:
        db.rollback()
        import logging
        logging.exception("Database error during bulk upsert")
        result["errors"].append(f"Database error: {str(e)}")

    return result
