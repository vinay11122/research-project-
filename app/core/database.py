from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import settings

# SQLAlchemy Engine
engine = create_engine(
    settings.DATABASE_URL,
    future=True,
    echo=False,  # set True for SQL logging during debugging
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)

# Base class for all models
Base = declarative_base()


# Dependency for FastAPI routes (we'll use this later)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

