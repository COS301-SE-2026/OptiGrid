import os
import json
import signal
import threading
import time
from datetime import datetime, timezone
from functools import partial
import redis
from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS

try:
    from backend.ingestion.src.config import (
        REDIS_HOST, REDIS_PORT, REDIS_DB,
        INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET,
        require_influx_config
    )
except ModuleNotFoundError:
    from config import (
        REDIS_HOST, REDIS_PORT, REDIS_DB,
        INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET,
        require_influx_config
    )

try:
    from backend.ingestion.src.observers import TelemetrySubject, InfluxStorageObserver, AnomalyDetectorObserver
    from backend.ingestion.src.audit_events import publish_failure_event
except ModuleNotFoundError:
    from observers import TelemetrySubject, InfluxStorageObserver, AnomalyDetectorObserver
    from audit_events import publish_failure_event

shutdown_requested = threading.Event()


def _publish_observer_failure(redis_client, observer, payload, error):
    if isinstance(observer, InfluxStorageObserver):
        operation = "write-to-influx"
        error_code = "INFLUX_WRITE_FAILED"
        target_table = "energy_telemetry"
    elif isinstance(observer, AnomalyDetectorObserver):
        operation = "detect-anomaly"
        error_code = "ANOMALY_DETECTION_FAILED"
        target_table = "anomalies"
    else:
        operation = "process-telemetry-observer"
        error_code = "TELEMETRY_OBSERVER_FAILED"
        target_table = "energy_telemetry"

    publish_failure_event(
        redis_client,
        service="ingestion-worker",
        operation=operation,
        error_code=error_code,
        error=error,
        target_table=target_table,
        building_id=payload.get("building_id"),
        sensor_id=payload.get("sensor_id"),
        request_id=payload.get("request_id"),
        metadata={"observer": observer.__class__.__name__},
    )

def request_shutdown(signum, _frame):
    try:
        signal_name = signal.Signals(signum).name
    except ValueError:
        signal_name = str(signum)
    print(f"Queue Worker received {signal_name}. Shutting down.")
    shutdown_requested.set()

def run_queue_worker():
    print("Starting OptiGrid Queue Worker.")
    require_influx_config()

    signal.signal(signal.SIGTERM, request_shutdown)
    signal.signal(signal.SIGINT, request_shutdown)

    r = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        decode_responses=True,
        socket_connect_timeout=5
    )

    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    write_api = client.write_api(write_options=SYNCHRONOUS)

    # setup observers
    subject = TelemetrySubject(
        failure_handler=partial(_publish_observer_failure, r)
    )
    influx_observer = InfluxStorageObserver(write_api, INFLUXDB_BUCKET)
    anomaly_observer = AnomalyDetectorObserver()
    subject.attach(influx_observer)
    subject.attach(anomaly_observer)

    print("Queue Worker active. Listening on Redis.")

    try:
        while not shutdown_requested.is_set():
            try:
                # pop from redis queue
                item = r.brpop("ingestion_queue", timeout=5)
                if not item:
                    continue

                _, data_str = item
                subject.notify(json.loads(data_str))

            except redis.exceptions.ConnectionError as e:
                print(f"[WORKER ERROR] Redis connection error: {e}. Retrying in 5s...")
                shutdown_requested.wait(5)
            except Exception as error:
                publish_failure_event(
                    r,
                    service="ingestion-worker",
                    operation="process-queue-payload",
                    error_code="PAYLOAD_PROCESSING_FAILED",
                    error=error,
                    target_table="ingestion_queue",
                )
                print(f"[WORKER ERROR] Failed to process payload: {error}")
    finally:
        print("Queue Worker closing connections.")
        write_api.close()
        client.close()
        r.close()
        print("Queue Worker stopped.")

if __name__ == "__main__":
    run_queue_worker()
