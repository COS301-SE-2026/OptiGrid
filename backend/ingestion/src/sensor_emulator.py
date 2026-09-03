import os
import asyncio
import hashlib
import random
import secrets
import aiohttp
import numpy as np
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client

try:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
    load_dotenv(".env")
except ImportError:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

DOCKERENV = "/.dockerenv"
secure_random = secrets.SystemRandom()

raw_ingest_url = os.getenv("API_INGEST_URL", "http://localhost:8000/api/telemetry/ingest")
if "ingestion-api" in raw_ingest_url and not os.path.exists(DOCKERENV):
    API_INGEST_URL = raw_ingest_url.replace("ingestion-api", "localhost")
else:
    API_INGEST_URL = raw_ingest_url

HARDWARE_API_KEY = os.getenv("HARDWARE_API_KEY")
ANOMALY_FREQUENCY_MULTIPLIER = float(os.getenv("ANOMALY_FREQUENCY_MULTIPLIER", "1.0"))

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be provided.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_sensor_profile(sensor_id: str, sqft: float = 1000.0, building_type: str = "Commercial", num_sensors: int = 1) -> dict:
    """deterministic parameter generator scaling by sqft and building type, split among sensors"""
    h = int(hashlib.sha256(sensor_id.encode("utf-8")).hexdigest(), 16)
    
    multipliers = {
        "Residential": 0.002,
        "Commercial": 0.005,
        "Industrial": 0.015,
        "Healthcare": 0.008,
        "Construction": 0.003,
        "Mixed_Use": 0.004,
        "ShoppingCentre": 0.007,
        "Other": 0.004
    }
    
    mult = multipliers.get(building_type, 0.004) if building_type else 0.004
    hash_variance = 0.8 + ((h % 400) / 1000.0) 
    
    try:
        sqft_val = float(sqft) if sqft else 0.0
    except (ValueError, TypeError):
        sqft_val = 0.0

    if num_sensors > 0:
        sqft_val = sqft_val / num_sensors

    if sqft_val > 0:
        base_kw = sqft_val * mult * hash_variance
    else:
        base_kw = (12.0 + ((h % 5300) / 100.0)) / max(1, num_sensors)
        
    amp_variance = 0.3 + (((h >> 16) % 400) / 1000.0)
    amplitude_kw = base_kw * amp_variance
    phase_shift_hrs = (((h >> 32) % 400) / 100.0) - 2.0
    nominal_voltage = 228.0 + (((h >> 48) % 400) / 100.0)

    return {
        "base_kw": max(1.0, base_kw),
        "amplitude_kw": max(0.5, amplitude_kw),
        "phase_shift_hrs": phase_shift_hrs,
        "nominal_voltage": nominal_voltage,
    }

from influxdb_client import InfluxDBClient

def get_last_influx_time():
    INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
    INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "dummy")
    INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "OptiGrid")
    INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "EnergyData")
    
    # Check localhost if running outside docker
    if not os.path.exists(DOCKERENV) and "localhost" not in INFLUXDB_URL:
        INFLUXDB_URL = INFLUXDB_URL.replace("influxdb", "localhost")
        
    try:
        client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
        query = f'from(bucket: "{INFLUXDB_BUCKET}") |> range(start: -1d) |> filter(fn: (r) => r._measurement == "energy_telemetry") |> last()'
        result = client.query_api().query(query=query)
        last_ts = None
        for table in result:
            for record in table.records:
                ts = record.get_time()
                if last_ts is None or ts > last_ts:
                    last_ts = ts
        return last_ts
    except Exception as e:
        print(f"Warning: Could not fetch last timestamp from InfluxDB: {e}")
        return None

async def post_telemetry(session, payload):
    headers = {"Content-Type": "application/json"}
    if HARDWARE_API_KEY:
        headers["Authorization"] = f"Bearer {HARDWARE_API_KEY}"
        
    try:
        async with session.post(API_INGEST_URL, json=payload, headers=headers) as resp:
            if resp.status not in (200, 201):
                text = await resp.text()
                print(f"Failed to post telemetry: {resp.status} - {text}")
    except Exception as e:
        print(f"Network error posting telemetry: {e}")

