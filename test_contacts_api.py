from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.contact import Contact
from app.schemas.contact import ContactRead

def test():
    db = SessionLocal()
    user_id = 2
    contacts = db.query(Contact).filter(Contact.user_id == user_id).all()
    print(f"Count: {len(contacts)}")
    for c in contacts:
        # Simulate Pydantic serialization
        out = ContactRead.from_orm(c)
        print(out.json())
    db.close()

if __name__ == "__main__":
    test()
