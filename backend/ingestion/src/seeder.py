import os
import sys
import hashlib
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
        INFLUXDB_URL = os.getenv("INFLUXDB_URL", "https://influxdb:8086")
        INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "")
        INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "OptiGrid")
        INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "energy_telemetry")
        SUPABASE_URL = os.getenv("SUPABASE_URL", "")
        SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
        SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        def require_influx_config(): 
            """intentionally left empty, configuration validation is handled dynamically"""
            pass

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

def get_building_profile(building_id: str) -> dict:
    """Derive a unique, deterministic profile parameters from building UUID hash."""
    h = int(hashlib.md5(building_id.encode("utf-8")).hexdigest(), 16)
    
    # base load: 12.0 kW to 65.0 kW
    base_kw = 12.0 + ((h % 5300) / 100.0)
    # peak amplitude swing: 6.0 kW to 24.0 kW
    amplitude_kw = 6.0 + (((h >> 16) % 1800) / 100.0)
    # diurnal peak shift offset: -2.0 to +2.0 hours
    phase_shift_hrs = (((h >> 32) % 400) / 100.0) - 2.0
    # nominal voltage: 228.0 V to 232.0 V
    nominal_voltage = 228.0 + (((h >> 48) % 400) / 100.0)

    return {
        "base_kw": base_kw,
        "amplitude_kw": amplitude_kw,
        "phase_shift_hrs": phase_shift_hrs,
        "nominal_voltage": nominal_voltage,
    }

def get_real_building_ids() -> list:
    """Fetch real building UUIDs directly from Supabase (prioritizing ACTIVE buildings)."""
    if not ACTIVE_SUPABASE_URL or not ACTIVE_SUPABASE_KEY:
        print("Supabase credentials (SUPABASE_URL / SUPABASE_KEY) not found in configuration.")
        return []

    try:
        supabase = create_client(ACTIVE_SUPABASE_URL, ACTIVE_SUPABASE_KEY)
        res = supabase.table("buildings").select("building_id").execute()
        return [row["building_id"] for row in res.data] if res.data else []
    except Exception as e:
        print(f"Failed to fetch real buildings from Supabase: {e}")
        return []


def get_real_building_ids() -> list:
    if not ACTIVE_SUPABASE_URL or not ACTIVE_SUPABASE_KEY:
        print("Supabase credentials not found in configuration.")
        return []

    try:
        supabase = create_client(ACTIVE_SUPABASE_URL, ACTIVE_SUPABASE_KEY)
        res = supabase.table("buildings").select("building_id").execute()
        return [row["building_id"] for row in res.data] if res.data else []
    except Exception as e:
        print(f"Failed to fetch real buildings from Supabase: {e}")
        return []

def seed_calculated_buildings(building_ids: list, days_back: int = 14):
    if not building_ids:
        print("No building IDs provided to seeder.")
        return

    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    write_api = client.write_api()
    print(f"Generating telemetry data for {len(building_ids)} distinct buildings across the past {days_back} days.")
    
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=days_back)
    
    # Pre-calculate deterministic building profiles
    profiles = {b_id: get_building_profile(b_id) for b_id in building_ids}

    current_time = start_time
    points_buffer = []
    total_points = 0
    rng = np.random.default_rng(seed=42)
    while current_time <= end_time:
        hour_fraction = current_time.hour + (current_time.minute / 60.0)
        
        for b_id, prof in profiles.items():
            adjusted_hour = hour_fraction + prof["phase_shift_hrs"]
            time_factor = np.sin((adjusted_hour - 6.0) * np.pi / 12.0)
            
            # Seeded noise
            noise = rng.uniform(-0.8, 0.8)
            power_kw = max(1.0, prof["base_kw"] + (prof["amplitude_kw"] * time_factor) + noise)
            
            voltage_v = round(prof["nominal_voltage"] + rng.normal(0.0, 0.8), 2)
            current_a = round((power_kw * 1000.0) / voltage_v, 2)
            cost_zar = round(power_kw * SEEDER_COST_ZAR_PER_KWH, 2)

            point = (
                Point("energy_telemetry")
                .tag("building_id", b_id)
                .tag("sensor_id", f"emu_node_{b_id[:8]}")
                .field("usage", round(power_kw, 3))
                .field("cost_zar", cost_zar)
                .field("voltage_v", voltage_v)
                .field("current_a", current_a)
                .time(current_time, WritePrecision.NS)
            )
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