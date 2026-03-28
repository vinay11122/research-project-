import os
import smtplib
from email.utils import parseaddr, formataddr
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings
from app.models.user import User
from app.core.auth import decrypt_data

ALLOWLIST = [email.strip() for email in os.getenv("EMAIL_ALLOWLIST", "").split(",") if email.strip()]
PREFIX = os.getenv("EMAIL_SUBJECT_PREFIX", "").strip()

def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

def send_email(to_email: str, subject: str, html_content: str, user: User):
    """
    Sends a transactional email using user-specific SMTP settings if available,
    otherwise falls back to the global settings.
    """
    if os.getenv("EMAIL_SENDING_ENABLED") != "true":
        print("Email sending disabled by EMAIL_SENDING_ENABLED")
        return

    if ALLOWLIST and to_email not in ALLOWLIST:
        print(f"Blocked study email to {to_email}")
        return

    if PREFIX:
        subject = f"{PREFIX} {subject}"

    print(f"\n--- Attempting to send email to {to_email} ---")
    
    # Determine SMTP settings
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
    
    configured_from = user.from_email or settings.MAIL_FROM
    parsed_name, parsed_email = parseaddr(configured_from)
    from_email = parsed_email or configured_from
    from_name = user.from_name or parsed_name or "Averitas Outreach"

    configured_reply_to = user.reply_to_email or from_email
    reply_to = parseaddr(configured_reply_to)[1] or configured_reply_to

    print(f"SMTP Config: Host={smtp_host}, Port={smtp_port}, User={smtp_username}, Password={'*' * len(smtp_password) if smtp_password else 'N/A'}, From={from_email}, To={to_email}")

    if not all([smtp_host, smtp_port, from_email]):
        print("SMTP settings are not fully configured. Cannot send email. Missing:", {
            "smtp_host": smtp_host,
            "smtp_port": smtp_port,
            "smtp_username": smtp_username,
            "smtp_password": bool(smtp_password),
            "from_email": from_email
        })
        return
    if smtp_require_auth and not (smtp_username and smtp_password):
        print("SMTP auth is enabled but username/password are missing")
        return
    if smtp_require_auth and str(smtp_password).upper() in {"YOUR_SMTP_PASSWORD", "CHANGE_ME", "CHANGEME"}:
        print("SMTP password is placeholder text; set a real SMTP password in backend/.env")
        return

    # Construct the message
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = formataddr((from_name, from_email))
    message["To"] = to_email
    message.add_header('Reply-To', reply_to)

    part = MIMEText(html_content, "html")
    message.attach(part)

    # Send the email
    if smtp_use_ssl:
        attempts = [("ssl", smtp_host, smtp_port)]
    elif smtp_use_starttls:
        attempts = [("starttls", smtp_host, smtp_port)]
    else:
        attempts = [("plain", smtp_host, smtp_port)]
    sent = False
    last_error = None

    for mode, host, port in attempts:
        try:
            if mode == "starttls":
                with smtplib.SMTP(host, port, timeout=30) as server:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    if smtp_username and smtp_password:
                        server.login(smtp_username, smtp_password)
                    server.sendmail(from_email, to_email, message.as_string())
            elif mode == "ssl":
                with smtplib.SMTP_SSL(host, port, timeout=30) as server:
                    server.ehlo()
                    if smtp_username and smtp_password:
                        server.login(smtp_username, smtp_password)
                    server.sendmail(from_email, to_email, message.as_string())
            else:
                with smtplib.SMTP(host, port, timeout=30) as server:
                    server.ehlo()
                    if smtp_username and smtp_password:
                        server.login(smtp_username, smtp_password)
                    server.sendmail(from_email, to_email, message.as_string())

            print(f"Transactional email sent to {to_email} SUCCESSFULLY using {mode} ({host}:{port}).")
            sent = True
            break
        except Exception as e:
            print(f"Failed transactional send via {mode} ({host}:{port}). Error: {e}")
            last_error = e

    if not sent:
        print(f"Failed to send transactional email to {to_email}. Final error: {last_error}")
    print("--- Email sending attempt finished ---")


def send_password_reset_email(user: User, token: str):
    subject = "Reset Your Password"
    # Use user-specific or default tracking domain for the URL
    base_url = (user.tracking_domain or settings.BASE_URL).rstrip("/")
    reset_url = f"{base_url}/reset-password?token={token}"
    
    html_content = f"""
    <html><body>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="{reset_url}">Reset Password</a></p>
    </body></html>
    """
    send_email(to_email=user.email, subject=subject, html_content=html_content, user=user)

def send_verification_email(user: User, token: str):
    subject = "Verify Your Email Address"
    # Use user-specific or default tracking domain for the URL
    base_url = (user.tracking_domain or settings.BASE_URL).rstrip("/")
    verification_url = f"{base_url}/verify-email?token={token}"

    html_content = f"""
    <html><body>
        <p>Thanks for registering! Please click the link to verify your email:</p>
        <p><a href="{verification_url}">Verify Email</a></p>
        <p>Your account will be active once an owner approves your request as well.</p>
    </body></html>
    """
    send_email(to_email=user.email, subject=subject, html_content=html_content, user=user)

def send_owner_approval_email(new_user: User, approve_token: str, reject_token: str):
    print(f"\n--- Preparing owner approval email for {new_user.email} ---")
    subject = "Approval Required – New User Creation"
    to_email_owner = settings.OWNER_APPROVAL_EMAIL or parseaddr(settings.MAIL_FROM)[1] or settings.MAIL_FROM

    base_url = settings.BASE_URL.rstrip("/")
    approve_url = f"{base_url}/approvals/user-create/approve?token={approve_token}"
    reject_url = f"{base_url}/approvals/user-create/reject?token={reject_token}"

    html_content = f"""
    <html><body>
        <p>A new user has requested an account:</p>
        <p><strong>Email:</strong> {new_user.email}</p>
        <p><strong>Requested By:</strong> {new_user.email} (assuming requester is the new user for now)</p>
        <p>Please review and take action:</p>
        <p><a href="{approve_url}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">Approve User</a></p>
        <p><a href="{reject_url}" style="background-color: #f44336; color: white; padding: 10px 20px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px;">Reject User</a></p>
        <p>This approval link will expire in 24 hours.</p>
    </body></html>
    """
    # Provide only display/reply metadata so send_email() falls back to settings.SMTP_*.
    dummy_user = User(
        email=settings.MAIL_FROM,
        from_email=settings.MAIL_FROM,
        from_name="System Admin",
        reply_to_email=settings.MAIL_FROM
    )
    send_email(to_email=to_email_owner, subject=subject, html_content=html_content, user=dummy_user)
    print("--- Owner approval email preparation finished ---")
