import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import redis

from backend.ingestion.src.main import app

client = TestClient(app)

@patch('backend.ingestion.src.main.r')
def test_ingest_entry_success(mock_redis):
    """Test Case: Verifies successful caching of valid TelemetryPoint payload to redis queue"""
    mock_redis.llen.return_value = 1
    
    payload = {
        "sensor_id": "sensor-001", 
        "building_id": "building-001", 
        "power_kw": 412.5,
        "voltage_v": 230.0,
        "current_a": 1.79
    }
    
    response = client.post("/ingest", json=payload)
    
    assert response.status_code == 210
    assert response.json()["status"] == "success"
    assert response.json()["message"] == "Data buffered"
    assert response.json()["building_id"] == "building-001"
    mock_redis.lpush.assert_called_once()

@patch('backend.ingestion.src.main.r')
def test_ingest_entry_redis_exception(mock_redis):
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

@patch('backend.ingestion.src.main.r')
def test_ingest_entry_empty_json_handling(mock_redis):
    """Test Case: Edge case verifying schema validation rejects empty payloads"""
    response = client.post("/ingest", json={})
    
    assert response.status_code == 422
    mock_redis.lpush.assert_not_called()