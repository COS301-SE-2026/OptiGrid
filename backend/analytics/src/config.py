import os
from dotenv import load_dotenv

load_dotenv()

# influxDB Configuration
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://influxdb:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "mock-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "optigrid-org")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "EnergyData")
INFLUXDB_HOST = "influxdb"
# supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# MLOps Configuration
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
MLFLOW_EXPERIMENT_NAME = "OptiGrid_Anomaly_Detection"\

UTILITY_RATE_KWH = 0.22 #in dollars, using eskom's current rate