def _generate_sensor_payload(s, b_id, b, num_sensors, sensor_profiles, now, hour_fraction, timestamp, total_sensors=1):
    s_id = s["sensor_id"]
    if s_id not in sensor_profiles:
        sensor_profiles[s_id] = get_sensor_profile(s_id, b.get("square_footage"), b.get("building_type"), num_sensors)
        sensor_profiles[s_id]["anomaly_active_until"] = 0
        sensor_profiles[s_id]["anomaly_mult"] = 1.0
    
    prof = sensor_profiles[s_id]
    current_unix = now.timestamp()
    if current_unix > prof.get("anomaly_active_until", 0):
        probability_per_tick = (2.5 / 43200.0) * ANOMALY_FREQUENCY_MULTIPLIER / max(1, total_sensors)
        if secure_random.random() < probability_per_tick:
            prof["anomaly_active_until"] = current_unix + secure_random.randint(60, 300)
            prof["anomaly_mult"] = secure_random.choice([
                secure_random.uniform(1.3, 1.6), # low
                secure_random.uniform(0.6, 0.8), # low
                secure_random.uniform(1.6, 2.0), # medium
                secure_random.uniform(0.4, 0.6), # medium
                secure_random.uniform(2.0, 3.0), # high
                secure_random.uniform(3.0, 5.0), # critical
                secure_random.uniform(0.1, 0.3)  # critical
            ])
        else:
            prof["anomaly_mult"] = 1.0
    
    anomaly_mult = prof.get("anomaly_mult", 1.0)
    adjusted_hour = hour_fraction + prof["phase_shift_hrs"]
    time_factor = np.sin((adjusted_hour - 6.0) * np.pi / 12.0)
    evening_bump = np.exp(-0.5 * ((adjusted_hour - 18.0) / 2.0)**2) * 0.4
    weekday = now.weekday()
    weekend_factor = 0.6 if weekday >= 5 else 1.0
    month_fraction = now.month + (now.day / 30.0)
    seasonal_factor = 1.0 + 0.3 * np.cos(2.0 * np.pi * (month_fraction - 1.0) / 12.0)
    
    noise = secure_random.gauss(0.0, max(0.8, prof["amplitude_kw"] * 0.15))
    power_kw = max(1.0, (prof["base_kw"] + (prof["amplitude_kw"] * (time_factor + evening_bump))) * weekend_factor * seasonal_factor + noise) * anomaly_mult
    voltage_v = round(prof["nominal_voltage"] + secure_random.gauss(0.0, 0.8), 2)
    current_a = round((power_kw * 1000.0) / voltage_v, 2)

    return {
        "building_id": b_id,
        "sensor_id": s_id,
        "source_type": "EMULATOR",
        "voltage_v": voltage_v,
        "current_a": current_a,
        "power_kw": round(power_kw, 3),
        "timestamp": timestamp
    }

def _fetch_supabase_sensors():
    res_b = supabase.table("buildings").select("building_id, telemetry_source, square_footage, building_type").eq("telemetry_source", "EMULATOR").execute()
    active_emulator_buildings = {b["building_id"]: b for b in (res_b.data if res_b.data else [])}
    
    if active_emulator_buildings:
        res_s = supabase.table("sensors").select("sensor_id, building_id").in_("building_id", list(active_emulator_buildings.keys())).execute()
        active_sensors = res_s.data if res_s.data else []
    else:
        active_sensors = []
        
    sensors_per_building = {}
    for s in active_sensors:
        sensors_per_building[s["building_id"]] = sensors_per_building.get(s["building_id"], 0) + 1
        
    return active_emulator_buildings, active_sensors, sensors_per_building

async def _run_single_iteration(
    session, iteration_count, active_emulator_buildings, active_sensors,
    sensors_per_building, sensor_profiles, current_time
):
    if iteration_count % 30 == 0:
        try:
            active_emulator_buildings, active_sensors, sensors_per_building = _fetch_supabase_sensors()
        except Exception as e:
            print(f"Supabase sync failed: {e}")
            
    now = datetime.now(timezone.utc)
    if current_time < now - timedelta(seconds=4):
        current_time += timedelta(seconds=2)
        sleep_duration = 0.0
    else:
        current_time = now
        sleep_duration = 2.0
        
    timestamp = current_time.isoformat()
    hour_fraction = current_time.hour + (current_time.minute / 60.0) + (current_time.second / 3600.0)
    tasks = []
    
    for s in active_sensors:
        b_id = s["building_id"]
        b = active_emulator_buildings.get(b_id, {})
        num_sensors = sensors_per_building.get(b_id, 1)
        
        payload = _generate_sensor_payload(s, b_id, b, num_sensors, sensor_profiles, now, hour_fraction, timestamp, len(active_sensors))
        tasks.append(post_telemetry(session, payload))

    if tasks:
        await asyncio.gather(*tasks)
        if (iteration_count + 1) % 10 == 0:
            print(f"[{now.strftime('%H:%M:%S')}] Successfully pushed telemetry for {len(tasks)} sensors.")
    
    if sleep_duration > 0:
        await asyncio.sleep(sleep_duration)
        
    return active_emulator_buildings, active_sensors, sensors_per_building, current_time

async def run_global_emulator():
    print(f"Starting OptiGrid Sensor Emulator (Target: {API_INGEST_URL})")
    sensor_profiles = {}

    async with aiohttp.ClientSession() as session:
        iteration_count = 0
        active_emulator_buildings = {}
        active_sensors = []
        sensors_per_building = {}
        
        current_time = get_last_influx_time()
        now_ts = datetime.now(timezone.utc)
        if current_time and current_time > now_ts - timedelta(minutes=5):
            print(f"Found existing data up to {current_time}. Resuming exactly from this point...")
            current_time += timedelta(seconds=2)
        else:
            if current_time:
                print(f"Existing data is too old ({current_time}), Snapping to current time to avoid hitting api")
            else:
                print("No existing data found. Starting at current time.")
            current_time = now_ts
            
        while True:
            res = await _run_single_iteration(
                session, iteration_count, active_emulator_buildings, active_sensors,
                sensors_per_building, sensor_profiles, current_time
            )
            active_emulator_buildings, active_sensors, sensors_per_building, current_time = res
            iteration_count += 1

if __name__ == "__main__":
    asyncio.run(run_global_emulator())