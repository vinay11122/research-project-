from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text, func, cast, DATE, and_
from typing import List, Optional

from app.core.database import get_db
from app.models.email import EmailReply, Email, EmailEvent
from app.models.campaign import Campaign, Sequence, CampaignContact
from app.models.sequence_step import SequenceStep
from app.models.sequence_queue import SequenceQueue
from app.models.incident import Incident
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/analytics",
    tags=["Campaign Analytics"]
)

# --- Pydantic Schemas for Responses ---
class EventCount(BaseModel):
    event_type: str
    count: int

class EventDetail(BaseModel):
    id: int
    event_type: str
    occurred_at: datetime
    email_id: int
    # Add other relevant fields if needed

class CampaignAnalyticsRead(BaseModel):
    campaign_id: int
    campaign_name: str
    sent: int
    opened: int
    clicked: int
    replied: int
    unsubscribed: int
    pending: int
    bounced: int
    complained: int
    open_rate: float
    reply_rate: float
    bounce_rate: float
    complaint_rate: float


class ReliabilityMetricsRead(BaseModel):
    window_days: int
    incidents_total: int
    incidents_open: int
    incidents_resolved: int
    mttr_minutes: Optional[float]
    mttd_minutes: Optional[float]


# --- Endpoints ---

@router.get("/global")
def get_global_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Aggregate metrics for the user's entire account.
    """
    stats_sql = text("""
        SELECT
            COUNT(*) AS total_campaigns,
            COUNT(*) FILTER (WHERE status = 'running') AS running_campaigns,
            COUNT(*) FILTER (WHERE status = 'paused') AS paused_campaigns,
            (SELECT COUNT(*) FROM contacts WHERE user_id = :user_id) AS total_contacts,
            (SELECT COUNT(*) FROM sequence_queue sq JOIN campaigns c ON c.id = sq.campaign_id WHERE c.user_id = :user_id AND sq.status = 'pending') AS pending_queue,
            (SELECT COUNT(*) FROM emails e WHERE e.user_id = :user_id) AS total_emails_sent,
            (SELECT COUNT(*) FROM email_events ee WHERE ee.user_id = :user_id AND ee.event_type = 'bounce') AS total_bounced,
            (SELECT COUNT(*) FROM email_events ee WHERE ee.user_id = :user_id AND ee.event_type = 'complaint') AS total_complained,
            (SELECT COUNT(*) FROM email_events ee WHERE ee.user_id = :user_id AND ee.event_type = 'open') AS total_opened,
            (SELECT COUNT(*) FROM email_events ee WHERE ee.user_id = :user_id AND ee.event_type = 'click') AS total_clicked,
            (SELECT COUNT(*) FROM email_replies er JOIN emails e ON e.id = er.email_id WHERE e.user_id = :user_id) AS total_replied
        FROM campaigns
        WHERE user_id = :user_id
    """)
    
    res = db.execute(stats_sql, {"user_id": current_user.id}).mappings().first()
    
    # Calculate global rates
    total_emails_sent = res["total_emails_sent"] or 0
    data = dict(res)
    data["open_rate"] = round((data["total_opened"] / total_emails_sent * 100), 1) if total_emails_sent > 0 else 0
    data["reply_rate"] = round((data["total_replied"] / total_emails_sent * 100), 1) if total_emails_sent > 0 else 0
    data["bounce_rate"] = round((data["total_bounced"] / total_emails_sent * 100), 1) if total_emails_sent > 0 else 0
    data["complaint_rate"] = round((data["total_complained"] / total_emails_sent * 100), 1) if total_emails_sent > 0 else 0

    return data


@router.get("/reliability", response_model=ReliabilityMetricsRead)
def get_reliability_metrics(
    campaign_id: Optional[int] = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    MTTR/MTTD over the selected time window.
    - MTTD: average(detected_at - started_at)
    - MTTR: average(resolved_at - detected_at)
    """
    window_start = datetime.now(timezone.utc) - timedelta(days=days)

    incidents_query = db.query(Incident).filter(
        Incident.user_id == current_user.id,
        Incident.started_at >= window_start,
    )

    if campaign_id is not None:
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.user_id == current_user.id,
        ).first()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        incidents_query = incidents_query.filter(Incident.campaign_id == campaign_id)

    incidents = incidents_query.all()
    detection_minutes: list[float] = []
    repair_minutes: list[float] = []

    for incident in incidents:
        if incident.detected_at and incident.started_at:
            delta_detection = (incident.detected_at - incident.started_at).total_seconds() / 60
            detection_minutes.append(max(delta_detection, 0.0))
        if incident.resolved_at and incident.detected_at:
            delta_repair = (incident.resolved_at - incident.detected_at).total_seconds() / 60
            repair_minutes.append(max(delta_repair, 0.0))

    mttr = round(sum(repair_minutes) / len(repair_minutes), 2) if repair_minutes else None
    mttd = round(sum(detection_minutes) / len(detection_minutes), 2) if detection_minutes else None

    incidents_open = sum(1 for i in incidents if i.status == "open")
    incidents_resolved = sum(1 for i in incidents if i.status == "resolved")

    return ReliabilityMetricsRead(
        window_days=days,
        incidents_total=len(incidents),
        incidents_open=incidents_open,
        incidents_resolved=incidents_resolved,
        mttr_minutes=mttr,
        mttd_minutes=mttd,
    )


