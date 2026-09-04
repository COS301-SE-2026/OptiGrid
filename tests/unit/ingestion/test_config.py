import pytest
import os
from unittest.mock import patch
from backend.ingestion.src.config import require_influx_config

@patch('backend.ingestion.src.config.INFLUXDB_URL', '')
@patch('backend.ingestion.src.config.INFLUXDB_TOKEN', '')
@patch('backend.ingestion.src.config.INFLUXDB_ORG', '')
@patch('backend.ingestion.src.config.INFLUXDB_BUCKET', '')
def test_require_influx_config_missing_all():
    with pytest.raises(RuntimeError) as exc:
        require_influx_config()
    assert "INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET" in str(exc.value)

@patch('backend.ingestion.src.config.INFLUXDB_URL', 'http://localhost:8086')
@patch('backend.ingestion.src.config.INFLUXDB_TOKEN', 'token')
@patch('backend.ingestion.src.config.INFLUXDB_ORG', 'org')
@patch('backend.ingestion.src.config.INFLUXDB_BUCKET', '')
def test_require_influx_config_missing_one():
    with pytest.raises(RuntimeError) as exc:
        require_influx_config()
    assert "INFLUXDB_BUCKET" in str(exc.value)

@patch('backend.ingestion.src.config.INFLUXDB_URL', 'http://localhost:8086')
@patch('backend.ingestion.src.config.INFLUXDB_TOKEN', 'token')
@patch('backend.ingestion.src.config.INFLUXDB_ORG', 'org')
@patch('backend.ingestion.src.config.INFLUXDB_BUCKET', 'bucket')
def test_require_influx_config_success():
    # Should not raise any exception
    require_influx_config()
