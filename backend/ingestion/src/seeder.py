import os
import sys
import json
import numpy as np
from datetime import datetime, timedelta, timezone
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)


try:
    from backend.ingestion.src.config import (
        INFLUXDB_BUCKET,
        INFLUXDB_ORG,
        INFLUXDB_TOKEN,
        INFLUXDB_URL,
        SUPABASE_KEY,
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        require_influx_config,
    )
except ModuleNotFoundError:
    try:
        from config import (
            INFLUXDB_BUCKET,
            INFLUXDB_ORG,
            INFLUXDB_TOKEN,
            INFLUXDB_URL,
            SUPABASE_KEY,
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
            require_influx_config,
        )
    except ModuleNotFoundError:
        INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://influxdb:8086")
        INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "")
        INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "OptiGrid")
        INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "energy_telemetry")
        SUPABASE_URL = os.getenv("SUPABASE_URL", "")
        SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
        SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        def require_influx_config(): pass

from influxdb_client import InfluxDBClient, Point, WritePrecision
from supabase import create_client

ACTIVE_SUPABASE_KEY = (
    SUPABASE_KEY
    or SUPABASE_SERVICE_ROLE_KEY
    or os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or ""
)
ACTIVE_SUPABASE_URL = (
    SUPABASE_URL
    or os.getenv("SUPABASE_URL")
    or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    or ""
)

# A stable test tariff so seeded costs can be compared consistently in the UI.
SEEDER_COST_ZAR_PER_KWH = float(os.getenv("SEEDER_COST_ZAR_PER_KWH", "2.50"))


def seeded_cost_zar(usage_kwh: float) -> float:
    return round(usage_kwh * SEEDER_COST_ZAR_PER_KWH, 2)


def get_real_building_ids() -> list:
    """Fetch real building UUIDs directly from Supabase (prioritizing ACTIVE buildings)."""
    if not ACTIVE_SUPABASE_URL or not ACTIVE_SUPABASE_KEY:
        print("Supabase credentials (SUPABASE_URL / SUPABASE_KEY) not found in configuration.")
        return []

    try:
        supabase = create_client(ACTIVE_SUPABASE_URL, ACTIVE_SUPABASE_KEY)
        
        # Query for ACTIVE buildings first
        res = (
            supabase.table("buildings")
            .select("building_id")
            .execute()
        )
        building_ids = [row["building_id"] for row in res.data] if res.data else []

        return building_ids
    except Exception as e:
        print(f"Failed to fetch real buildings from Supabase: {e}")
        return []


def seed_calculated_buildings(building_ids: list, days_back: int = 14):
    """Generate and write synthetic hourly usage telemetry to InfluxDB for target buildings."""
    if not building_ids:
        print("No building IDs provided to seeder.")
        return

    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    write_api = client.write_api()
    print(f"Generating telemetry data for {len(building_ids)} buildings across the past {days_back} days.")
    
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=days_back)
    
    current_time = start_time
    points_buffer = []
    total_points = 0
    
    while current_time <= end_time:
        hour = current_time.hour
        # Diurnal behavior modeling
        time_factor = np.sin((hour - 6) * np.pi / 12)
        for b_id in building_ids:
            base_load = 25.0
            multiplier = 12.0
            noise = np.random.uniform(-3.0, 3.0)
            
            raw_usage = max(1.5, base_load + (multiplier * time_factor) + noise)
            
            point = Point("energy_telemetry") \
                .tag("building_id", b_id) \
                .field("usage", round(raw_usage, 2)) \
                .field("cost_zar", seeded_cost_zar(raw_usage)) \
                .time(current_time, WritePrecision.NS)
            
            points_buffer.append(point)

        current_time += timedelta(hours=1)
        
        if len(points_buffer) >= 1000:
            write_api.write(bucket=INFLUXDB_BUCKET, record=points_buffer)
            total_points += len(points_buffer)
            points_buffer = []
    
    if points_buffer:
        write_api.write(bucket=INFLUXDB_BUCKET, record=points_buffer)
        total_points += len(points_buffer)
    
    write_api.close()
    client.close()
    print(f"Seeding finished. Pushed {total_points} total metrics to InfluxDB.")

if __name__ == "__main__":
    real_ids = get_real_building_ids()
    if real_ids:
        seed_calculated_buildings(building_ids=real_ids, days_back=60)
    else:
        print("No active buildings found in Supabase database to seed.")