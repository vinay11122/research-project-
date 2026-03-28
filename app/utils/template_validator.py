from jinja2 import Environment, TemplateSyntaxError

env = Environment()


def validate_template(template: str) -> None:
    env.parse(template)  # let TemplateSyntaxError propagate
