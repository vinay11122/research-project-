# app/api/campaigns_control.py

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Campaign
from app.services.campaign_runner import start_campaign_scheduling

router = APIRouter(
    prefix="/campaigns",
    tags=["Campaign Control"],
)


@router.post("/{campaign_id}/start")
def start_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """
    Start / resume a campaign:
    - Mark status as 'running' (if field exists)
    - Queue outbound emails via RQ
    """
    try:
        queued = start_campaign_scheduling(campaign_id, db)
        return {
            "status": "ok",
            "queued": queued,
            "campaign_id": campaign_id,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{campaign_id}/pause")
def pause_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """
    Pause a running campaign (simple flag).
    """
    campaign = db.query(Campaign).get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if hasattr(campaign, "status"):
        campaign.status = "paused"
        db.commit()

    return {"status": "ok", "campaign_id": campaign_id, "new_status": getattr(campaign, "status", None)}

