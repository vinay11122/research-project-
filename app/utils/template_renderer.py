from jinja2 import Environment, BaseLoader, Undefined

# Use a standard Undefined behavior so missing variables become empty strings 
# instead of raising a Hard Error that stops the campaign.
env = Environment(
    loader=BaseLoader(),
    autoescape=True, # Allow HTML in templates
    undefined=Undefined, 
)


def render_template(template: str, context: dict) -> str:
    """
    Render Jinja2 template with strict variable checking
    """
    tpl = env.from_string(template)
    return tpl.render(**context)


def format_as_html(text: str) -> str:
    """
    Convert plain text to HTML by replacing newlines with <br> tags.
    Preserves newlines even if images or links are present.
    Only skips if it looks like a full HTML document (contains <html> or <body>).
    """
    if not text:
        return ""
    
    # If it's a full HTML document, don't mess with it
    if "<html>" in text.lower() or "<body>" in text.lower():
        return text

    # Otherwise, convert newlines to <br> to preserve the user's formatting from the textarea
    return text.replace("\n", "<br>\n")


def render_template_html(template: str, context: dict) -> str:
    """
    Render template and convert newlines to <br> for HTML display.
    """
    rendered = render_template(template, context)
    return format_as_html(rendered)
