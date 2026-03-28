import shutil
import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.config import settings

router = APIRouter(prefix="/media", tags=["Media"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE_MB = 5
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".pdf"}

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload an image/file and return its URL.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file")

    # 1. Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}")

    # 2. Validate file size
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"File size exceeds {MAX_FILE_SIZE_MB}MB limit.")
    file.file.seek(0) # Reset file cursor to the beginning
    
    # Generate a unique filename to prevent collisions
    filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Construct the full URL
    # Assuming the app mounts 'uploads' at '/static'
    url = f"{settings.BASE_URL}/static/{filename}"
    
    return {"url": url}
