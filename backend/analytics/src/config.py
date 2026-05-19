import os

# influxDB Configuration
INFLUX_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUX_TOKEN = os.getenv("INFLUXDB_TOKEN", "mock-token")
INFLUX_ORG = os.getenv("INFLUXDB_ORG", "optigrid-org")
INFLUX_BUCKET = os.getenv("INFLUXDB_BUCKET", "telemetry_bucket")

# supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-supabase-project.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "mock-key")

# MLOps Configuration
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
MLFLOW_EXPERIMENT_NAME = "OptiGrid_Anomaly_Detection"