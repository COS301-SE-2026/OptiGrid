import json
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from backend.ingestion.src.audit_events import (
    AUDIT_EVENT_STREAM,
    publish_failure_event,
)
from backend.ingestion.src.config import AUDIT_EVENT_STREAM_MAXLEN


def test_publish_failure_event_writes_sanitised_structured_event():
    redis_client = MagicMock()
    occurred_at = datetime(
        2026,
        8,
        22,
        16,
        5,
        tzinfo=timezone(timedelta(hours=2)),
    )

    published_id = publish_failure_event(
        redis_client,
        service="ingestion-worker",
        operation="write-to-influx",
        error_code="INFLUX_WRITE_FAILED",
        error=RuntimeError("token=secret-value connection refused"),
        target_table="energy_telemetry",
        building_id="building-001",
        sensor_id="sensor-001",
        request_id="request-001",
        metadata={"observer": "InfluxStorageObserver"},
        occurred_at=occurred_at,
        event_id="event-001",
    )

    assert published_id == "event-001"
    redis_client.xadd.assert_called_once()
    stream, event = redis_client.xadd.call_args.args
    assert stream == AUDIT_EVENT_STREAM
    assert event == {
        "event_id": "event-001",
        "action_type": "SYSTEM_FAILURE",
        "target_table": "energy_telemetry",
        "service": "ingestion-worker",
        "operation": "write-to-influx",
        "severity": "error",
        "error_code": "INFLUX_WRITE_FAILED",
        "message": "token=[REDACTED] connection refused",
        "timestamp": "2026-08-22T14:05:00+00:00",
        "building_id": "building-001",
        "sensor_id": "sensor-001",
        "request_id": "request-001",
        "metadata": json.dumps(
            {"observer": "InfluxStorageObserver"},
            separators=(",", ":"),
            sort_keys=True,
        ),
    }
    assert redis_client.xadd.call_args.kwargs == {
        "maxlen": AUDIT_EVENT_STREAM_MAXLEN,
        "approximate": True,
    }


def test_publish_failure_event_is_best_effort_when_redis_is_unavailable():
    redis_client = MagicMock()
    redis_client.xadd.side_effect = RuntimeError("Redis unavailable")

    published_id = publish_failure_event(
        redis_client,
        service="ingestion-worker",
        operation="process-queue-payload",
        error_code="PAYLOAD_PROCESSING_FAILED",
        error=ValueError("Invalid JSON"),
        target_table="ingestion_queue",
    )

    assert published_id is None


def test_publish_failure_event_rejects_unknown_severity():
    redis_client = MagicMock()

    with pytest.raises(ValueError, match="Unsupported audit severity"):
        publish_failure_event(
            redis_client,
            service="ingestion-worker",
            operation="write-to-influx",
            error_code="INFLUX_WRITE_FAILED",
            error=RuntimeError("failure"),
            target_table="energy_telemetry",
            severity="fatal",
        )

    redis_client.xadd.assert_not_called()
