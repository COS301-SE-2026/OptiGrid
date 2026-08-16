import unittest
from unittest.mock import MagicMock
from backend.ingestion.src.observers import TelemetrySubject, Observer, InfluxStorageObserver
from influxdb_client import Point

class MockObserver(Observer):
    def __init__(self):
        self.payloads = []

    def update(self, payload: dict):
        self.payloads.append(payload)

class TestObservers(unittest.TestCase):
    def test_telemetry_subject_attach_detach_notify(self):
        subject = TelemetrySubject()
        obs1 = MockObserver()
        obs2 = MockObserver()

        subject.attach(obs1)
        subject.attach(obs2)
        self.assertEqual(len(subject._observers), 2)

        payload = {"building_id": "test_building", "power_kw": 150}
        subject.notify(payload)

        self.assertEqual(len(obs1.payloads), 1)
        self.assertEqual(obs1.payloads[0], payload)
        self.assertEqual(len(obs2.payloads), 1)
        self.assertEqual(obs2.payloads[0], payload)

        subject.detach(obs1)
        self.assertEqual(len(subject._observers), 1)
        
        payload2 = {"building_id": "test_building", "power_kw": 200}
        subject.notify(payload2)

        self.assertEqual(len(obs1.payloads), 1)  # obs1 should not receive new payload
        self.assertEqual(len(obs2.payloads), 2)
        self.assertEqual(obs2.payloads[1], payload2)

    def test_influx_storage_observer(self):
        mock_write_api = MagicMock()
        bucket = "test_bucket"
        observer = InfluxStorageObserver(mock_write_api, bucket)

        payload = {
            "building_id": "test_building",
            "sensor_id": "test_sensor",
            "power_kw": 120.5,
            "voltage_v": 230.1,
            "current_a": 10.5,
            "timestamp": "2026-08-11T12:00:00Z"
        }

        observer.update(payload)

        mock_write_api.write.assert_called_once()
        args, kwargs = mock_write_api.write.call_args
        self.assertEqual(kwargs['bucket'], bucket)
        
        record = kwargs['record']
        self.assertIsInstance(record, Point)
        self.assertEqual(record._name, "energy_telemetry")
        self.assertEqual(record._tags["building_id"], "test_building")
        self.assertEqual(record._tags["sensor_id"], "test_sensor")
        self.assertEqual(record._fields["usage"], 120.5)
        self.assertEqual(record._fields["voltage_v"], 230.1)
        self.assertEqual(record._fields["current_a"], 10.5)
