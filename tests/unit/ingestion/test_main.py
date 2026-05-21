import pytest
from fastapi.testclient import TestClient
import json
from unittest.mock import patch, MagicMock

#importing fastapi application
from backend.ingestion.src.main import app

client = TestClient(app)

#Test Case: verifies successful caching by guaranteeing payload maps to redis queue
@patch('backend.ingestion.src.main.r')
def test_ingest_entry_success(mock_redis):
    payload = {"sensor_id": "sensor-001", "building_id": "building-001", "usage": "412.5"}
    response = client.post("/ingest", json=payload)
    assert response.status_code == 200
    assert response.json() == {"status": "success", "message": "Data buffered"}
    mock_redis.lpush.assert_called_once_with("ingestion_queue", json.dumps(payload))
    
#Test Case: Edge case mapping downstream rejections
@patch('backend.ingestion.src.main.r')
def test_ingest_entry_redis_exception(mock_redis):
    payload = {"sensor_id": "sensor-001"}
    mock_redis.lpush.side_effect = Exception("Redis memory limit reached")
    response = client.post("/ingest", json=payload)
    assert response.status_code == 500
    assert "Redis memory limit reached" in response.json()["detail"]
    
#Test Case: Edge case verifying response formatting constraints if empty payload pushed through entry gateway
@patch('backend.ingestion.src.main.r')
def test_ingest_entry_empty_json_handling(mock_redis):
    response = client.post("/ingest", json={})
    
    assert response.status_code == 200
    mock_redis.lpush.assert_called_once_with("ingestion_queue", json.dumps({}))