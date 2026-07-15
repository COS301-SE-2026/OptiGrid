import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

try:
    from backend.ingestion.src.config import (
        INFLUXDB_BUCKET,
        INFLUXDB_ORG,
        INFLUXDB_TOKEN,
        INFLUXDB_URL,
        require_influx_config,
    )
except ModuleNotFoundError:
    from config import (  # type: ignore
        INFLUXDB_BUCKET,
        INFLUXDB_ORG,
        INFLUXDB_TOKEN,
        INFLUXDB_URL,
        require_influx_config,
    )

def seed_building_intervals(days_back: int = 30):
    require_influx_config()

    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    write_api = client.write_api(write_options=SYNCHRONOUS)
    print("Generating historic telemetry data for building")
    start_time = datetime.utcnow() - timedelta(days=days_back)
    end_time = datetime.utcnow()
    
    current_time = start_time
    points_buffer = []
    total_points = 0
    
    #giving each building a baseline load
    building_profiles = {
        "building-001": {"base": 35.0, "multiplier": 15.0},
        "building-002": {"base": 55.0, "multiplier": 25.0}, 
        "building-003": {"base": 20.0, "multiplier": 10.0} 
    }
    
    while current_time < end_time:
        hour = current_time.hour
        #sin wave for tracking standard day/light occupancy
        time_factor = np.sin((hour - 6) * np.pi / 12)
        
        #generating readings for all buildings at 2 second time intervals
        for b_id, profile in building_profiles.items():
            noise = np.random.uniform(-2.5, 2.5)
            raw_kw_reading = max(2.0, profile["base"] + (profile["multiplier"] * time_factor) + noise)
            
            point = Point("energy_consumption") \
                .tag("building_id", b_id) \
                .field("usage", round(raw_kw_reading, 2)) \
                .time(current_time, WritePrecision.NS)
            
            points_buffer.append(point)
        current_time += timedelta(seconds=2)
        
        #flush to influx when buffer hits 6000 items (2000 time steps x 3 buildings)
        if len(points_buffer) >= 6000:
            write_api.write(bucket=INFLUXDB_BUCKET, record=points_buffer)
            total_points += len(points_buffer)
            points_buffer = []
    #write any remaining data points
    if points_buffer:
        write_api.write(bucket=INFLUXDB_BUCKET, record=points_buffer)
        total_points += len(points_buffer)

    client.close()
    print(f"Seeding completed. Ingested {total_points} total points across all 3 buildings")

if __name__ == "__main__":
    seed_building_intervals(days_back=14)
