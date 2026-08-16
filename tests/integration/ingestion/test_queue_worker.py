import unittest
import json
from unittest.mock import MagicMock
from backend.ingestion.src.observers import TelemetrySubject, InfluxStorageObserver

class TestQueueWorkerIntegration(unittest.TestCase):
    def test_pipeline_integration(self):
        # mock influx db write api
        mock_write_api = MagicMock()
        bucket = "test_bucket"

        # setup observers
        subject = TelemetrySubject()
        influx_observer = InfluxStorageObserver(mock_write_api, bucket)
        subject.attach(influx_observer)

        # simulate data coming from Redis
        raw_payload = {
            "building_id": "integration_bldg",
            "sensor_id": "sensor_123",
            "power_kw": 45.0,
            "voltage_v": 240.0,
            "current_a": 10.0,
            "timestamp": "2026-08-11T13:00:00Z"
        }
        
        # simulate queue pop
        payload = json.loads(json.dumps(raw_payload))

        # pass payload to subject
        subject.notify(payload)

        # verify influx observer received it and tried to write
        mock_write_api.write.assert_called_once()
        args, kwargs = mock_write_api.write.call_args
        self.assertEqual(kwargs['bucket'], bucket)
        
        # check point content
        point = kwargs['record']
        self.assertEqual(point._name, "energy_telemetry")
        self.assertEqual(point._tags["building_id"], "integration_bldg")
        self.assertEqual(point._tags["sensor_id"], "sensor_123")
        self.assertEqual(point._fields["usage"], 45.0)
