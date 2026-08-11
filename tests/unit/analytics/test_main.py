import pytest
from unittest.mock import patch
import backend.analytics.src.batch_worker as batch_worker
from backend.analytics.src.batch_worker import run_analytics_batch

@pytest.fixture(autouse=True)
def reset_engine():
    #resets global engine
    batch_worker.engine = None

#positive test case, ensures that the manuel override triggers process all buildings
@patch('backend.analytics.src.batch_worker.AnalyticsEngine')
def test_run_override_positive(MockEngine):
    mock_instance = MockEngine.return_value
    run_analytics_batch()
    MockEngine.assert_called_once()
    mock_instance.process_all_buildings.assert_called_once()

#negative test case, ensures errors caught during manuel execution
@patch('backend.analytics.src.batch_worker.AnalyticsEngine')
@patch('backend.analytics.src.batch_worker.logger')
def test_run_override_negative_exception(mock_logger, MockEngine):
    mock_instance = MockEngine.return_value
    mock_instance.process_all_buildings.side_effect = Exception("Simulated database timeout")
    # override should not crash the program, it should catch and log errors
    run_analytics_batch()
    mock_logger.error.assert_called()

from fastapi.testclient import TestClient
from backend.analytics.src.main import app, engine_instance

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "success", "service": "analytics-api-worker"}

@patch.object(engine_instance, 'register_new_building')
def test_init_building_success(mock_register):
    mock_register.return_value = True
    response = client.post("/init-building", json={"building_id": "test-bldg-1"})
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    mock_register.assert_called_once_with("test-bldg-1")

@patch.object(engine_instance, 'register_new_building')
def test_init_building_failure(mock_register):
    mock_register.return_value = False
    response = client.post("/init-building", json={"building_id": "test-bldg-2"})
    assert response.status_code == 500
    assert "skipped the row execution" in response.json()["detail"]

@patch.object(engine_instance, 'register_new_building')
def test_init_building_exception(mock_register):
    mock_register.side_effect = Exception("DB error")
    response = client.post("/init-building", json={"building_id": "test-bldg-3"})
    assert response.status_code == 500
    assert "DB error" in response.json()["detail"]

@patch.object(engine_instance, 'refresh_todays_metrics')
def test_refresh_building_success(mock_refresh):
    mock_refresh.return_value = {"peak": 100}
    response = client.post("/refresh-building/test-bldg-1")
    assert response.status_code == 200
    assert response.json()["data"] == {"peak": 100}
    mock_refresh.assert_called_once_with("test-bldg-1")

@patch.object(engine_instance, 'refresh_todays_metrics')
def test_refresh_building_exception(mock_refresh):
    mock_refresh.side_effect = Exception("Computation error")
    response = client.post("/refresh-building/test-bldg-2")
    assert response.status_code == 500
    assert "Refresh failed" in response.json()["detail"]
