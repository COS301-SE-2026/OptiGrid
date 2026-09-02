import unittest
import json
import time
from testcontainers.influxdb import InfluxDbContainer
from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS
from backend.ingestion.src.observers import TelemetrySubject, InfluxStorageObserver

class TestQueueWorkerIntegration(unittest.TestCase):
    influx_container = None
    influx_url = None
    token = "token-123"
    org = "OptiGrid"
    bucket = "EnergyData"

    @classmethod
    def setUpClass(cls):
        cls.influx_container = InfluxDbContainer(image="influxdb:2.7-alpine")
        cls.influx_container.with_env("DOCKER_INFLUXDB_INIT_MODE", "setup")
        cls.influx_container.with_env("DOCKER_INFLUXDB_INIT_USERNAME", "admin")
        cls.influx_container.with_env("DOCKER_INFLUXDB_INIT_PASSWORD", "password123")
        cls.influx_container.with_env("DOCKER_INFLUXDB_INIT_ORG", cls.org)
        cls.influx_container.with_env("DOCKER_INFLUXDB_INIT_BUCKET", cls.bucket)
        cls.influx_container.with_env("DOCKER_INFLUXDB_INIT_ADMIN_TOKEN", cls.token)
        cls.influx_container.start()
        cls.influx_url = cls.influx_container.get_url()

    @classmethod
    def tearDownClass(cls):
        if cls.influx_container:
            cls.influx_container.stop()

    def test_pipeline_integration(self):
        # set up real influxdb client
        client = InfluxDBClient(url=self.influx_url, token=self.token, org=self.org)
        write_api = client.write_api(write_options=SYNCHRONOUS)
        query_api = client.query_api()

        # setup observers
        subject = TelemetrySubject()
        influx_observer = InfluxStorageObserver(write_api, self.bucket)
        subject.attach(influx_observer)

        # simulate data coming from redis
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
        
        # query db to assert it was written
        query = f'from(bucket: "{self.bucket}") |> range(start: 0) |> filter(fn: (r) => r["_measurement"] == "energy_telemetry") |> filter(fn: (r) => r["building_id"] == "integration_bldg")'
        
        # influxdb async indexing might take a moment to be available to query
        time.sleep(1)
        
        tables = query_api.query(query, org=self.org)
        
        # we expect at least 1 table with records (usage, voltage, current)
        self.assertTrue(len(tables) > 0)
        
        found_usage = False
        for table in tables:
            for record in table.records:
                if record.get_field() == "usage" and record.get_value() == 45.0:
                    found_usage = True
                    break
        
        self.assertTrue(found_usage, "Failed to find the written usage point in InfluxDB")
        client.close()
