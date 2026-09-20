import json
import unittest
from unittest.mock import MagicMock
from backend.ingestion.src.observers import (
    TelemetrySubject,
    Observer,
    InfluxStorageObserver,
    LiveBroadcastObserver,
)
from influxdb_client import Point

class MockObserver(Observer):
    def __init__(self):
        self.payloads = []

    def update(self, payload: dict):
        self.payloads.append(payload)


class FailingObserver(Observer):
    def update(self, payload: dict):
        raise RuntimeError("Observer failed")

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

    def test_telemetry_subject_reports_observer_failure_and_continues(self):
        failure_handler = MagicMock()
        subject = TelemetrySubject(failure_handler=failure_handler)
        failing_observer = FailingObserver()
        healthy_observer = MockObserver()
        subject.attach(failing_observer)
        subject.attach(healthy_observer)
        payload = {"building_id": "building-001", "sensor_id": "sensor-001"}

        subject.notify(payload)

        failure_handler.assert_called_once()
        observer, reported_payload, error = failure_handler.call_args.args
        self.assertIs(observer, failing_observer)
        self.assertEqual(reported_payload, payload)
        self.assertIsInstance(error, RuntimeError)
        self.assertEqual(healthy_observer.payloads, [payload])

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

    def test_live_broadcast_observer_publishes_and_caches_reading(self):
        redis_client = MagicMock()
        observer = LiveBroadcastObserver(redis_client, ttl_seconds=120)

        observer.update({
            "building_id": "building-001",
            "sensor_id": "sensor-001",
            "power_kw": "12.4",
            "voltage_v": "229.6",
            "current_a": "54.0",
            "timestamp": "2026-09-17T10:00:00.000Z",
            "source_type": "EMULATOR",
        })

        encoded = redis_client.publish.call_args.args[1]
        reading = json.loads(encoded)
        self.assertEqual(reading, {
            "building_id": "building-001",
            "sensor_id": "sensor-001",
            "power_kw": 12.4,
            "voltage_v": 229.6,
            "current_a": 54.0,
            "timestamp": "2026-09-17T10:00:00.000Z",
            "source_type": "EMULATOR",
        })
        redis_client.set.assert_called_once_with(
            "sensor:last:sensor-001",
            encoded,
            ex=120,
        )
        redis_client.sadd.assert_called_once_with(
            "building:sensors:building-001",
            "sensor-001",
        )
        redis_client.expire.assert_called_once_with(
            "building:sensors:building-001",
            120,
        )
        redis_client.publish.assert_called_once_with("telemetry_channel", encoded)

    def test_live_broadcast_observer_ignores_unidentified_readings(self):
        redis_client = MagicMock()
        observer = LiveBroadcastObserver(redis_client)

        observer.update({"building_id": "building-001", "power_kw": 12.4})

        redis_client.set.assert_not_called()
        redis_client.publish.assert_not_called()
