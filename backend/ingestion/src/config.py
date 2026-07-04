import os
from dotenv import load_dotenv

load_dotenv()

INFLUXDB_URL = os.getenv("INFLUXDB_URL")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET")

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))


def require_influx_config() -> None:
    missing_vars = []
    if not INFLUXDB_URL:
        missing_vars.append("INFLUXDB_URL")
    if not INFLUXDB_TOKEN:
        missing_vars.append("INFLUXDB_TOKEN")
    if not INFLUXDB_ORG:
        missing_vars.append("INFLUXDB_ORG")
    if not INFLUXDB_BUCKET:
        missing_vars.append("INFLUXDB_BUCKET")

    if missing_vars:
        missing_list = ", ".join(missing_vars)
        raise RuntimeError(
            f"Missing InfluxDB configuration: {missing_list}. "
            "Set these environment variables before running ingestion scripts."
        )

