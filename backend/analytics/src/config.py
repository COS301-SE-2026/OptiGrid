import os
from dotenv import load_dotenv

load_dotenv()

# influxDB Configuration
INFLUX_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUX_TOKEN = os.getenv("INFLUXDB_TOKEN", "mock-token")
INFLUX_ORG = os.getenv("INFLUXDB_ORG", "optigrid-org")
INFLUX_BUCKET = os.getenv("INFLUXDB_BUCKET", "telemetry_bucket")

# supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# MLOps Configuration
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
MLFLOW_EXPERIMENT_NAME = "OptiGrid_Anomaly_Detection"\

UTILITY_RATE_KWH = 0.22 #in dollars, using eskom's current rate
