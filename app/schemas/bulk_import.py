from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class BulkImportSummary(BaseModel):
    uploaded: int
    success: int
    duplicates: int

class ImportError(BaseModel):
    row: int
    error: str
    data: Optional[Dict[str, Any]] = None

class ImportPreviewResponse(BaseModel):
    total_rows: int
    valid_count: int
    invalid_count: int
    duplicate_count: int
    valid_rows: List[Dict[str, Any]]
    invalid_rows: List[ImportError]
    duplicates: List[Dict[str, Any]]
    errors: Optional[List[str]] = None

class ImportCommitRequest(BaseModel):
    contacts: List[Dict[str, Any]]
    mode: str = "skip"  # skip | update

class SkippedContact(BaseModel):
    email: str
    external_id: Optional[str] = None
    reason: str

class ImportCommitResponse(BaseModel):
    inserted: int
    updated: int
    skipped: int
    errors: List[str]
    duplicates_in_batch: Optional[int] = None
    skipped_contacts: List[SkippedContact]