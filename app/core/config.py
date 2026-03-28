from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Database & Redis
    DATABASE_URL: str
    REDIS_URL: str

    # SMTP Configuration
    SMTP_HOST: str
    SMTP_PORT: int = 587
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    MAIL_FROM: str

    # Application
    BASE_URL: str
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    OWNER_APPROVAL_EMAIL: str | None = None
    AUTH_DISABLED: bool = False
    CAMPAIGN_RESTRICTIONS_DISABLED: bool = False
    
    # Auth
    SECRET_KEY: str = "supersecretkeychangeit"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

settings = Settings()
