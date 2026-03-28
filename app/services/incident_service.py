from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.observability.metrics import INCIDENTS_OPENED_TOTAL, INCIDENTS_RESOLVED_TOTAL


SOURCE_SMTP_SEND = "smtp_send"
SOURCE_PROVIDER_DELIVERY = "provider_delivery"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _campaign_filter(query, campaign_id: int | None):
    if campaign_id is None:
        return query.filter(Incident.campaign_id.is_(None))
    return query.filter(Incident.campaign_id == campaign_id)


def open_or_update_incident(
    *,
    db: Session,
    user_id: int,
    source: str,
    title: str,
    campaign_id: int | None = None,
    started_at: datetime | None = None,
    detected_at: datetime | None = None,
    details: str | None = None,
) -> Incident:
    now = _utcnow()
    start_time = started_at or now
    detect_time = detected_at or now

    query = db.query(Incident).filter(
        Incident.user_id == user_id,
        Incident.source == source,
        Incident.status == "open",
    )
    query = _campaign_filter(query, campaign_id)
    incident = query.order_by(Incident.started_at.asc()).first()

    if incident:
        incident.last_seen_at = detect_time
        incident.occurrence_count = (incident.occurrence_count or 0) + 1
        if details:
            incident.details = details
        return incident

    incident = Incident(
        user_id=user_id,
        campaign_id=campaign_id,
        source=source,
        status="open",
        title=title,
        details=details,
        started_at=start_time,
        detected_at=detect_time,
        last_seen_at=detect_time,
        occurrence_count=1,
    )
    db.add(incident)
    INCIDENTS_OPENED_TOTAL.labels(source=source).inc()
    return incident


def resolve_open_incidents(
    *,
    db: Session,
    user_id: int,
    source: str,
    campaign_id: int | None = None,
    resolved_at: datetime | None = None,
) -> int:
    end_time = resolved_at or _utcnow()
    query = db.query(Incident).filter(
        Incident.user_id == user_id,
        Incident.source == source,
        Incident.status == "open",
    )
    query = _campaign_filter(query, campaign_id)
    incidents = query.all()

    for incident in incidents:
        incident.status = "resolved"
        if incident.detected_at is None:
            incident.detected_at = incident.started_at
        incident.resolved_at = end_time
        incident.last_seen_at = end_time

    if incidents:
        INCIDENTS_RESOLVED_TOTAL.labels(source=source).inc(len(incidents))

    return len(incidents)
