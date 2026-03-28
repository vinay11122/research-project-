from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.auth import verify_password, get_password_hash, create_access_token, decode_access_token
from app.core.config import settings
from app.models.user import User
from app.models.password_reset_token import PasswordResetToken
from app.models.email_verification_token import EmailVerificationToken
from app.models.owner_approval_token import OwnerApprovalToken
from app.utils.transactional_email import send_password_reset_email, send_verification_email, send_owner_approval_email # Updated Import
import secrets
import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

# --- Pydantic Models ---

class UserRegister(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    is_active: bool
    is_verified: bool
    owner_approved: bool
    status: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class EmailSchema(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    token: str
    new_password: str

class RegisterResponse(BaseModel):
    message: str
    user: UserResponse

# --- Helper Functions ---

def create_verification_token(db: Session, user: User):
    token = secrets.token_urlsafe(32)
    expires = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    token_obj = EmailVerificationToken(user_id=user.id, token=token, expires_at=expires)
    db.add(token_obj)
    db.commit()
    db.refresh(token_obj) # Refresh to get ID if needed, though token string is returned
    return token_obj.token

def create_owner_approval_token(db: Session, user: User, action: str):
    token = secrets.token_urlsafe(32)
    expires = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    token_obj = OwnerApprovalToken(user_id=user.id, token=token, expires_at=expires, action=action)
    db.add(token_obj)
    db.commit()
    db.refresh(token_obj) # Refresh to get ID if needed
    return token_obj.token

def create_password_reset_token(db: Session, user: User):
    token = secrets.token_urlsafe(32)
    expires = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    token_obj = PasswordResetToken(user_id=user.id, token=token, expires_at=expires)
    db.add(token_obj)
    db.commit()
    db.refresh(token_obj) # Refresh to get ID if needed
    return token_obj.token

# --- Dependencies ---

def _get_or_create_mock_user(db: Session) -> User:
    user = db.query(User).order_by(User.id.asc()).first()
    if user:
        if user.status != 'ACTIVE' or not user.is_verified or not user.owner_approved:
            user.status = 'ACTIVE'
            user.is_verified = True
            user.owner_approved = True
            user.is_active = True
            db.commit()
            db.refresh(user)
        return user

    user = User(
        email="mock.user@averitas.local",
        password_hash=get_password_hash("mock-password"),
        is_active=True,
        is_verified=True,
        owner_approved=True,
        status='ACTIVE'
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if settings.AUTH_DISABLED:
        return _get_or_create_mock_user(db)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email: str = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # The login check will now be stricter for active status
    if user.status != 'ACTIVE':
        detail_msg = "Your account is not active. Please verify your email and await owner approval."
        if not user.is_verified:
            detail_msg = "Your email is not verified."
        elif not user.owner_approved:
            detail_msg = "Your account is awaiting owner approval."
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ACCOUNT_NOT_ACTIVE", "message": detail_msg}
        )
    return user

# --- Endpoints ---

@router.post("/register", response_model=RegisterResponse)
def register(payload: UserRegister, request: Request, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == payload.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        owner_approved=False,
        status='PENDING'
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate owner approval tokens
    approve_token = create_owner_approval_token(db, new_user, action='approve')
    reject_token = create_owner_approval_token(db, new_user, action='reject')
    
    # Generate user verification token
    user_verification_token = create_verification_token(db, new_user)

    send_owner_approval_email(new_user=new_user, approve_token=approve_token, reject_token=reject_token)
    send_verification_email(user=new_user, token=user_verification_token)
    
    return {
        "message": "Registration successful. An owner approval is required and you will need to verify your email.",
        "user": new_user
    }

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Simplified check using the new status field
    if user.status != 'ACTIVE':
        detail_msg = "Your account is not active. Please verify your email and await owner approval."
        if not user.is_verified:
            detail_msg = "Your email is not verified."
        elif not user.owner_approved:
            detail_msg = "Your account is awaiting owner approval."
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ACCOUNT_NOT_ACTIVE", "message": detail_msg}
        )

    access_token = create_access_token({"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/resend-verification-email")
def resend_verification_email(
    payload: EmailSchema,
    db: Session = Depends(get_db),
):
    # Do not require auth here; unverified users cannot access protected routes.
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        return {"message": "If an account exists for this email, a verification email has been sent."}

    if user.is_verified:
        return {"message": "Email already verified"}

    # Optional: delete old tokens for this user
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id
    ).delete()
    db.commit()

    token = create_verification_token(db, user)
    send_verification_email(user=user, token=token)
    return {"message": "Verification email sent"}

@router.get("/verify-email/{token}")
def verify_email(token: str, db: Session = Depends(get_db)):
    token_obj = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.token == token
    ).first()

    if not token_obj:
        raise HTTPException(status_code=400, detail="Invalid token")

    if token_obj.expires_at < datetime.datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")

    user = db.query(User).filter(User.id == token_obj.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    user.is_verified = True
    # If owner has already approved, activate the account
    if user.owner_approved:
        user.status = 'ACTIVE'
    db.delete(token_obj)
    db.commit()
    return {"message": "Email verified successfully"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# --- Owner Approval Endpoints ---

@router.get("/approvals/user-create/approve")
def approve_user_creation(token: str, db: Session = Depends(get_db)):
    token_obj = db.query(OwnerApprovalToken).filter(
        OwnerApprovalToken.token == token,
        OwnerApprovalToken.action == 'approve'
    ).first()

    if not token_obj:
        raise HTTPException(status_code=400, detail="Invalid or already used approval token")

    if token_obj.expires_at < datetime.datetime.utcnow():
        db.delete(token_obj) # Delete expired token
        db.commit()
        raise HTTPException(status_code=400, detail="Approval token expired")

    user = db.query(User).filter(User.id == token_obj.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found for this token")

    user.owner_approved = True
    # If user is also verified, activate the account
    if user.is_verified:
        user.status = 'ACTIVE'
    
    # Invalidate all owner approval tokens for this user
    db.query(OwnerApprovalToken).filter(OwnerApprovalToken.user_id == user.id).delete()
    db.commit()
    return {"message": f"User {user.email} approved successfully. Account status: {user.status}"}

@router.get("/approvals/user-create/reject")
def reject_user_creation(token: str, db: Session = Depends(get_db)):
    token_obj = db.query(OwnerApprovalToken).filter(
        OwnerApprovalToken.token == token,
        OwnerApprovalToken.action == 'reject'
    ).first()

    if not token_obj:
        raise HTTPException(status_code=400, detail="Invalid or already used rejection token")

    if token_obj.expires_at < datetime.datetime.utcnow():
        db.delete(token_obj) # Delete expired token
        db.commit()
        raise HTTPException(status_code=400, detail="Rejection token expired")

    user = db.query(User).filter(User.id == token_obj.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found for this token")

    user.status = 'REJECTED'
    
    # Invalidate all owner approval tokens and email verification tokens for this user
    db.query(OwnerApprovalToken).filter(OwnerApprovalToken.user_id == user.id).delete()
    db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).delete()
    db.commit()
    return {"message": f"User {user.email} rejected. Account status: {user.status}"}
