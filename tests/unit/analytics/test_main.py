import pytest
import sys
from unittest.mock import patch, MagicMock
sys.modules['mlflow'] = MagicMock()
from backend.analytics.src.main import run_override

#positive test case, ensures that the manuel override triggers process all buildings
@patch('backend.analytics.src.main.AnalyticsEngine')
def test_run_override_positive(MockEngine):
    mock_instance = MockEngine.return_value
    run_override()
    MockEngine.assert_called_once()
    mock_instance.process_all_buildings.assert_called_once()

#negative test case, ensures errors caught during manuel execution
@patch('backend.analytics.src.main.AnalyticsEngine')
@patch('backend.analytics.src.main.logger')
def test_run_override_negative_exception(mock_logger, MockEngine):
    mock_instance = MockEngine.return_value
    mock_instance.process_all_buildings.side_effect = Exception("Simulated database timeout")
    # override should not crash the program, it should catch and log errors
    run_override()
    mock_logger.error.assert_called_once()
    assert "Error during manual override" in mock_logger.error.call_args[0][0]
