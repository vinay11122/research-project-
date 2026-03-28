import os
import re
import time
import socket
import smtplib
from email.utils import parseaddr, formataddr
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session, joinedload

from app.core.database import SessionLocal
from app.core.config import settings
from app.core.auth import decrypt_data
from app.models.user import User
from app.models.contact import Contact
from app.models.campaign import Campaign, CampaignContact
from app.models.email_link import EmailLink
from app.models.sequence_step import SequenceStep
from app.models.email import Email
from app.utils.template_context import build_template_context
from app.utils.template_renderer import render_template, render_template_html
from app.observability.metrics import (
    EMAILS_FAILED_TOTAL,
    EMAILS_SENT_TOTAL,
    EMAIL_SEND_DURATION_SECONDS,
)
from app.services.incident_service import (
    SOURCE_SMTP_SEND,
    open_or_update_incident,
    resolve_open_incidents,
)


class SMTPRateLimitError(Exception):
    """Raised when SMTP provider returns 421 or 429 rate limit errors."""
    def __init__(self, message, reset_at=None):
        super().__init__(message)
        self.reset_at = reset_at

HREF_RE = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def strip_html(html: str) -> str:
    if not html: return ""
    text = re.sub(r'<(br|p|/p)[^>]*>', '\n', html, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    import html as html_lib
    return html_lib.unescape(text).strip()


def send_email(
    *,
    user: User,
    to_email: str,
    subject: str,
    html: str,
    text: str | None = None,
    headers: dict | None = None,
) -> bool:
    """
    Sends a real email via SMTP using user-specific settings.
    """
    start = time.time()
    use_user_smtp = all([user.smtp_host, user.smtp_port, user.smtp_username, user.smtp_password_encrypted])
    
    smtp_host = user.smtp_host if use_user_smtp else settings.SMTP_HOST
    smtp_port = user.smtp_port if use_user_smtp else settings.SMTP_PORT
    smtp_username = user.smtp_username if use_user_smtp else settings.SMTP_USERNAME
    smtp_password = decrypt_data(user.smtp_password_encrypted) if use_user_smtp else settings.SMTP_PASSWORD
    smtp_username = (smtp_username or "").strip()
    smtp_password = (smtp_password or "").strip()
    smtp_port = int(smtp_port)
    smtp_require_auth = env_bool("SMTP_REQUIRE_AUTH", False)
    smtp_use_starttls = env_bool("SMTP_USE_STARTTLS", False)
    smtp_use_ssl = env_bool("SMTP_USE_SSL", False)
    provider = "mailhog" if "mailhog" in str(smtp_host).lower() else "smtp"
    
    configured_from = user.from_email or settings.MAIL_FROM
    parsed_name, parsed_email = parseaddr(configured_from)
    from_email = parsed_email or configured_from
    from_name = user.from_name or parsed_name or "Averitas Outreach"

    configured_reply_to = user.reply_to_email or from_email
    reply_to = parseaddr(configured_reply_to)[1] or configured_reply_to

    if not all([smtp_host, smtp_port, from_email]):
        print("❌ SMTP credentials missing or incomplete")
        EMAIL_SEND_DURATION_SECONDS.labels(provider=provider).observe(time.time() - start)
        EMAILS_FAILED_TOTAL.labels(provider=provider, reason="MissingCredentials").inc()
        return False
    if smtp_require_auth and not (smtp_username and smtp_password):
        print("❌ SMTP auth is enabled but username/password are missing")
        EMAIL_SEND_DURATION_SECONDS.labels(provider=provider).observe(time.time() - start)
        EMAILS_FAILED_TOTAL.labels(provider=provider, reason="MissingAuth").inc()
        return False
    if smtp_require_auth and str(smtp_password).upper() in {"YOUR_SMTP_PASSWORD", "CHANGE_ME", "CHANGEME"}:
        print("❌ SMTP password is placeholder text; set a real SMTP password in backend/.env")
        EMAIL_SEND_DURATION_SECONDS.labels(provider=provider).observe(time.time() - start)
        EMAILS_FAILED_TOTAL.labels(provider=provider, reason="PlaceholderPassword").inc()
        return False

    processed_html = html
    attached_images = []
    img_re = re.compile(r'src=["\'][^"\']*/static/([^"\']+)["\']', re.IGNORECASE)
    
    app_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    uploads_dir = os.path.join(app_root, "uploads")

    def cid_repl(match):
        filename = match.group(1)
        filepath = os.path.join(uploads_dir, filename)
        if os.path.exists(filepath):
            cid = f"{filename}@{socket.gethostname()}"
            attached_images.append((filepath, cid))
            return f'src="cid:{cid}"'
        return match.group(0)

    processed_html = img_re.sub(cid_repl, html)

    msg = MIMEMultipart("related") if attached_images else MIMEMultipart("alternative")
    msg_alternative = MIMEMultipart("alternative")
    if attached_images:
        msg.attach(msg_alternative)
    else:
        msg_alternative = msg

    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = to_email
    msg.add_header('Reply-To', reply_to)

    if text: msg_alternative.attach(MIMEText(text, "plain"))
    msg_alternative.attach(MIMEText(processed_html, "html"))

    for filepath, cid in attached_images:
        try:
            with open(filepath, "rb") as f:
                img_data = f.read()
            img = MIMEImage(img_data, _subtype=os.path.splitext(filepath)[1][1:] or "png")
            img.add_header('Content-ID', f'<{cid}>')
            msg.attach(img)
        except Exception as e:
            print(f"SMTP: Failed to attach image {filepath}: {e}")

    if headers:
        for key, value in headers.items():
            msg.add_header(key, value)

    print(f"SMTP: sending email via host={smtp_host}:{smtp_port} user={smtp_username} to={to_email} from={from_email}")

    if smtp_use_ssl:
        attempts = [("ssl", smtp_host, smtp_port)]
    elif smtp_use_starttls:
        attempts = [("starttls", smtp_host, smtp_port)]
    else:
        attempts = [("plain", smtp_host, smtp_port)]
    last_error: Exception | None = None

    for mode, host, port in attempts:
        try:
            if mode == "starttls":
                with smtplib.SMTP(host, port, timeout=30) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    if smtp_username and smtp_password:
                        server.login(smtp_username, smtp_password)
                    server.send_message(msg, from_addr=from_email, to_addrs=[to_email])
            elif mode == "ssl":
                with smtplib.SMTP_SSL(host, port, timeout=30) as server:
                    server.ehlo()
                    if smtp_username and smtp_password:
                        server.login(smtp_username, smtp_password)
                    server.send_message(msg, from_addr=from_email, to_addrs=[to_email])
            else:
                with smtplib.SMTP(host, port, timeout=30) as server:
                    server.ehlo()
                    if smtp_username and smtp_password:
                        server.login(smtp_username, smtp_password)
                    server.send_message(msg, from_addr=from_email, to_addrs=[to_email])

            print(f"SMTP: sent successfully using {mode} ({host}:{port})")
            EMAIL_SEND_DURATION_SECONDS.labels(provider=provider).observe(time.time() - start)
            EMAILS_SENT_TOTAL.labels(provider=provider).inc()
            return True
        except smtplib.SMTPResponseException as e:
            print(f"SMTP response exception ({mode} {host}:{port}): {e}")
            if e.smtp_code in (421, 429) or "limit exceeded" in str(e).lower():
                EMAIL_SEND_DURATION_SECONDS.labels(provider=provider).observe(time.time() - start)
                EMAILS_FAILED_TOTAL.labels(provider=provider, reason=SMTPRateLimitError.__name__).inc()
                raise SMTPRateLimitError(str(e))
            last_error = e
        except Exception as e:
            print(f"SMTP exception ({mode} {host}:{port}): {e}")
            last_error = e

    if last_error:
        print(f"SMTP final failure after retries: {last_error}")
        EMAIL_SEND_DURATION_SECONDS.labels(provider=provider).observe(time.time() - start)
        EMAILS_FAILED_TOTAL.labels(provider=provider, reason=type(last_error).__name__).inc()
    return False


def wrap_in_html_layout(content: str, unsubscribe_url: str | None = None, open_pixel_url: str | None = None, unsubscribe_text: str | None = None) -> str:
    open_pixel = f'<img src="{open_pixel_url}" width="1" height="1" style="display:none;" />' if open_pixel_url else ""
    
    footer_text = unsubscribe_text or "You are receiving this email because you were contacted by Averitas Outreach."

    footer = ""
    if unsubscribe_url:
        footer = f"""
    <br/>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
    <p style="font-size:12px;color:#666;">
      {footer_text}<br/>
      <a href="{unsubscribe_url}" style="color: #666; text-decoration: underline;">Unsubscribe instantly</a>
    </p>
"""
    return f"""
<html><body style="font-family: sans-serif; font-size: 16px; line-height: 1.5; color: #333;">
<div style="max-width: 600px; white-space: pre-wrap;">{content}</div>
{open_pixel}{footer}
</body></html>""".strip()


def rewrite_links(db: Session, base_url: str, email_id: int, html: str) -> str:
    def repl(match: re.Match[str]) -> str:
        original_url = match.group(1)
        if not original_url.startswith(("http://", "https://")) or "/unsubscribe/" in original_url:
            return match.group(0)
        
        link = EmailLink(email_id=email_id, url=original_url)
        db.add(link)
        db.flush()
        
        tracked = f"http://{base_url}/track/click/{email_id}/{link.id}"
        return f'href="{tracked}"'

    return HREF_RE.sub(repl, html)


def send_sequence_email(contact_id: int, campaign_id: int, sequence_step_id: int) -> bool:
    db: Session = SessionLocal()
    email_row: Email | None = None
    campaign: Campaign | None = None
    try:
        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        campaign = db.query(Campaign).options(joinedload(Campaign.owner)).filter(Campaign.id == campaign_id).first()
        step = db.query(SequenceStep).filter(SequenceStep.id == sequence_step_id).first()

        if not all([contact, contact.email, campaign, step, campaign.owner]):
            raise ValueError("Prerequisite data missing: contact, campaign, owner, or step.")

        user = campaign.owner
        base_url = user.tracking_domain or settings.BASE_URL

        campaign_contact = db.query(CampaignContact).filter(CampaignContact.contact_id == contact_id, CampaignContact.campaign_id == campaign_id).first()
        if not campaign_contact: raise ValueError("CampaignContact missing")
        if campaign_contact.unsubscribed: raise ValueError("Contact unsubscribed")

        unsubscribe_url = f"http://{base_url}/unsubscribe/{campaign_contact.unsubscribe_token}"
        template_context = build_template_context(contact, campaign, unsubscribe_url)

        if not step.template: raise ValueError("Template not found for step")
        
        subject = render_template(step.template.subject_template, template_context)
        html_body = render_template_html(step.template.body_template, template_context)

        from_address = user.from_email or settings.MAIL_FROM

        email_row = Email(
            user_id=user.id, # Add user_id here
            contact_id=contact.id, campaign_id=campaign.id, sequence_step_id=step.id,
            from_address=from_address, to_address=contact.email, subject=subject,
            status="sending", sent_at=datetime.now(timezone.utc)
        )
        db.add(email_row)
        db.commit()
        db.refresh(email_row)

        open_pixel_url = f"http://{base_url}/track/open/{email_row.id}.png?t={int(time.time())}"
        
        html_body = wrap_in_html_layout(
            content=html_body,
            unsubscribe_url=unsubscribe_url,
            open_pixel_url=open_pixel_url,
            unsubscribe_text=user.unsubscribe_footer_text
        )
        
        html_body = rewrite_links(db, base_url, email_row.id, html_body)
        email_row.body = html_body
        db.commit()

        text_fallback = f"{strip_html(html_body)}\n\n---\nUnsubscribe: {unsubscribe_url}".strip()

        sent_ok = send_email(
            user=user, to_email=contact.email, subject=subject,
            html=html_body, text=text_fallback
        )
        
        if sent_ok:
            email_row.status = "sent"
            email_row.sent_at = datetime.now(timezone.utc)
            resolve_open_incidents(
                db=db,
                user_id=user.id,
                source=SOURCE_SMTP_SEND,
                campaign_id=campaign.id,
                resolved_at=email_row.sent_at,
            )
            print(f"✅ Email sent to {contact.email} (email_id={email_row.id})")
        else:
            email_row.status = "failed"
            open_or_update_incident(
                db=db,
                user_id=user.id,
                source=SOURCE_SMTP_SEND,
                title="SMTP send failures",
                campaign_id=campaign.id,
                started_at=email_row.sent_at,
                detected_at=datetime.now(timezone.utc),
                details=f"Failed to send to {contact.email}",
            )
        
        db.commit()
        return sent_ok

    except SMTPRateLimitError as e:
        print(f"🛑 SMTP RATE LIMIT: {str(e)}")
        if campaign:
            campaign.status = "paused"
            campaign.limit_reset_at = e.reset_at or (datetime.now(timezone.utc) + timedelta(hours=24))
            if email_row:
                email_row.status = "failed"
                open_or_update_incident(
                    db=db,
                    user_id=campaign.user_id,
                    source=SOURCE_SMTP_SEND,
                    title="SMTP send failures",
                    campaign_id=campaign.id,
                    started_at=email_row.sent_at,
                    detected_at=datetime.now(timezone.utc),
                    details=str(e),
                )
            db.commit()
        return False
    except Exception as e:
        print("❌ Email send error:", e)
        if email_row:
            email_row.status = "failed"
            open_or_update_incident(
                db=db,
                user_id=email_row.user_id,
                source=SOURCE_SMTP_SEND,
                title="SMTP send failures",
                campaign_id=email_row.campaign_id,
                started_at=email_row.sent_at,
                detected_at=datetime.now(timezone.utc),
                details=str(e),
            )
            db.commit()
        return False
    finally:
        db.close()
