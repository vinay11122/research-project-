import sqlalchemy
from app.core.database import engine

def migrate():
    with engine.connect() as conn:
        try:
            conn.execute(sqlalchemy.text("ALTER TABLE campaigns ADD COLUMN start_at TIMESTAMP WITH TIME ZONE NULL"))
            print("Successfully added 'start_at' column to 'campaigns' table.")
        except Exception as e:
            print(f"Migration failed (might already exist): {e}")

if __name__ == "__main__":
    migrate()
