from .celery_app import celery_app
from .scheduler import scheduler_tick

@celery_app.task
def test_task(x):
    return x * 10

# OPTIONAL: Expose scheduler from here too
@celery_app.task
def run_scheduler():
    return scheduler_tick()

