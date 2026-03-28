from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


@router.get("/overview")
def dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Robust dashboard metrics that work even if tables are empty.
    """
    # 1. Total Campaigns
    total_campaigns = db.execute(
        text("SELECT COUNT(*) FROM campaigns WHERE user_id = :user_id"),
        {"user_id": current_user.id}
    ).scalar() or 0

    # 2. Total Emails Sent
    emails_sent = db.execute(
        text("""
            SELECT COUNT(e.id) 
            FROM emails e 
            JOIN campaigns c ON c.id = e.campaign_id 
            WHERE c.user_id = :user_id
        """),
        {"user_id": current_user.id}
    ).scalar() or 0

    # 3. Total Replies
    replies = db.execute(
        text("""
            SELECT COUNT(*) 
            FROM campaign_contacts cc 
            JOIN campaigns c ON c.id = cc.campaign_id 
            WHERE c.user_id = :user_id AND cc.replied = true
        """),
        {"user_id": current_user.id}
    ).scalar() or 0

    avg_reply_rate = round((replies / emails_sent * 100), 1) if emails_sent > 0 else 0

    return {
        "total_campaigns": total_campaigns,
        "emails_sent": emails_sent,
        "replies": replies,
        "avg_reply_rate": avg_reply_rate
    }
