import os
from dotenv import load_dotenv

load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.env.local")))
load_dotenv()

isDocker = os.path.exists("/.dockerenv" )

_raw_influx_url = os.getenv("INFLUXDB_URL", "http://influxdb:8086")  # NOSONAR
if not isDocker and "influxdb" in _raw_influx_url:
    INFLUXDB_URL = _raw_influx_url.replace("influxdb", "localhost")
elif isDocker and "localhost" in _raw_influx_url:
    INFLUXDB_URL = _raw_influx_url.replace("localhost", "influxdb").replace("127.0.0.1", "influxdb")
else:
    INFLUXDB_URL = _raw_influx_url

INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET")

_default_redis_host = "redis" if isDocker else "localhost"
REDIS_HOST = os.getenv("REDIS_HOST", _default_redis_host)
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
INGESTION_METRICS_RETENTION_SECONDS = int(
    os.getenv("INGESTION_METRICS_RETENTION_SECONDS", "86400")
)
AUDIT_EVENT_STREAM_MAXLEN = int(os.getenv("AUDIT_EVENT_STREAM_MAXLEN", "10000"))

SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


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
