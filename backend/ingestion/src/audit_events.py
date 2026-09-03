import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

try:
    from backend.ingestion.src.config import AUDIT_EVENT_STREAM_MAXLEN
except ModuleNotFoundError:
    from config import AUDIT_EVENT_STREAM_MAXLEN


logger = logging.getLogger(__name__)

AUDIT_EVENT_STREAM = "system:audit-events"
MAX_ERROR_MESSAGE_LENGTH = 1000
VALID_SEVERITIES = frozenset({"info", "warning", "error", "critical"})
SENSITIVE_VALUE_PATTERN = re.compile(
    r"(?i)\b(token|password|secret|authorization|api[_-]?key)\b"
    r"(\s*[:=]\s*)([^\s,;]+)"
)


def _iso_timestamp(occurred_at: datetime) -> str:
    if occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=timezone.utc)

    return occurred_at.astimezone(timezone.utc).isoformat()


def _sanitise_error_message(error: Exception) -> str:
    message = " ".join(str(error).split()) or error.__class__.__name__
    message = SENSITIVE_VALUE_PATTERN.sub(r"\1\2[REDACTED]", message)
    return message[:MAX_ERROR_MESSAGE_LENGTH]


def publish_failure_event(
    redis_client,
    *,
    service: str,
    operation: str,
    error_code: str,
    error: Exception,
    target_table: str,
    building_id: Optional[str] = None,
    sensor_id: Optional[str] = None,
    request_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    severity: str = "error",
    occurred_at: Optional[datetime] = None,
    event_id: Optional[str] = None,
) -> Optional[str]:
    """Publish a sanitised, durable failure event for the core audit consumer."""
    if severity not in VALID_SEVERITIES:
        raise ValueError(f"Unsupported audit severity: {severity}")

    audit_event_id = event_id or str(uuid4())
    event = {
        "event_id": audit_event_id,
        "action_type": "SYSTEM_FAILURE",
        "target_table": target_table,
        "service": service,
        "operation": operation,
        "severity": severity,
        "error_code": error_code,
        "message": _sanitise_error_message(error),
        "timestamp": _iso_timestamp(occurred_at or datetime.now(timezone.utc)),
    }

    if building_id:
        event["building_id"] = building_id
    if sensor_id:
        event["sensor_id"] = sensor_id
    if request_id:
        event["request_id"] = request_id
    if metadata:
        event["metadata"] = json.dumps(
            metadata,
            default=str,
            separators=(",", ":"),
            sort_keys=True,
        )

    try:
        redis_client.xadd(
            AUDIT_EVENT_STREAM,
            event,
            maxlen=AUDIT_EVENT_STREAM_MAXLEN,
            approximate=True,
        )
        return audit_event_id
    except Exception:
        logger.error(
            "Failed to publish ingestion audit event: %s",
            json.dumps(event, sort_keys=True),
            exc_info=True,
        )
        return None
