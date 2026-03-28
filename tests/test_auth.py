from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base, get_db
from app.main import app
from app.models.user import User
from app.core.auth import get_password_hash
import pytest

# Use a SQLite in-memory database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(name="db_session")
def db_session_fixture():
    Base.metadata.create_all(bind=engine)  # Create tables
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine) # Drop tables after tests

@pytest.fixture(name="client")
def client_fixture(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def register_user(client: TestClient, email: str, password: str):
    response = client.post(
        "/auth/register",
        json={"email": email, "password": password}
    )
    return response

def verify_user_email(db_session, user_email: str):
    user = db_session.query(User).filter(User.email == user_email).first()
    if user:
        user.is_verified = True
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
    return user

def login_user(client: TestClient, email: str, password: str):
    response = client.post(
        "/auth/login",
        data={"username": email, "password": password}
    )
    return response

def test_register_user(client: TestClient):
    response = register_user(client, "test@example.com", "password")
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"
    assert response.json()["is_verified"] == False

def test_login_unverified_user(client: TestClient, db_session):
    register_user(client, "unverified@example.com", "password")
    
    response = login_user(client, "unverified@example.com", "password")
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "EMAIL_NOT_VERIFIED"

def test_login_verified_user(client: TestClient, db_session):
    register_user(client, "verified@example.com", "password")
    verify_user_email(db_session, "verified@example.com")

    response = login_user(client, "verified@example.com", "password")
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_access_protected_route_unverified_user(client: TestClient, db_session):
    register_user(client, "unverified_protected@example.com", "password")
    login_response = login_user(client, "unverified_protected@example.com", "password")
    
    # Even though login is blocked, if an old token existed, this should also block
    # For this test, we expect the login attempt to fail, so we can't get a token this way.
    # We will simulate an unverified user somehow getting a token (e.g., from an old session)
    # and then trying to access a protected route.
    
    # Manually create an unverified user and a token for them for testing get_current_user
    user = db_session.query(User).filter(User.email == "unverified_protected@example.com").first()
    assert user is not None
    assert user.is_verified == False

    # This token would normally be obtained from a successful login before the verification check was in place
    from app.core.auth import create_access_token
    token = create_access_token({"sub": user.email})

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "EMAIL_NOT_VERIFIED"
    assert response.json()["detail"]["message"] == "Your email is not verified."

def test_access_protected_route_verified_user(client: TestClient, db_session):
    register_user(client, "verified_protected@example.com", "password")
    verify_user_email(db_session, "verified_protected@example.com")
    
    login_response = login_user(client, "verified_protected@example.com", "password")
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "verified_protected@example.com"
    assert response.json()["is_verified"] == True