@router.get("/campaigns/{campaign_id}/trend")
def get_campaign_trend(
    campaign_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get reply trend (count per day) for a campaign.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    trend_sql = text("""
        SELECT 
            TO_CHAR(er.reply_at, 'Mon DD') as date,
            COUNT(DISTINCT er.id) as replies
        FROM email_replies er
        WHERE er.campaign_id = :campaign_id
        GROUP BY TO_CHAR(er.reply_at, 'Mon DD'), DATE_TRUNC('day', er.reply_at)
        ORDER BY DATE_TRUNC('day', er.reply_at) ASC
    """)
    
    rows = db.execute(trend_sql, {"campaign_id": campaign_id}).mappings().all()
    return [dict(r) for r in rows]


@router.get("/campaigns", response_model=List[CampaignAnalyticsRead])
def get_campaign_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Campaign-level analytics overview for the list view.
    Includes bounce and complaint rates.
    """

    sql = text("""
        SELECT
            c.id AS campaign_id,
            c.name AS campaign_name,
            (SELECT COUNT(*) FROM emails e WHERE e.campaign_id = c.id AND e.user_id = :user_id) AS sent,
            (SELECT COUNT(DISTINCT ev.email_id) FROM email_events ev JOIN emails e ON e.id = ev.email_id WHERE e.campaign_id = c.id AND ev.event_type = 'open' AND e.user_id = :user_id) AS opened,
            (SELECT COUNT(DISTINCT ev.email_id) FROM email_events ev JOIN emails e ON e.id = ev.email_id WHERE e.campaign_id = c.id AND ev.event_type = 'click' AND e.user_id = :user_id) AS clicked,
            (SELECT COUNT(*) FROM email_replies er JOIN emails e ON e.id = er.email_id WHERE e.campaign_id = c.id AND e.user_id = :user_id) AS replied,
            (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id AND cc.unsubscribed = true) AS unsubscribed,
            (SELECT COUNT(*) FROM sequence_queue sq WHERE sq.campaign_id = c.id AND sq.status = 'pending' AND sq.contact_id IN (SELECT id FROM contacts WHERE user_id = :user_id)) AS pending,
            (SELECT COUNT(DISTINCT ev.email_id) FROM email_events ev JOIN emails e ON e.id = ev.email_id WHERE e.campaign_id = c.id AND ev.event_type = 'bounce' AND e.user_id = :user_id) AS bounced,
            (SELECT COUNT(DISTINCT ev.email_id) FROM email_events ev JOIN emails e ON e.id = ev.email_id WHERE e.campaign_id = c.id AND ev.event_type = 'complaint' AND e.user_id = :user_id) AS complained
        FROM campaigns c
        WHERE c.user_id = :user_id
        ORDER BY c.id
    """)

    rows = db.execute(sql, {"user_id": current_user.id}).mappings().all()

    response_campaigns = []
    for r in rows:
        data = dict(r)
        sent = data["sent"] or 0
        data["open_rate"] = round((data["opened"] / sent * 100), 1) if sent > 0 else 0
        data["reply_rate"] = round((data["replied"] / sent * 100), 1) if sent > 0 else 0
        data["bounce_rate"] = round((data["bounced"] / sent * 100), 1) if sent > 0 else 0
        data["complaint_rate"] = round((data["complained"] / sent * 100), 1) if sent > 0 else 0
        response_campaigns.append(data)

    return response_campaigns


@router.get("/campaigns/{campaign_id}/overview", response_model=CampaignAnalyticsRead)
def get_campaign_overview(
    campaign_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Per-campaign metrics: sent, opened, clicked, replied, unsubscribed, pending, bounced, complained.
    """
    sql = text("""
        SELECT
            c.id AS campaign_id,
            c.name AS campaign_name,
            (SELECT COUNT(*) FROM emails e WHERE e.campaign_id = c.id AND e.user_id = :user_id) AS sent,
            (SELECT COUNT(DISTINCT ev.email_id) FROM email_events ev JOIN emails e ON e.id = ev.email_id WHERE e.campaign_id = c.id AND ev.event_type = 'open' AND e.user_id = :user_id) AS opened,
            (SELECT COUNT(DISTINCT ev.email_id) FROM email_events ev JOIN emails e ON e.id = ev.email_id WHERE e.campaign_id = c.id AND ev.event_type = 'click' AND e.user_id = :user_id) AS clicked,
            (SELECT COUNT(*) FROM email_replies er JOIN emails e ON e.id = er.email_id WHERE e.campaign_id = c.id AND e.user_id = :user_id) AS replied,
            (SELECT COUNT(*) FROM campaign_contacts cc WHERE cc.campaign_id = c.id AND cc.unsubscribed = true) AS unsubscribed,
            (SELECT COUNT(*) FROM sequence_queue sq WHERE sq.campaign_id = c.id AND sq.status = 'pending' AND sq.contact_id IN (SELECT id FROM contacts WHERE user_id = :user_id)) AS pending,
            (SELECT COUNT(DISTINCT ev.email_id) FROM email_events ev JOIN emails e ON e.id = ev.email_id WHERE e.campaign_id = c.id AND ev.event_type = 'bounce' AND e.user_id = :user_id) AS bounced,
            (SELECT COUNT(DISTINCT ev.email_id) FROM email_events ev JOIN emails e ON e.id = ev.email_id WHERE e.campaign_id = c.id AND ev.event_type = 'complaint' AND e.user_id = :user_id) AS complained
        FROM campaigns c
        WHERE c.id = :campaign_id AND c.user_id = :user_id
    """)

    row = db.execute(sql, {"campaign_id": campaign_id, "user_id": current_user.id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")

    res = dict(row)
    sent = res["sent"] or 0
    res["open_rate"] = round((res["opened"] / sent * 100), 1) if sent > 0 else 0
    res["reply_rate"] = round((res["replied"] / sent * 100), 1) if sent > 0 else 0
    res["bounce_rate"] = round((res["bounced"] / sent * 100), 1) if sent > 0 else 0
    res["complaint_rate"] = round((res["complained"] / sent * 100), 1) if sent > 0 else 0
    
    return res


@router.get("/campaigns/{campaign_id}/steps")
def get_campaign_steps(
    campaign_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step-level metrics for a campaign.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    steps_sql = text("""
        SELECT
            ss.step_number,
            ss.subject AS template_name,
            (SELECT COUNT(*) FROM emails e WHERE e.sequence_step_id = ss.id AND e.user_id = :user_id) AS sent,
            (SELECT COUNT(DISTINCT ev.email_id) FROM email_events ev JOIN emails e ON e.id = ev.email_id WHERE e.sequence_step_id = ss.id AND ev.event_type = 'open' AND e.user_id = :user_id) AS opened,
            (SELECT COUNT(DISTINCT ev.email_id) FROM email_events ev JOIN emails e ON e.id = ev.email_id WHERE e.sequence_step_id = ss.id AND ev.event_type = 'click' AND e.user_id = :user_id) AS clicked,
            (SELECT COUNT(*) FROM email_replies er JOIN emails e ON e.id = er.email_id WHERE e.sequence_step_id = ss.id AND e.user_id = :user_id) AS replied,
            (SELECT COUNT(DISTINCT ev.email_id) FROM email_events ev JOIN emails e ON e.id = ev.email_id WHERE e.sequence_step_id = ss.id AND ev.event_type = 'bounce' AND e.user_id = :user_id) AS bounced,
            (SELECT COUNT(DISTINCT ev.email_id) FROM email_events ev JOIN emails e ON e.id = ev.email_id WHERE e.sequence_step_id = ss.id AND ev.event_type = 'complaint' AND e.user_id = :user_id) AS complained
        FROM sequence_steps ss
        JOIN sequences s ON ss.sequence_id = s.id
        WHERE s.campaign_id = :campaign_id
        ORDER BY ss.step_number ASC
    """)

    rows = db.execute(steps_sql, {"campaign_id": campaign_id, "user_id": current_user.id}).mappings().all()
    
    response_steps = []
    for r in rows:
        data = dict(r)
        sent = data["sent"] or 0
        data["open_rate"] = round((data["opened"] / sent * 100), 1) if sent > 0 else 0
        data["reply_rate"] = round((data["replied"] / sent * 100), 1) if sent > 0 else 0
        data["bounce_rate"] = round((data["bounced"] / sent * 100), 1) if sent > 0 else 0
        data["complaint_rate"] = round((data["complained"] / sent * 100), 1) if sent > 0 else 0
        response_steps.append(data)
    
    return response_steps


@router.get("/campaigns/{campaign_id}/replies")
def get_campaign_replies(
    campaign_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get recent replies for a specific campaign.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    sql = text("""
        SELECT 
            c.email AS contact_email,
            er.reply_at AS received_at,
            er.reply_text AS snippet
        FROM email_replies er
        JOIN contacts c ON c.id = er.contact_id
        WHERE er.campaign_id = :campaign_id
        AND er.campaign_id IN (SELECT id FROM campaigns WHERE user_id = :user_id)
        ORDER BY er.reply_at DESC
        LIMIT 10
    """)
    
    rows = db.execute(sql, {"campaign_id": campaign_id, "user_id": current_user.id}).mappings().all()
    return [dict(r) for r in rows]


@router.get("/global/events", response_model=List[EventCount])
def get_global_event_counts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get aggregated counts of all email events (open, click, bounce, complaint, delivered) for the user's workspace.
    """
    counts = db.query(
        EmailEvent.event_type,
        func.count(EmailEvent.id)
    ).filter(EmailEvent.user_id == current_user.id).group_by(EmailEvent.event_type).all()
    
    return [{"event_type": c[0], "count": c[1]} for c in counts]


@router.get("/campaigns/{campaign_id}/events", response_model=List[EventCount])
def get_campaign_event_counts(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get aggregated counts of email events for a specific campaign.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    counts = db.query(
        EmailEvent.event_type,
        func.count(EmailEvent.id)
    ).filter(
        EmailEvent.user_id == current_user.id,
        EmailEvent.email_id.in_(
            db.query(Email.id).filter(Email.campaign_id == campaign_id)
        )
    ).group_by(EmailEvent.event_type).all()
    
    return [{"event_type": c[0], "count": c[1]} for c in counts]


@router.get("/global/events/history", response_model=List[EventDetail])
def get_global_event_history(
    event_type: Optional[str] = Query(None, description="Filter by event type (e.g., 'bounce', 'complaint', 'open', 'click')"),
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a history of recent email events for the user's workspace.
    """
    query = db.query(EmailEvent).filter(EmailEvent.user_id == current_user.id)
    if event_type:
        query = query.filter(EmailEvent.event_type == event_type)
    
    events = query.order_by(EmailEvent.occurred_at.desc()).limit(limit).all()
    
    return [EventDetail.model_validate(e) for e in events]


@router.get("/campaigns/{campaign_id}/events/history", response_model=List[EventDetail])
def get_campaign_event_history(
    campaign_id: int,
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a history of recent email events for a specific campaign.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    query = db.query(EmailEvent).filter(
        EmailEvent.user_id == current_user.id,
        EmailEvent.email_id.in_(
            db.query(Email.id).filter(Email.campaign_id == campaign_id)
        )
    )
    if event_type:
        query = query.filter(EmailEvent.event_type == event_type)
    
    events = query.order_by(EmailEvent.occurred_at.desc()).limit(limit).all()
    
    return [EventDetail.model_validate(e) for e in events]
