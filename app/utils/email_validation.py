from fastapi import HTTPException

BLOCKED_DOMAINS = {
    "example.com",
    "example.org",
    "example.net",
    "test.com",
    "localhost",
    "invalid",
}

def validate_email_domain(email: str):
    """
    Checks if the email domain is in the denylist.
    """
    domain = email.split("@")[-1].strip().lower()
    if domain in BLOCKED_DOMAINS:
        raise HTTPException(
            status_code=400,
            detail=f"Domain '{domain}' is blocked. Please use a valid email address."
        )
