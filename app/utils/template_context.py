def build_template_context(contact, campaign=None, unsubscribe_url: str = ""):
    """
    Unified source of truth for template variables.
    """
    return {
        # Contact Details
        "first_name": contact.first_name or "",
        "last_name": contact.last_name or "",
        "full_name": contact.full_name or "",
        "email": contact.email,
        "company_name": contact.company_name or "",
        "company": contact.company_name or "", # Alias for robustness
        "title": contact.title or "",
        
        # Campaign Details
        "campaign_name": campaign.name if campaign else "",
        
        # System Variables
        "unsubscribe_url": unsubscribe_url,
    }
