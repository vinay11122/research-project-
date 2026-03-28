import pandas as pd
from sqlalchemy.orm import Session
from app.models import Contact

class BulkImportService:

    @staticmethod
    def import_contacts(db: Session, file_path: str):
        df = pd.read_excel(file_path)

        required_cols = ["first_name", "last_name", "full_name", "company_name",
                         "title", "email", "email_confidence", "linkedin_url",
                         "category", "country", "city"]

        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"Missing required column: {col}")

        uploaded = len(df)
        success = 0
        duplicates = 0

        for _, row in df.iterrows():
            # Skip duplicates
            existing = db.query(Contact).filter(Contact.email == row["email"]).first()
            if existing:
                duplicates += 1
                continue

            contact = Contact(
                first_name=row["first_name"],
                last_name=row["last_name"],
                full_name=row["full_name"],
                company_name=row["company_name"],
                title=row["title"],
                email=row["email"],
                email_confidence=row["email_confidence"],
                linkedin_url=row["linkedin_url"],
                category=row["category"],
                country=row["country"],
                city=row["city"],
                is_active=True,
            )

            db.add(contact)
            success += 1

        db.commit()

        return {
            "uploaded": uploaded,
            "success": success,
            "duplicates": duplicates
        }

