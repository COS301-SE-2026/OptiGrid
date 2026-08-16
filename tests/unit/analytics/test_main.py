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
    mock_instance.get_active_building_ids.assert_called_once()

#negative test case, ensures errors caught during manuel execution
@patch('backend.analytics.src.batch_worker.AnalyticsEngine')
@patch('backend.analytics.src.batch_worker.logger')
def test_run_override_negative_exception(mock_logger, MockEngine):
    mock_instance = MockEngine.return_value
    mock_instance.get_active_building_ids.side_effect = Exception("Simulated database timeout")
    # override should not crash the program, it should catch and log errors
    run_analytics_batch()
    mock_logger.error.assert_called()
