from datetime import datetime, timedelta, timezone, time
import logging
from celery import shared_task
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from sqlalchemy.exc import OperationalError

from app.core.database import SessionLocal
from app.core.config import settings
from app.models.sequence_queue import SequenceQueue
from app.models.sequence_step import SequenceStep
from app.models.campaign import Campaign, CampaignContact
from app.models.contact import Contact
from app.models.suppressed_email import SuppressedEmail
from app.models.email import Email
from .email_sender import send_sequence_email

logger = logging.getLogger(__name__)


def log_job(job, message: str):
    print(
        f"[JOB {job.id}] "
        f"contact={job.contact_id} "
        f"campaign={job.campaign_id} "
        f"step={job.sequence_step_id} "
        f"status={job.status} — {message}"
    )

DAY_MAP = {
    0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"
}

@shared_task
def scheduler_tick():
    """
    Runs every 2 seconds via Celery Beat.
    Sends ONE email per tick (Safety Mode).
    Enforces campaign scheduling, throttling, and suppression lists.
    """
    db: Session = SessionLocal()
    job = None

    try:
        now_utc = datetime.now(timezone.utc)

        try:
            job = (
                db.query(SequenceQueue)
                .join(Campaign, Campaign.id == SequenceQueue.campaign_id)
                .options(
                    joinedload(SequenceQueue.campaign).joinedload(Campaign.owner),
                    joinedload(SequenceQueue.contact)
                )
                .filter(
                    SequenceQueue.status == "pending",
                    SequenceQueue.scheduled_at <= now_utc,
                    Campaign.status == "running",
                    or_(Campaign.start_at == None, Campaign.start_at <= now_utc),
                    or_(Campaign.limit_reset_at == None, Campaign.limit_reset_at <= now_utc)
                )
                .with_for_update(of=SequenceQueue, skip_locked=True)  # Lock only SequenceQueue rows; skip locked jobs
                .order_by(SequenceQueue.scheduled_at.asc())
                .first()
            )
        except OperationalError:
            db.rollback()  # Release any pending transaction
            return "Skipped job due to lock contention"

        if not job:
            return "No pending jobs for running campaigns"

        # Reload campaign with owner to ensure it's fresh and has new properties
        campaign = db.query(Campaign).options(joinedload(Campaign.owner)).filter(Campaign.id == job.campaign_id).first()
        if not campaign:
            raise ValueError(f"Campaign not found for job {job.id}")

        job.campaign = campaign  # Update job's campaign relation with reloaded object

        job_scheduled_at = job.scheduled_at
        if job_scheduled_at.tzinfo is None:
            job_scheduled_at = job_scheduled_at.replace(tzinfo=timezone.utc)

        if job_scheduled_at > now_utc:
            return "Next job is in the future"

        if job.status != "pending":
            print(f"⚠️ Invalid job state detected: {job.id} ({job.status})")
            return f"Invalid state {job.status}"

        # -------------------------------------------------------------------
        # 🚫 1.1: CAMPAIGN SENDING WINDOW CHECK
        # -------------------------------------------------------------------
        if (not settings.CAMPAIGN_RESTRICTIONS_DISABLED) and campaign.sending_window_start and campaign.sending_window_end:
            current_time_of_day = now_utc.time()
            if not (campaign.sending_window_start <= current_time_of_day <= campaign.sending_window_end):
                # Skip for now, job remains pending to be picked up when window opens
                log_job(job, "skipped (outside sending window)")
                return f"Skipped job {job.id} outside sending window"

        # -------------------------------------------------------------------
        # 🚫 1.2: CAMPAIGN SENDING DAYS CHECK
        # -------------------------------------------------------------------
        if (not settings.CAMPAIGN_RESTRICTIONS_DISABLED) and campaign.sending_days:
            allowed_days = [day.strip() for day in campaign.sending_days.lower().split(',')]
            current_day_name = DAY_MAP[now_utc.weekday()]
            if current_day_name not in allowed_days:
                # Skip for now, job remains pending to be picked up on an allowed day
                log_job(job, "skipped (not an allowed sending day)")
                return f"Skipped job {job.id} not on allowed day"

        # -------------------------------------------------------------------
        # 🚫 1.3: CAMPAIGN DAILY SEND LIMIT CHECK
        # -------------------------------------------------------------------
        if (not settings.CAMPAIGN_RESTRICTIONS_DISABLED) and campaign.daily_send_limit is not None and campaign.daily_send_limit > 0:
            twenty_four_hours_ago = now_utc - timedelta(hours=24)
            sent_count_today = db.query(Email).filter(
                Email.campaign_id == campaign.id,
                Email.status == "sent",
                Email.sent_at >= twenty_four_hours_ago
            ).count()

            if sent_count_today >= campaign.daily_send_limit:
                if campaign.status != "paused":
                    campaign.status = "paused"
                    campaign.limit_reset_at = now_utc + timedelta(hours=24)  # Reset in 24 hours
                    db.add(campaign)
                    job.status = "pending"  # Keep job pending until campaign resumes
                    db.commit()
                    log_job(job, f"paused campaign due to daily send limit ({sent_count_today}/{campaign.daily_send_limit})")
                else:
                    # Campaign is already paused, just skip the job. The campaign will unpause when its limit_reset_at passes.
                    job.status = "pending"  # Keep job pending
                    db.commit()
                    log_job(job, f"skipped, campaign is paused due to daily send limit ({sent_count_today}/{campaign.daily_send_limit})")

                return f"Campaign {campaign.id} paused due to daily send limit"

        # -------------------------------------------------------------------
        # 🚫 2.1: WORKSPACE-WIDE SUPPRESSION CHECK
        # -------------------------------------------------------------------
        user = campaign.owner  # Use the reloaded campaign.owner
        contact = job.contact

        if (not settings.CAMPAIGN_RESTRICTIONS_DISABLED) and user and contact:
            is_suppressed = db.query(SuppressedEmail).filter(
                SuppressedEmail.user_id == user.id,
                SuppressedEmail.email == contact.email
            ).first()
            if is_suppressed:
                job.status = "skipped"
                db.commit()
                log_job(job, f"skipped (workspace suppression: {is_suppressed.reason})")
                return f"Skipped job {job.id} due to workspace suppression"

        # -------------------------------------------------------------------
        # 🚫 2.2: PER-CAMPAIGN STOP CONDITIONS (replied/bounced/unsubscribed)
        # -------------------------------------------------------------------
        cc = (
            db.query(CampaignContact)
            .filter(
                CampaignContact.contact_id == job.contact_id,
                CampaignContact.campaign_id == job.campaign_id
            )
            .first()
        )

        if (not settings.CAMPAIGN_RESTRICTIONS_DISABLED) and cc:
            if cc.replied or cc.bounced or cc.unsubscribed:
                reason = "replied" if cc.replied else "bounced" if cc.bounced else "unsubscribed"
                job.status = "skipped"
                db.commit()
                log_job(job, f"skipped (campaign suppression: {reason})")
                return f"Skipped job {job.id}"

        # -------------------------------------------------------------------
        # 3️⃣ Mark in-progress, send, and queue next
        # -------------------------------------------------------------------
        job.status = "sending"
        db.commit()
        log_job(job, "sending email")

        sent_ok = send_sequence_email(
            contact_id=job.contact_id,
            campaign_id=job.campaign_id,
            sequence_step_id=job.sequence_step_id
        )

        if not sent_ok:
            job.status = "failed"
            db.commit()
            log_job(job, "email send failed")
            return f"Failed job {job.id}"

        job.status = "sent"
        job.sent_at = datetime.now(timezone.utc)

        if cc:
            cc.last_step_id = job.sequence_step_id
            cc.updated_at = datetime.now(timezone.utc)

        db.commit()
        log_job(job, "email sent successfully")

        # AUTO-QUEUE NEXT STEP
        current_step = db.query(SequenceStep).filter(SequenceStep.id == job.sequence_step_id).first()
        if not current_step:
            print("⚠️ Current step missing — cannot progress")
            return f"Sent job {job.id}"

        next_step = (
            db.query(SequenceStep)
            .filter(
                SequenceStep.sequence_id == current_step.sequence_id,
                SequenceStep.step_number == current_step.step_number + 1
            )
            .first()
        )

        if next_step:
            next_time = datetime.now(timezone.utc) + timedelta(days=next_step.delay_days)
            # Adjust next_time to fit within sending window if defined
            if campaign.sending_window_start and campaign.sending_window_end:
                if not (campaign.sending_window_start <= next_time.time() <= campaign.sending_window_end):
                    # If next_time is outside window, reschedule for next day's start window
                    next_time = datetime.combine(
                        next_time.date() + timedelta(days=1),
                        campaign.sending_window_start
                    ).replace(tzinfo=timezone.utc)

            # Adjust next_time to fit within sending days if defined
            if campaign.sending_days:
                allowed_days = [day.strip() for day in campaign.sending_days.lower().split(',')]
                while DAY_MAP[next_time.weekday()] not in allowed_days:
                    next_time += timedelta(days=1)
                    # If it's still outside window, move to window start on new day
                    if campaign.sending_window_start and campaign.sending_window_end:
                        next_time = datetime.combine(
                            next_time.date(),
                            campaign.sending_window_start
                        ).replace(tzinfo=timezone.utc)

            next_job = SequenceQueue(
                contact_id=job.contact_id,
                campaign_id=job.campaign_id,
                sequence_step_id=next_step.id,
                scheduled_at=next_time,
                status="pending",
                queued_at=datetime.now(timezone.utc)
            )
            db.add(next_job)
            db.commit()
            print(f"🔁 Queued next step → Step {next_step.step_number}")
        else:
            print("🏁 Sequence complete — no further steps")

        return f"Sent job {job.id}"

    except Exception as e:
        if job:
            job.status = "failed"
            db.commit()
            log_job(job, f"FAILED: {str(e)}")
        logger.exception("scheduler_tick failed: %s", e)
        return f"scheduler_tick failed: {e}"

    finally:
        db.close()
