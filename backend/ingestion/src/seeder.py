import os
import hashlib
import json
import random
import zlib
import functools
import multiprocessing
import asyncio
import aiohttp
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from supabase import create_client
from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS

try:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
    load_dotenv(".env")
except ImportError:
    pass

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://localhost:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "dummy")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "OptiGrid")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "EnergyData")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SEEDER_COST_ZAR_PER_KWH = 2.50
ANOMALY_FREQUENCY_MULTIPLIER = float(os.getenv("ANOMALY_FREQUENCY_MULTIPLIER", "1.0"))

if not os.path.exists("/.dockerenv") and "localhost" not in INFLUXDB_URL:
    INFLUXDB_URL = INFLUXDB_URL.replace("influxdb", "localhost")

ACTIVE_SUPABASE_URL = SUPABASE_URL
ACTIVE_SUPABASE_KEY = SUPABASE_KEY

if not ACTIVE_SUPABASE_URL or not ACTIVE_SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be provided.")

def get_sensor_profile(sensor_id: str, sqft: float = 1000.0, building_type: str = "Commercial", num_sensors: int = 1) -> dict:
    h = int(hashlib.sha256(sensor_id.encode("utf-8")).hexdigest(), 16)
    multipliers = {
        "Residential": 0.002, "Commercial": 0.005, "Industrial": 0.015,
        "Healthcare": 0.008, "Construction": 0.003, "Mixed_Use": 0.004,
        "ShoppingCentre": 0.007, "Other": 0.004
    }
    mult = multipliers.get(building_type, 0.004) if building_type else 0.004
    hash_variance = 0.8 + ((h % 400) / 1000.0) 
    try:
        sqft_val = float(sqft) if sqft else 0.0
    except (ValueError, TypeError):
        sqft_val = 0.0

    if sqft_val <= 0:
        base_kw = 5.0 + (h % 20)
        amp_kw = 10.0 + (h % 30)
    else:
        total_base = sqft_val * mult * hash_variance
        total_amp = total_base * 2.0
        base_kw = max(0.5, total_base / max(1, num_sensors))
        amp_kw = max(1.0, total_amp / max(1, num_sensors))
        
    voltage_options = [230.0, 240.0, 120.0, 400.0]
    nominal_voltage = voltage_options[h % len(voltage_options)]
    
    return {
        "base_kw": base_kw,
        "amplitude_kw": amp_kw,
        "phase_shift_hrs": (h % 200) / 100.0, 
        "nominal_voltage": nominal_voltage,
    }

def get_real_sensors():
    try:
        supabase = create_client(ACTIVE_SUPABASE_URL, ACTIVE_SUPABASE_KEY)
        res_b = supabase.table("buildings").select("building_id, square_footage, building_type").execute()
        buildings = {b["building_id"]: b for b in (res_b.data if res_b.data else [])}
        if not buildings: return []
        res_s = supabase.table("sensors").select("sensor_id, building_id").in_("building_id", list(buildings.keys())).execute()
        sensors = res_s.data if res_s.data else []
        sensors_per_building = {}
        for s in sensors:
            sensors_per_building[s["building_id"]] = sensors_per_building.get(s["building_id"], 0) + 1
        for s in sensors:
            b_id = s["building_id"]
            s["square_footage"] = buildings[b_id].get("square_footage")
            s["building_type"] = buildings[b_id].get("building_type")
            s["num_sensors"] = sensors_per_building[b_id]
        return sensors
    except Exception as e:
        print(f"Failed to fetch sensors from Supabase: {e}")
        return []

async def _send_chunks_concurrently(chunks, url, token, org, bucket):
    headers = {
        "Authorization": f"Token {token}",
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Encoding": "gzip"
    }
    params = {"org": org, "bucket": bucket, "precision": "ns"}
    sem = asyncio.Semaphore(3) 
    
    async def post_chunk(session, chunk):
        async with sem:
            async with session.post(f"{url}/api/v2/write", headers=headers, params=params, data=chunk) as resp:
                if resp.status >= 400:
                    text = await resp.text()
                    print(f"Failed to write chunk: {resp.status} - {text}")
                resp.raise_for_status()

    async with aiohttp.ClientSession() as session:
        tasks = [post_chunk(session, chunk) for chunk in chunks]
        await asyncio.gather(*tasks)

