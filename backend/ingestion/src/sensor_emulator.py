import os
import asyncio
import hashlib
import random
import aiohttp
import numpy as np
from datetime import datetime, timezone
from supabase import create_client, Client

try:
    from dotenv import load_dotenv
    load_dotenv(".env.local")
    load_dotenv(".env")
except ImportError:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

raw_ingest_url = os.getenv("API_INGEST_URL", "http://localhost:8000/api/telemetry/ingest")
if "ingestion-api" in raw_ingest_url and not os.path.exists("/.dockerenv"):
    API_INGEST_URL = raw_ingest_url.replace("ingestion-api", "localhost")
else:
    API_INGEST_URL = raw_ingest_url

HARDWARE_API_KEY = os.getenv("HARDWARE_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be provided.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_building_profile(building_id: str) -> dict:
    """same deterministic parameter generator matching seeder.py"""
    h = int(hashlib.md5(building_id.encode("utf-8")).hexdigest(), 16)
    
    base_kw = 12.0 + ((h % 5300) / 100.0)
    amplitude_kw = 6.0 + (((h >> 16) % 1800) / 100.0)
    phase_shift_hrs = (((h >> 32) % 400) / 100.0) - 2.0
    nominal_voltage = 228.0 + (((h >> 48) % 400) / 100.0)

    return {
        "base_kw": base_kw,
        "amplitude_kw": amplitude_kw,
        "phase_shift_hrs": phase_shift_hrs,
        "nominal_voltage": nominal_voltage,
    }

async def post_telemetry(session, payload):
    headers = {"X-Sensor-Key": HARDWARE_API_KEY, "Content-Type": "application/json"}
    try:
        async with session.post(API_INGEST_URL, json=payload, headers=headers) as resp:
            if resp.status == 422:
                print(f"[WARN] Rejected by guardrail for {payload['building_id'][:8]} (Likely set to PHYSICAL)")
    except Exception as e:
        print(f"[ERROR] Failed to post telemetry: {e}")

async def run_global_emulator():
    print("Starting Global Multi-Building Emulator Worker.")
    
    # generate unique base loads for randomness across buildings
    building_profiles = {}

    async with aiohttp.ClientSession() as session:
        while True:
            # periodically sync active emulator buildings from supabase
            try:
                res = supabase.table("buildings").select("building_id, telemetry_source").eq("telemetry_source", "EMULATOR").execute()
                active_emulator_ids = [b["building_id"] for b in res.data]
            except Exception as e:
                print(f"Supabase sync failed: {e}")
                active_emulator_ids = []

            now = datetime.now(timezone.utc)
            timestamp = now.isoformat()
            hour_fraction = now.hour + (now.minute / 60.0) + (now.second / 3600.0)
            tasks = []
            for b_id in active_emulator_ids:
                if b_id not in building_profiles:
                    building_profiles[b_id] = get_building_profile(b_id)
                
                prof = building_profiles[b_id]
                adjusted_hour = hour_fraction + prof["phase_shift_hrs"]
                time_factor = np.sin((adjusted_hour - 6.0) * np.pi / 12.0)
                
                noise = random.uniform(-0.5, 0.5)
                power_kw = max(1.0, prof["base_kw"] + (prof["amplitude_kw"] * time_factor) + noise)
                
                voltage_v = round(prof["nominal_voltage"] + random.gauss(0.0, 0.8), 2)
                current_a = round((power_kw * 1000.0) / voltage_v, 2)

                payload = {
                    "building_id": b_id,
                    "sensor_id": f"emu_node_{b_id[:8]}",
                    "source_type": "EMULATOR",
                    "voltage_v": voltage_v,
                    "current_a": current_a,
                    "power_kw": round(power_kw, 3),
                    "timestamp": timestamp
                }
                tasks.append(post_telemetry(session, payload))

            if tasks:
                await asyncio.gather(*tasks)
            
            await asyncio.sleep(1.0)  # 1 hz tick rate

if __name__ == "__main__":
    asyncio.run(run_global_emulator())