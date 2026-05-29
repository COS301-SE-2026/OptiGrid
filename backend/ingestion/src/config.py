import os
from dotenv import load_dotenv

load_dotenv()

INFLUX_URL = os.getenv("INFLUXDB_URL")
INFLUX_TOKEN = os.getenv("INFLUXDB_TOKEN")
INFLUX_ORG = os.getenv("INFLUXDB_ORG")
INFLUX_BUCKET = os.getenv("INFLUXDB_BUCKET")


def require_influx_config() -> None:
    missing_vars = []
    if not INFLUX_URL:
        missing_vars.append("INFLUXDB_URL")
    if not INFLUX_TOKEN:
        missing_vars.append("INFLUXDB_TOKEN")
    if not INFLUX_ORG:
        missing_vars.append("INFLUXDB_ORG")
    if not INFLUX_BUCKET:
        missing_vars.append("INFLUXDB_BUCKET")

    if missing_vars:
        missing_list = ", ".join(missing_vars)
        raise RuntimeError(
            f"Missing InfluxDB configuration: {missing_list}. "
            "Set these environment variables before running ingestion scripts."
        )
