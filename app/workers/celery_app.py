from celery import Celery
import os
from prometheus_client import start_http_server
from app.core.config import settings

REDIS_URL = settings.REDIS_URL

_metrics_started = False


def start_metrics_server_once():
    global _metrics_started
    if _metrics_started:
        return
    port = int(os.getenv("METRICS_PORT", "9101"))
    start_http_server(port, addr="0.0.0.0")
    _metrics_started = True


start_metrics_server_once()

celery_app = Celery(
    "averitas_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

# Celery timezone
celery_app.conf.timezone = "UTC"

# Celery Beat schedule
celery_app.conf.beat_schedule = {
    "run-scheduler-every-2s": {
        "task": "app.workers.scheduler.scheduler_tick",
        "schedule": 2.0,
    }
}

# IMPORTANT: Manual imports (fixes Docker path issues)
import app.workers.tasks
import app.workers.scheduler
import app.workers.email_sender
