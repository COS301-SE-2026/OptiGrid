import os
import json
import time
from datetime import datetime, timezone
import redis
from influxdb_client import InfluxDBClient, Point, WritePrecision
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

def process_payload(payload: dict, write_api) -> None:
    building_id = payload.get("building_id")
    sensor_id = payload.get("sensor_id")
    power_kw = payload.get("power_kw", 0.0)
    voltage_v = payload.get("voltage_v")
    current_a = payload.get("current_a")
    ts_str = payload.get("timestamp")

    if ts_str:
        try:
            time_val = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except Exception:
            time_val = datetime.now(timezone.utc)
    else:
        time_val = datetime.now(timezone.utc)

    # create influx data point with queue data
    point = (
        Point("energy_telemetry")
        .tag("building_id", building_id)
        .tag("sensor_id", sensor_id)
        .field("usage", float(power_kw))
        .field("voltage_v", float(voltage_v) if voltage_v is not None else 230.0)
        .field("current_a", float(current_a) if current_a is not None else 0.0)
        .time(time_val, WritePrecision.NS)
    )

    # attempt to flush to influx
    write_api.write(bucket=INFLUXDB_BUCKET, record=point)
    print(f"[WORKER] Flushed telemetry to InfluxDB for building {building_id[:8]} ({power_kw} kW)")

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

    print("Queue Worker active. Listening on Redis.")

    while True:
        try:
            # pop from redis queue
            item = r.brpop("ingestion_queue", timeout=5)
            if not item:
                continue

            _, data_str = item
            process_payload(json.loads(data_str), write_api)

        except redis.exceptions.ConnectionError as e:
            print(f"[WORKER ERROR] Redis connection error: {e}. Retrying in 5s...")
            time.sleep(5)
        except Exception as e:
            print(f"[WORKER ERROR] Failed to process payload: {e}")

if __name__ == "__main__":
    run_queue_worker()