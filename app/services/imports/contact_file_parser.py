# backend/app/services/imports/contact_file_parser.py

import io
import re
import pandas as pd
from typing import Dict, List, Any
import logging

# Optional dependencies
try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    from docx import Document
except ImportError:
    Document = None


logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")

REQUIRED_FIELDS = {"email", "first_name", "last_name"}
OPTIONAL_FIELDS = {
    "company_name",
    "title",
    "linkedin",
    "category",
    "country",
    "city",
    "external_id",
}

ALL_FIELDS = REQUIRED_FIELDS | OPTIONAL_FIELDS

HEADER_MAPPING = {
    "firstname": "first_name",
    "first name": "first_name",
    "lastname": "last_name",
    "last name": "last_name",
    "companyname": "company_name",
    "company name": "company_name",
    "linkedinurl": "linkedin",
    "linkedin url": "linkedin",
    "emailaddress": "email",
    "email address": "email",
    "company_name": "company_name",
    "external_id": "external_id",
    "externalid": "external_id",
    "external id": "external_id",
    "reference_id": "external_id",
    "reference id": "external_id",
    "contact_uid": "external_id",
}

def normalize(value) -> str | None:
    if pd.isna(value) or value is None:
        return None
    s = str(value).strip()
    return s if s else None


def is_valid_email(email: str) -> bool:
    # Use a slightly stricter check for the actual validation phase
    # The regex above is for discovery
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))



def parse_pdf(file_bytes: bytes) -> pd.DataFrame:
    if not pdfplumber:
        raise ImportError("PDF parsing requires the 'pdfplumber' library. Please install it.")
    
    rows = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue
                rows.extend(table)
    
    if not rows:
        # Fallback: extract text and try to find emails (unstructured)
        # This is very basic.
        text = ""
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
        
        # Try to find emails
        emails = EMAIL_REGEX.findall(text)
        # Without headers/structure, we can't reliably get names/companies from unstructured text
        # So we return empty or just emails? Better to return a DataFrame with what we found.
        return pd.DataFrame([{"email": e} for e in emails])

    # Convert table rows to DataFrame
    # Assume first row is header if it contains 'email'
    header = [str(c).lower().strip() if c else "" for c in rows[0]]
    if any("email" in h for h in header):
        df = pd.DataFrame(rows[1:], columns=header)
    else:
        df = pd.DataFrame(rows)
    
    return df


def parse_docx(file_bytes: bytes) -> pd.DataFrame:
    if not Document:
        raise ImportError("DOCX parsing requires the 'python-docx' library. Please install it.")
    
    doc = Document(io.BytesIO(file_bytes))
    all_data = []
    
    for table in doc.tables:
        rows = []
        for row in table.rows:
            rows.append([cell.text.strip() for cell in row.cells])
        
        if not rows:
            continue
            
        header = [str(c).lower().strip() for c in rows[0]]
        if any("email" in h for h in header):
            df = pd.DataFrame(rows[1:], columns=header)
        else:
            df = pd.DataFrame(rows)
        all_data.append(df)
    
    if all_data:
        return pd.concat(all_data, ignore_index=True)
    
    # Fallback: paragraphs
    text = "\n".join([p.text for p in doc.paragraphs])
    emails = EMAIL_REGEX.findall(text)
    return pd.DataFrame([{"email": e} for e in emails])


def parse_contact_file(file_bytes: bytes, filename: str) -> Dict:
    filename = filename.lower()
    df = pd.DataFrame()
    
    try:
        if filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(file_bytes))
        elif filename.endswith(".pdf"):
            df = parse_pdf(file_bytes)
        elif filename.endswith((".docx", ".doc")):
            df = parse_docx(file_bytes)
        elif filename.endswith(".csv"):
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin-1")
        else:
            raise ValueError(f"Unsupported file type: {filename}. Please use .xlsx, .xls, .pdf, .docx, or .csv.")
    except ImportError as e:
        logger.error(f"Missing dependency for file type {filename}: {str(e)}")
        return {
            "total_rows": 0,
            "valid": [],
            "invalid": [],
            "duplicates": [],
            "errors": [f"Missing dependency for parsing {filename}: {str(e)}"]
        }
    except Exception as e:
        logger.error(f"Error parsing file {filename}: {str(e)}")
        return {
            "total_rows": 0,
            "valid": [],
            "invalid": [],
            "duplicates": [],
            "errors": [f"File read error: {str(e)}"]
        }

    if df.empty:
        return {
            "total_rows": 0,
            "valid": [],
            "invalid": [],
            "duplicates": [],
            "errors": ["File is empty or no data could be extracted."]
        }

    # Normalize headers
    df.columns = [str(c).strip().lower() for c in df.columns]
    df.rename(columns=HEADER_MAPPING, inplace=True)

    # Check for header
    has_header = any(h in ALL_FIELDS for h in df.columns)

    seen_emails = set()
    seen_external_ids = set()

    result = {
        "total_rows": 0,
        "valid": [],
        "invalid": [],
        "duplicates": [],
        "errors": []
    }

    for index, row_series in df.iterrows():
        row_num = index + (2 if has_header else 1)
        result["total_rows"] += 1
        
        row_data = {}
        for field in ALL_FIELDS:
            if field in df.columns:
                row_data[field] = normalize(row_series[field])
            else:
                row_data[field] = None

        if not any(row_data.values()):
            continue

        # Required fields check
        missing = [f for f in REQUIRED_FIELDS if not row_data.get(f)]
        if missing:
            result["invalid"].append({
                "row": row_num,
                "error": f"Missing required fields: {', '.join(missing)}",
                "data": row_data
            })
            continue

        email = str(row_data["email"]).lower() if row_data.get("email") else ""
        ext_id = row_data.get("external_id")

        if not is_valid_email(email):
            result["invalid"].append({
                "row": row_num,
                "error": "Invalid email format",
                "data": row_data
            })
            continue

        # --- DEDUPLICATION LOGIC ---
        is_duplicate = False
        if ext_id:
            if ext_id in seen_external_ids:
                is_duplicate = True
            seen_external_ids.add(ext_id)
        else:
            if email in seen_emails:
                is_duplicate = True
        
        # We always track email even if ID is present for future fallback lookups
        seen_emails.add(email)

        if is_duplicate:
            result["duplicates"].append({
                "row": row_num,
                "email": email,
                "external_id": ext_id
            })
            continue

        row_data["email"] = email
        row_data["full_name"] = f"{row_data.get('first_name') or ''} {row_data.get('last_name') or ''}".strip()
        
        result["valid"].append(row_data)

    return result
