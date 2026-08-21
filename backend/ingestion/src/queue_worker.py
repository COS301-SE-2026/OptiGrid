import os
import json
import signal
import threading
import time
from datetime import datetime, timezone
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
except ModuleNotFoundError:
    from observers import TelemetrySubject, InfluxStorageObserver, AnomalyDetectorObserver

shutdown_requested = threading.Event()

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
    subject = TelemetrySubject()
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
            except Exception as e:
                print(f"[WORKER ERROR] Failed to process payload: {e}")
    finally:
        print("Queue Worker closing connections.")
        write_api.close()
        client.close()
        r.close()
        print("Queue Worker stopped.")

if __name__ == "__main__":
    run_queue_worker()
