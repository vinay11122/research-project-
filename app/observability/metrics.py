from prometheus_client import Counter, Gauge, Histogram

# Counters
EMAILS_SENT_TOTAL = Counter(
    "emails_sent_total",
    "Total number of emails successfully sent",
    ["provider"],
)

EMAILS_FAILED_TOTAL = Counter(
    "emails_failed_total",
    "Total number of emails failed to send",
    ["provider", "reason"],
)

INCIDENTS_OPENED_TOTAL = Counter(
    "incidents_opened_total",
    "Total number of incidents opened",
    ["source"],
)

INCIDENTS_RESOLVED_TOTAL = Counter(
    "incidents_resolved_total",
    "Total number of incidents resolved",
    ["source"],
)

# Latency histogram (seconds)
EMAIL_SEND_DURATION_SECONDS = Histogram(
    "email_send_duration_seconds",
    "Time taken to send an email (seconds)",
    ["provider"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)

# Optional gauge (set by worker/scheduler path when needed)
QUEUE_DEPTH = Gauge(
    "queue_depth",
    "Approximate pending jobs in queue (if available)",
)
