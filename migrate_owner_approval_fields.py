import sqlalchemy
from app.core.database import engine


def migrate():
    with engine.connect() as conn:
        try:
            conn.execute(
                sqlalchemy.text(
                    """
                    ALTER TABLE users
                    ADD COLUMN IF NOT EXISTS owner_approved BOOLEAN NOT NULL DEFAULT FALSE
                    """
                )
            )
            print("Ensured 'owner_approved' column exists on 'users'.")
        except Exception as e:
            print(f"Failed to ensure 'owner_approved' column: {e}")

        try:
            conn.execute(
                sqlalchemy.text(
                    """
                    ALTER TABLE users
                    ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'PENDING'
                    """
                )
            )
            print("Ensured 'status' column exists on 'users'.")
        except Exception as e:
            print(f"Failed to ensure 'status' column: {e}")

        conn.commit()


if __name__ == "__main__":
    migrate()
