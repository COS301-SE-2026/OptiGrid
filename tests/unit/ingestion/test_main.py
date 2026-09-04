import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import redis

from backend.ingestion.src.main import app

client = TestClient(app)

@patch('backend.ingestion.src.main.record_ingestion_metric')
@patch('backend.ingestion.src.main.r')
def test_ingest_entry_success(mock_redis, mock_record_metric):
    """Test Case: Verifies successful caching of valid TelemetryPoint payload to redis queue"""
    mock_redis.lpush.return_value = 1
    
    payload = {
        "sensor_id": "sensor-001", 
        "building_id": "building-001", 
        "power_kw": 412.5,
        "voltage_v": 230.0,
        "current_a": 1.79
    }
    
    response = client.post("/ingest", json=payload)
    
    assert response.status_code == 201
    assert response.json()["status"] == "success"
    assert response.json()["message"] == "Data buffered"
    assert response.json()["building_id"] == "building-001"
    assert response.json()["queue_length"] == 1
    mock_redis.lpush.assert_called_once()
    mock_record_metric.assert_called_once_with(
        mock_redis,
        "accepted",
        "building-001",
    )

@patch('backend.ingestion.src.main.record_ingestion_metric')
@patch('backend.ingestion.src.main.r')
def test_ingest_entry_redis_exception(mock_redis, mock_record_metric):
    """Test Case: Edge case mapping generic server exceptions to HTTP 500"""
    payload = {
        "sensor_id": "sensor-001", 
        "building_id": "building-001", 
        "power_kw": 412.5
    }

    mock_redis.lpush.side_effect = Exception("Redis memory limit reached")
    response = client.post("/ingest", json=payload)

    assert response.status_code == 500
    assert "Redis memory limit reached" in response.json()["detail"]
    mock_record_metric.assert_called_once_with(
        mock_redis,
        "failed",
        "building-001",
    )

@patch('backend.ingestion.src.main.record_ingestion_metric')
@patch('backend.ingestion.src.main.r')
def test_ingest_entry_empty_json_handling(mock_redis, mock_record_metric):
    """Test Case: Edge case verifying schema validation rejects empty payloads"""
    response = client.post("/ingest", json={})
    
    assert response.status_code == 422
    mock_redis.lpush.assert_not_called()
    mock_record_metric.assert_called_once_with(mock_redis, "failed", None)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "OptiGrid Ingestion API"

@patch('backend.ingestion.src.main.r')
def test_health_check_success(mock_redis):
    mock_redis.ping.return_value = True
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["redis"] == "connected"

@patch('backend.ingestion.src.main.r')
def test_health_check_failure(mock_redis):
    mock_redis.ping.side_effect = Exception("Connection lost")
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "error: Connection lost" in response.json()["redis"]

@patch('backend.ingestion.src.main.r')
def test_init_building_success(mock_redis):
    payload = {
        "building_id": "bldg-test",
        "hardware_auth_token": "token123",
        "nominal_voltage": 220,
        "max_current_threshold": 100,
        "influx_bucket": "bldg-test-bucket",
        "metadata": {"test": "data"}
    }
    response = client.post("/init-building", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert response.json()["building_id"] == "bldg-test"
    mock_redis.hset.assert_called_once()

@patch('backend.ingestion.src.main.r')
def test_init_building_exception(mock_redis):
    mock_redis.hset.side_effect = Exception("Redis failure")
    payload = {"building_id": "bldg-test"}
    response = client.post("/init-building", json=payload)
    assert response.status_code == 500
    assert "Redis failure" in response.json()["detail"]

@patch('backend.ingestion.src.main.record_ingestion_metric')
@patch('backend.ingestion.src.main.r')
def test_ingest_entry_connection_error(mock_redis, mock_record_metric):
    import redis
    mock_redis.lpush.side_effect = redis.exceptions.ConnectionError("Redis connection reset")
    payload = {
        "sensor_id": "sensor-001", 
        "building_id": "building-001", 
        "power_kw": 412.5
    }
    response = client.post("/ingest", json=payload)
    assert response.status_code == 530
    assert response.json()["detail"] == "Redis connection failed"
    mock_record_metric.assert_called_once_with(
        mock_redis,
        "failed",
        "building-001",
    )


@patch('backend.ingestion.src.main.r')
def test_ingest_entry_succeeds_when_metric_storage_is_unavailable(mock_redis):
    mock_redis.lpush.return_value = 1
    mock_redis.pipeline.return_value.execute.side_effect = RuntimeError(
        "Metrics storage unavailable"
    )
    payload = {
        "sensor_id": "sensor-001",
        "building_id": "building-001",
        "power_kw": 412.5,
    }

    response = client.post("/ingest", json=payload)

    assert response.status_code == 201
    assert response.json()["status"] == "success"
