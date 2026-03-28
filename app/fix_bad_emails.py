from app.core.database import SessionLocal
from app.models.contact import Contact
import re

def fix_bad_emails():
    db = SessionLocal()
    try:
        # valid email regex (simplified)
        # We look for anything that doesn't look like an email
        contacts = db.query(Contact).all()
        print(f"Checking {len(contacts)} contacts...")
        
        invalid_count = 0
        for c in contacts:
            if not c.email or '@' not in c.email:
                print(f"Found invalid email: id={c.id}, email='{c.email}'. Deleting...")
                db.delete(c)
                invalid_count += 1
        
        if invalid_count > 0:
            db.commit()
            print(f"Deleted {invalid_count} contacts with invalid emails.")
        else:
            print("No invalid emails found.")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_bad_emails()
