from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

import pandas as pd

from app.core.database import get_db
from app.models.contact import Contact

from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/contacts", tags=["Contacts - Legacy Bulk Import"])