def generate_sensor_data(s):
    s_id = s["sensor_id"]
    b_id = s["building_id"]
    start_ts = s["start_ts"]
    end_ts = s["end_ts"]
    
    prof = get_sensor_profile(s_id, s.get("square_footage"), s.get("building_type"), s.get("num_sensors"))
    seed_val = int(hashlib.sha256(s_id.encode()).hexdigest(), 16) % (2**32)
    rng = np.random.default_rng(seed=seed_val)

    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG, enable_gzip=True, timeout=60000)
    write_api = client.write_api(write_options=SYNCHRONOUS)
    total_points = 0
    curr_start = start_ts
    try:
        while curr_start < end_ts:
            current_end = min(current_start + 86400.0, end_ts)
            ts_array = np.arange(current_start, current_end, 2.0)
            if len(ts_array) == 0:
                curr_start = current_end
                continue
            
            num_points = len(ts_array)
            total_points += num_points

            dt_index = pd.to_datetime(ts_array, unit='s', utc=True)
            hour_fraction = dt_index.hour + (dt_index.minute / 60.0) + (dt_index.second / 3600.0)
            month_fraction = dt_index.month + (dt_index.day / 30.0)
            weekday = dt_index.weekday
            weekend_factor = np.where(weekday >= 5, 0.6, 1.0)
            seasonal_factor = 1.0 + 0.3 * np.cos(2.0 * np.pi * (month_fraction - 1.0) / 12.0)
            ts_ns_str = (ts_array * 1e9).astype(np.int64).astype(str)

            adjusted_hour = hour_fraction + prof["phase_shift_hrs"]
            time_factor = np.sin((adjusted_hour - 6.0) * np.pi / 12.0)
            evening_bump = np.exp(-0.5 * ((adjusted_hour - 18.0) / 2.0)**2) * 0.4

            noise = rng.normal(loc=0.0, scale=max(0.8, prof["amplitude_kw"] * 0.15), size=num_points)
            anomaly_mult = np.ones(num_points)
            base_anomalies_expected = (num_points * 2.0) / (30 * 24 * 3600)
            num_anomalies_expected = base_anomalies_expected * ANOMALY_FREQUENCY_MULTIPLIER
            num_anomalies = rng.poisson(num_anomalies_expected)

            for _ in range(num_anomalies):
                start_idx = rng.integers(0, num_points)
                duration_pts = rng.integers(30, 150)
                end_idx = min(start_idx + duration_pts, num_points)
                if rng.random() > 0.5:
                    multiplier = rng.uniform(3.0, 5.0)
                else:
                    multiplier = rng.uniform(0.1, 0.3)
                anomaly_mult[start_idx:end_idx] = multiplier

            power_kw = np.maximum(1.0, (prof["base_kw"] + (prof["amplitude_kw"] * (time_factor + evening_bump))) * weekend_factor * seasonal_factor + noise) * anomaly_mult
            voltage_v = np.round(prof["nominal_voltage"] + rng.normal(loc=0.0, scale=0.8, size=num_points), 2)
            current_a = np.round((power_kw * 1000.0) / voltage_v, 2)
            cost_zar = np.round(power_kw * SEEDER_COST_ZAR_PER_KWH, 2)
            power_kw = np.round(power_kw, 3)

            power_kw_lst = power_kw.tolist()
            cost_zar_lst = cost_zar.tolist()
            voltage_v_lst = voltage_v.tolist()
            current_a_lst = current_a.tolist()
            ts_ns_lst = ts_ns_str.tolist()

            lines = [
                f"energy_telemetry,building_id={b_id},sensor_id={s_id} usage={u},cost_zar={c},voltage_v={v},current_a={a} {t}"
                for u, c, v, a, t in zip(power_kw_lst, cost_zar_lst, voltage_v_lst, current_a_lst, ts_ns_lst)
            ]
            
            chunk_size = 25000
            for i in range(0, len(lines), chunk_size):
                chunk = "\n".join(lines[i:i + chunk_size])
                write_api.write(bucket=INFLUXDB_BUCKET, record=chunk)
                
            curr_start = current_end
    finally:
        write_api.close()
        client.close()

    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Seeded {total_points} points for sensor {s_id}")
    return total_points

def _check_sensor_gap(s, query_api, days_back, end_time):
    end_ts = end_time.timestamp()
    q = f'from(bucket: "{INFLUXDB_BUCKET}") |> range(start: -35d) |> filter(fn: (r) => r._measurement == "energy_telemetry" and r.sensor_id == "{s["sensor_id"]}") |> last() |> keep(columns: ["_time"])'
    try:
        res = query_api.query(q)
        last_ts = None
        for table in res:
            for record in table.records:
                ts = record.get_time()
                if last_ts is None or ts > last_ts:
                    last_ts = ts
                    
        if last_ts:
            start_ts = last_ts.timestamp() + 2.0
        else:
            start_ts = (end_time - timedelta(days=days_back)).timestamp()
            
        if end_ts - start_ts > 10.0:
            s["start_ts"] = start_ts
            s["end_ts"] = end_ts
            return s
    except Exception as e:
        print(f"Warning: Failed to check existing data for sensor {s['sensor_id']}: {e}")
    return None

def _get_sensors_to_seed(sensors_data, query_api, days_back, end_time):
    sensors_to_seed = []
    for s in sensors_data:
        sensor = _check_sensor_gap(s, query_api, days_back, end_time)
        if sensor:
            sensors_to_seed.append(sensor)
    return sensors_to_seed

def seed_calculated_buildings(sensors_data: list, days_back: int = 7):
    if not sensors_data:
        print("No sensor data provided to seeder.")
        return

    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG, enable_gzip=True)
    query_api = client.query_api()
    end_time = datetime.now(timezone.utc)
    
    print("Checking which sensors need seeding and finding gaps...")
    sensors_to_seed = _get_sensors_to_seed(sensors_data, query_api, days_back, end_time)
            
    if not sensors_to_seed:
        print("All sensors are fully seeded up to present. Skipping seeder.")
        client.close()
        return

    print(f"Generating telemetry data for {len(sensors_to_seed)} sensors to catch up to present...")

    total_points = 0
    print("Spawning multiprocessing pool to generate maths and push to InfluxDB directly...")
    pool_size = min(len(sensors_to_seed), multiprocessing.cpu_count() or 1)
    with multiprocessing.Pool(processes=pool_size) as pool:
        for pts in pool.map(generate_sensor_data, sensors_to_seed):
            total_points += pts

    client.close()
    print(f"Seeding finished. Pushed {total_points} total metrics to InfluxDB.")

if __name__ == "__main__":
    real_sensors = get_real_sensors()
    if real_sensors:
        seed_calculated_buildings(sensors_data=real_sensors, days_back=30)
    else:
        print("No active sensors found in Supabase database to seed.")
