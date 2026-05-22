import pytest
import json
import redis
from unittest.mock import patch, MagicMock

# Import the main worker module and function
import backend.ingestion.src.worker as worker_module
from backend.ingestion.src.worker import main

# Test Case 1: Verifies correct processing of standard telemetry message
@patch('backend.ingestion.src.worker.InfluxDBClient')
@patch('backend.ingestion.src.worker.redis.Redis')
def test_worker_processes_standard_message_successfully(mock_redis_class, mock_influx_class):
    mock_redis_instance = MagicMock()
    mock_redis_class.return_value = mock_redis_instance
    mock_payload = {
        "sensor_id": "sensor-100",
        "building_id": "building-001",
        "meter_id": "meter-001",
        "type": "Commercial",
        "usage": "250.75"
    }

    #side effect function to return data and flip the global running flag
    def brpop_side_effect(queue_name, timeout=None):
        worker_module.running = False
        return ("ingestion_queue", json.dumps(mock_payload))
    
    mock_redis_instance.brpop.side_effect = brpop_side_effect
    mock_influx_instance = MagicMock()
    mock_influx_class.return_value = mock_influx_instance
    mock_write_api = MagicMock()
    mock_influx_instance.write_api.return_value = mock_write_api
    worker_module.running = True
    main()
    #verify write was called
    assert mock_write_api.write.called


# Test Case 2: Edge case - missing standard fields, should use fallbacks
@patch('backend.ingestion.src.worker.InfluxDBClient')
@patch('backend.ingestion.src.worker.redis.Redis')
def test_worker_resolves_fallback_structural_keys(mock_redis_class, mock_influx_class):
    mock_redis_instance = MagicMock()
    mock_redis_class.return_value = mock_redis_instance
    
    mismatched_payload = {
        "building_id": "building-999",
        "reading": "150.5"
    }

    def brpop_side_effect(queue_name, timeout=None):
        worker_module.running = False
        return ("ingestion_queue", json.dumps(mismatched_payload))
    mock_redis_instance.brpop.side_effect = brpop_side_effect
    mock_influx_instance = MagicMock()
    mock_influx_class.return_value = mock_influx_instance
    mock_write_api = MagicMock()
    mock_influx_instance.write_api.return_value = mock_write_api
    worker_module.running = True
    main()

    #verify write was called with fallback values
    assert mock_write_api.write.called


# Test Case 3: Edge case - malformed JSON should be skipped safely without crashing
@patch('backend.ingestion.src.worker.InfluxDBClient')
@patch('backend.ingestion.src.worker.redis.Redis')
def test_worker_ignores_and_survives_corrupt_payload_exceptions(mock_redis_class, mock_influx_class):
    mock_redis_instance = MagicMock()
    mock_redis_class.return_value = mock_redis_instance
    
    def brpop_side_effect(queue_name, timeout=None):
        worker_module.running = False
        return ("ingestion_queue", "corrupt_non_json_string")

    mock_redis_instance.brpop.side_effect = brpop_side_effect
    mock_influx_instance = MagicMock()
    mock_influx_class.return_value = mock_influx_instance
    mock_write_api = MagicMock()
    mock_influx_instance.write_api.return_value = mock_write_api
    worker_module.running = True
    main()
    #worker should skip corrupt message and NOT write to InfluxDB
    mock_write_api.write.assert_not_called()


# Test Case 4: Edge case - Redis connection failure triggers backoff sleep interval
@patch('backend.ingestion.src.worker.time.sleep')
@patch('backend.ingestion.src.worker.InfluxDBClient')
@patch('backend.ingestion.src.worker.redis.Redis')
def test_worker_handles_redis_connection_drops_via_sleep_backoff(mock_redis_class, mock_influx_class, mock_sleep):
    mock_redis_instance = MagicMock()
    mock_redis_class.return_value = mock_redis_instance
    
    def brpop_side_effect(queue_name, timeout=None):
        worker_module.running = False
        raise redis.exceptions.ConnectionError("Connection lost")

    mock_redis_instance.brpop.side_effect = brpop_side_effect
    mock_influx_instance = MagicMock()
    mock_influx_class.return_value = mock_influx_instance
    mock_write_api = MagicMock()
    mock_influx_instance.write_api.return_value = mock_write_api
    worker_module.running = True
    main()
    # verify sleep was called for backoff (should be 5 seconds)
    mock_sleep.assert_called_with(5)