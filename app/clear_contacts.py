import asyncio
import os
import sys
from sqlalchemy.orm import Session

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app.core.database import SessionLocal
from app.models.contact import Contact

async def clear_contacts():
    db: Session = SessionLocal()
    try:
        num_deleted = db.query(Contact).delete()
        db.commit()
        print(f"Deleted {num_deleted} contacts.")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(clear_contacts())
