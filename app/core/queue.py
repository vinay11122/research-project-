# app/core/queue.py

import redis
from rq import Queue

# Single Redis connection used by API & workers
_redis_conn = redis.Redis(host="redis", port=6379, db=0)


def get_queue(name: str = "email_queue") -> Queue:
    """
    Return an RQ queue instance.

    We use a single queue for all outbound email jobs.
    """
    return Queue(name, connection=_redis_conn)

