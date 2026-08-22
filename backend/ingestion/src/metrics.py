import logging
from datetime import datetime, timezone
from typing import Optional

try:
    from backend.ingestion.src.config import INGESTION_METRICS_RETENTION_SECONDS
except ModuleNotFoundError:
    from config import INGESTION_METRICS_RETENTION_SECONDS


logger = logging.getLogger(__name__)

METRICS_KEY_PREFIX = "health:ingestion"
VALID_OUTCOMES = frozenset({"accepted", "failed"})


def _minute_bucket(occurred_at: datetime) -> str:
    if occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=timezone.utc)

    return occurred_at.astimezone(timezone.utc).strftime("%Y%m%dT%H%MZ")


def _metric_keys(building_id: Optional[str], occurred_at: datetime) -> list[str]:
    bucket = _minute_bucket(occurred_at)
    keys = [f"{METRICS_KEY_PREFIX}:minute:{bucket}"]

    if building_id:
        keys.append(
            f"{METRICS_KEY_PREFIX}:building:{building_id}:minute:{bucket}"
        )

    return keys


def record_ingestion_metric(
    redis_client,
    outcome: str,
    building_id: Optional[str] = None,
    occurred_at: Optional[datetime] = None,
) -> bool:
    """Increment short-lived global and per-building ingestion counters.

    Metrics are best-effort observability data. Redis failures are logged and
    reported through the return value, but they never interrupt ingestion.
    """
    if outcome not in VALID_OUTCOMES:
        raise ValueError(f"Unsupported ingestion metric outcome: {outcome}")

    metric_time = occurred_at or datetime.now(timezone.utc)

    try:
        pipeline = redis_client.pipeline(transaction=False)
        for key in _metric_keys(building_id, metric_time):
            pipeline.hincrby(key, outcome, 1)
            pipeline.expire(key, INGESTION_METRICS_RETENTION_SECONDS)
        pipeline.execute()
        return True
    except Exception:
        logger.warning(
            "Failed to record %s ingestion metric for building %s",
            outcome,
            building_id,
            exc_info=True,
        )
        return False
