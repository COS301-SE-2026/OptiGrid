import csv
import time
import itertools
import os
from datetime import datetime, timezone
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

CSV_PATH = os.path.join(os.path.dirname(__file__), "data.csv")

def emulate_sensor():
    #mock buidlings with their sensors and meters
    require_influx_config()

    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    write_api = client.write_api(write_options=SYNCHRONOUS)
    building_profiles = [
        {"b_id": "building-001", "m_id": "meter-001", "s_id": "sensor-001"}, 
        {"b_id": "building-002", "m_id": "meter-002", "s_id": "sensor-002"}, 
        {"b_id": "building-003", "m_id": "meter-003", "s_id": "sensor-003"}
    ]
    
    #try loading CSV data file
    try:
        with open(CSV_PATH, mode='r') as file:
            reader = list(csv.DictReader(file))
    except FileNotFoundError:
        print(f"Error: Could not locate data.csv file at expected path: {CSV_PATH}")
        return

    print(f"IoT Hardware Emulator Started.")
    print("Streaming all 3 buildings simultaneously every 2 seconds...")

    #cycle through CSV rows infinitely
    csv_cycle = itertools.cycle(reader)
    while True:
        #take one row per building (3 rows total per batch)
        points_batch = []
        batch_rows = [next(csv_cycle) for _ in range(len(building_profiles))]
        #send data for each building
        for profile, row in zip(building_profiles, batch_rows):
            point = Point("energy_consumption") \
                .tag("building_id", profile["b_id"]) \
                .tag("sensor_id", profile["s_id"]) \
                .tag("meter_id", profile["m_id"]) \
                .field("usage", float(row.get('USAGE', '0'))) \
                .time(datetime.utcnow(), WritePrecision.NS)
                
            points_batch.append(point)
        write_api.write(bucket=INFLUXDB_BUCKET, record=points_batch)
            
        print("Batch transmission complete. Waiting 2 seconds...")
        time.sleep(2) #waiting before next batch

if __name__ == "__main__":
    emulate_sensor()
