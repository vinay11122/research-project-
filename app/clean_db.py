from app.core.database import SessionLocal, engine
from sqlalchemy import text
from app.models import * 

def clean_db():
    db = SessionLocal()
    try:
        # We preserve Users.
        tables = [
            "email_links",
            "email_events",
            "email_replies",
            "emails",
            "sequence_queue",
            "campaign_contacts",
            "sequence_steps", 
            "sequences",
            "campaigns",
            "email_templates",
            "contacts",
        ]
        
        print("Cleaning database (Preserving Users)...")
        for table in tables:
            # Using TRUNCATE ... CASCADE to handle dependencies and reset IDs
            # This is efficient and correct for "cleaning" a Postgres DB
            try:
                print(f"Truncating {table}...")
                db.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;"))
            except Exception as e:
                # If table doesn't exist (e.g. fresh db), we can ignore
                print(f"Skipping {table}: {e}")
                
        db.commit()
        print("Database successfully cleaned!")
        
    except Exception as e:
        print(f"Error cleaning database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clean_db()
