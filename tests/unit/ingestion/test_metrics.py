from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, call

import pytest

from backend.ingestion.src.config import INGESTION_METRICS_RETENTION_SECONDS
from backend.ingestion.src.metrics import record_ingestion_metric


def test_record_ingestion_metric_updates_global_and_building_buckets():
    redis_client = MagicMock()
    pipeline = redis_client.pipeline.return_value
    occurred_at = datetime(2026, 8, 22, 14, 5, tzinfo=timezone.utc)

    recorded = record_ingestion_metric(
        redis_client,
        "accepted",
        "building-001",
        occurred_at,
    )

    assert recorded is True
    redis_client.pipeline.assert_called_once_with(transaction=False)
    assert pipeline.method_calls == [
        call.hincrby("health:ingestion:minute:20260822T1405Z", "accepted", 1),
        call.expire(
            "health:ingestion:minute:20260822T1405Z",
            INGESTION_METRICS_RETENTION_SECONDS,
        ),
        call.hincrby(
            "health:ingestion:building:building-001:minute:20260822T1405Z",
            "accepted",
            1,
        ),
        call.expire(
            "health:ingestion:building:building-001:minute:20260822T1405Z",
            INGESTION_METRICS_RETENTION_SECONDS,
        ),
        call.execute(),
    ]


def test_record_ingestion_metric_normalises_bucket_time_to_utc():
    redis_client = MagicMock()
    pipeline = redis_client.pipeline.return_value
    occurred_at = datetime(
        2026,
        8,
        22,
        16,
        5,
        tzinfo=timezone(timedelta(hours=2)),
    )

    record_ingestion_metric(redis_client, "failed", occurred_at=occurred_at)

    pipeline.hincrby.assert_called_once_with(
        "health:ingestion:minute:20260822T1405Z",
        "failed",
        1,
    )


def test_record_ingestion_metric_does_not_raise_when_redis_fails():
    redis_client = MagicMock()
    redis_client.pipeline.return_value.execute.side_effect = RuntimeError(
        "Redis unavailable"
    )

    recorded = record_ingestion_metric(
        redis_client,
        "accepted",
        "building-001",
    )

    assert recorded is False


def test_record_ingestion_metric_rejects_unknown_outcome():
    redis_client = MagicMock()

    with pytest.raises(ValueError, match="Unsupported ingestion metric outcome"):
        record_ingestion_metric(redis_client, "ignored")

    redis_client.pipeline.assert_not_called()
