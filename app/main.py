from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
import time
from sqlalchemy.exc import OperationalError
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

# SQLAlchemy Base + Engine
from app.core.database import Base, engine
from app.core.config import settings as app_settings

# Import all models so SQLAlchemy can register metadata
import app.models  

# Routers
from app.api.contacts import router as contacts_router
from app.api.contacts_bulk import router as contacts_bulk_router
from app.api.campaign_contacts import router as campaign_contacts_router
from app.api.sequence_steps import router as sequence_steps_router
from app.api.templates import router as templates_router
from app.api.email_test import router as email_test_router
from app.api.email_webhook import router as email_webhook_router
from app.api.analytics import router as analytics_router
from app.api.dashboard import router as dashboard_router
from app.api.campaigns import router as campaigns_router
from app.api import webhooks
from app.api import inbound
from app.api import unsubscribe
from app.api import track
from app.api import imports
from app.api import auth
from app.api import settings as settings_router
from app.api.track import router as open_track_router


from fastapi.staticfiles import StaticFiles
from app.api import media

# ---------------------------------------------------------
# 🚀 Initialize FastAPI App
# ---------------------------------------------------------
app = FastAPI(
    title="Averitas Outreach API",
    version="0.1.0",
    description="Backend API for investor outreach, automation, tracking, and campaign management.",
)

app.mount("/static", StaticFiles(directory="uploads"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# 🗄️ DATABASE STARTUP (Retries until Postgres is ready)
# ---------------------------------------------------------
for attempt in range(10):
    try:
        print("🔄 Trying to connect to DB and create tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Tables created successfully")
        break
    except OperationalError:
        print(f"⏳ DB not ready... retry {attempt + 1}/10")
        time.sleep(1)


# ---------------------------------------------------------
# 🔌 REGISTER ROUTERS
# ---------------------------------------------------------
app.include_router(auth.router)
app.include_router(settings_router.router)
app.include_router(contacts_router)
app.include_router(campaigns_router)
app.include_router(contacts_bulk_router)
app.include_router(campaign_contacts_router)
app.include_router(sequence_steps_router)
app.include_router(templates_router)
app.include_router(email_test_router)
app.include_router(email_webhook_router)
app.include_router(unsubscribe.router)
app.include_router(webhooks.router)
app.include_router(analytics_router)
app.include_router(dashboard_router)
app.include_router(track.router)
app.include_router(inbound.router)
app.include_router(imports.router)
app.include_router(media.router)


# ---------------------------------------------------------
# ❤️ HEALTH CHECK ENDPOINTS
# ---------------------------------------------------------
@app.get("/", tags=["health"])
async def root():
    return {"message": "Averitas Outreach API is running"}

@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}


@app.get("/metrics", tags=["health"])
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
