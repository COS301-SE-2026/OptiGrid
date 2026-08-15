import pytest
import json
import redis
from unittest.mock import patch, MagicMock
import backend.ingestion.src.queue_worker as worker_module
from backend.ingestion.src.queue_worker import run_queue_worker

@patch('backend.ingestion.src.queue_worker.require_influx_config')
@patch('backend.ingestion.src.queue_worker.InfluxDBClient')
@patch('backend.ingestion.src.queue_worker.redis.Redis')
def test_worker_processes_standard_message_successfully(mock_redis_class, mock_influx_class, mock_require_config):
    """Test Case 1: Verifies processing of a standard telemetry packet from queue to InfluxDB"""
    mock_redis_instance = MagicMock()
    mock_redis_class.return_value = mock_redis_instance

    mock_payload = {
        "sensor_id": "sensor-100",
        "building_id": "building-001",
        "power_kw": 250.75,
        "voltage_v": 230.0,
        "current_a": 1.09,
        "timestamp": "2026-07-28T12:00:00Z"
    }

    mock_redis_instance.brpop.side_effect = [
        ("ingestion_queue", json.dumps(mock_payload)),
        KeyboardInterrupt()
    ]

    mock_influx_instance = MagicMock()
    mock_influx_class.return_value = mock_influx_instance
    mock_write_api = MagicMock()
    mock_influx_instance.write_api.return_value = mock_write_api

    try:
        run_queue_worker()
    except KeyboardInterrupt:
        pass

    assert mock_write_api.write.called
    
    args, kwargs = mock_write_api.write.call_args
    point = kwargs['record']
    assert point._name == "energy_telemetry"
    assert point._tags["building_id"] == "building-001"
    assert point._tags["sensor_id"] == "sensor-100"
    assert point._fields["usage"] == 250.75
    assert point._fields["voltage_v"] == 230.0
    assert point._fields["current_a"] == 1.09


@patch('backend.ingestion.src.queue_worker.require_influx_config')
@patch('backend.ingestion.src.queue_worker.InfluxDBClient')
@patch('backend.ingestion.src.queue_worker.redis.Redis')
def test_worker_resolves_fallback_structural_keys(mock_redis_class, mock_influx_class, mock_require_config):
    """Test Case 2: Edge case - missing optional fields apply schema defaults without crashing"""
    mock_redis_instance = MagicMock()
    mock_redis_class.return_value = mock_redis_instance

    minimal_payload = {
        "building_id": "building-999",
        "sensor_id": "sensor-999",
        "power_kw": 150.5
    }

    mock_redis_instance.brpop.side_effect = [
        ("ingestion_queue", json.dumps(minimal_payload)),
        KeyboardInterrupt()
    ]

    mock_influx_instance = MagicMock()
    mock_influx_class.return_value = mock_influx_instance
    mock_write_api = MagicMock()
    mock_influx_instance.write_api.return_value = mock_write_api

    try:
        run_queue_worker()
    except KeyboardInterrupt:
        pass

    assert mock_write_api.write.called
    
    args, kwargs = mock_write_api.write.call_args
    point = kwargs['record']
    assert point._tags["building_id"] == "building-999"
    assert point._tags["sensor_id"] == "sensor-999"
    assert point._fields["usage"] == 150.5
    # Default values assigned when missing
    assert point._fields["voltage_v"] == 230.0
    assert point._fields["current_a"] == 0.0


@patch('backend.ingestion.src.queue_worker.require_influx_config')
@patch('backend.ingestion.src.queue_worker.InfluxDBClient')
@patch('backend.ingestion.src.queue_worker.redis.Redis')
def test_worker_ignores_and_survives_corrupt_payload_exceptions(mock_redis_class, mock_influx_class, mock_require_config):
    """Test Case 3: Edge case - corrupt/malformed payload is caught safely and skipped"""
    mock_redis_instance = MagicMock()
    mock_redis_class.return_value = mock_redis_instance

    mock_redis_instance.brpop.side_effect = [
        ("ingestion_queue", "corrupt_non_json_string"),
        KeyboardInterrupt()
    ]

    mock_influx_instance = MagicMock()
    mock_influx_class.return_value = mock_influx_instance
    mock_write_api = MagicMock()
    mock_influx_instance.write_api.return_value = mock_write_api

    try:
        run_queue_worker()
    except KeyboardInterrupt:
        pass

    mock_write_api.write.assert_not_called()


@patch('backend.ingestion.src.queue_worker.time.sleep')
@patch('backend.ingestion.src.queue_worker.require_influx_config')
@patch('backend.ingestion.src.queue_worker.InfluxDBClient')
@patch('backend.ingestion.src.queue_worker.redis.Redis')
def test_worker_handles_redis_connection_drops_via_sleep_backoff(mock_redis_class, mock_influx_class, mock_require_config, mock_sleep):
    """Test Case 4: Edge case - Redis connection failure triggers 5s sleep backoff"""
    mock_redis_instance = MagicMock()
    mock_redis_class.return_value = mock_redis_instance

    mock_redis_instance.brpop.side_effect = [
        redis.exceptions.ConnectionError("Connection lost"),
        KeyboardInterrupt()
    ]

    mock_influx_instance = MagicMock()
    mock_influx_class.return_value = mock_influx_instance

    try:
        run_queue_worker()
    except KeyboardInterrupt:
        pass

    mock_sleep.assert_called_with(5)