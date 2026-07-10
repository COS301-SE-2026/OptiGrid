import os
import sys
import numpy as np
from datetime import datetime, timedelta, timezone
from influxdb_client import InfluxDBClient, Point, WritePrecision

try:
    from backend.ingestion.src.config import (
        INFLUXDB_BUCKET,
        INFLUXDB_ORG,
        INFLUXDB_TOKEN,
        INFLUXDB_URL,
        require_influx_config,
    )
    
except ModuleNotFoundError:
    from config import (
        INFLUXDB_BUCKET,
        INFLUXDB_ORG,
        INFLUXDB_TOKEN,
        INFLUXDB_URL,
        require_influx_config,
    )


#function to seed each building in the list
def seed_calculated_buildings(building_ids: list, days_back: int = 14):
    require_influx_config()
    if not building_ids:
        print("No buildings ids provided to seeder.")
        return

    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    write_api = client.write_api()
    print(f"Generating telemetry data for {len(building_ids)} buildings.")
    
    # making sure to track the time range of when the seeder must seed historically
    # this is also timezone independent
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=days_back)
    
    current_time = start_time
    points_buffer = []
    total_points = 0
    
    while current_time <= end_time:
        hour = current_time.hour
        # must take into accoun the diurnal behaviour of energy usage
        time_factor = np.sin((hour - 6) * np.pi / 12)
        for b_id in building_ids:
            # base energy draw and noise for varience
            base_load = 25.0
            multiplier = 12.0
            noise = np.random.uniform(-3.0, 3.0)
            
            raw_usage = max(1.5, base_load + (multiplier * time_factor) + noise)
            
            point = Point("energy_telemetry") \
                .tag("building_id", b_id) \
                .field("usage", round(raw_usage, 2)) \
                .time(current_time, WritePrecision.NS)
            
            points_buffer.append(point)
        # hourly increments
        current_time += timedelta(hours=1)
        
        # flushing the points buffer to influx when it gets too large
        if len(points_buffer >= 1000):
            write_api.write(bucket=INFLUXDB_BUCKET, record=points_buffer)
            total_points += len(points_buffer)
            points_buffer = []
    
    # flush remaining points to influx
    if points_buffer:
        write_api.write(bucket=INFLUXDB_BUCKET, record=points_buffer)
        total_points += len(points_buffer)
    
    write_api.close()
    client.close()
    print(f"Seeding finished. Pushed {total_points} total metrics to influx.")


if __name__ == "__main__":
    current_buildings = [
        
    ]
    seed_calculated_buildings(building_ids=current_buildings, days_back=14)
