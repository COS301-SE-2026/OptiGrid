import os
import json
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
    from backend.ingestion.src.observers import TelemetrySubject, InfluxStorageObserver
except ModuleNotFoundError:
    from observers import TelemetrySubject, InfluxStorageObserver

def run_queue_worker():
    print("Starting OptiGrid Queue Worker.")
    require_influx_config()

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
    subject.attach(influx_observer)

    print("Queue Worker active. Listening on Redis.")

    while True:
        try:
            # pop from redis queue
            item = r.brpop("ingestion_queue", timeout=5)
            if not item:
                continue

            _, data_str = item 
            subject.notify(json.loads(data_str))

        except redis.exceptions.ConnectionError as e:
            print(f"[WORKER ERROR] Redis connection error: {e}. Retrying in 5s...")
            time.sleep(5)
        except Exception as e:
            print(f"[WORKER ERROR] Failed to process payload: {e}")

if __name__ == "__main__":
    run_queue_worker()