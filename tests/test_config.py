from app.core.config import Settings


def test_cors_origins_accepts_comma_separated_values():
    settings = Settings(
        DATABASE_URL="sqlite:///./test.db",
        REDIS_URL="redis://localhost:6379/0",
        SMTP_HOST="localhost",
        SMTP_USERNAME="",
        SMTP_PASSWORD="",
        MAIL_FROM="test@example.com",
        BASE_URL="http://localhost:8000",
        CORS_ORIGINS="http://frontend.example.com,http://34.12.1.2:3000",
    )

    assert settings.CORS_ORIGINS == [
        "http://frontend.example.com",
        "http://34.12.1.2:3000",
    ]
