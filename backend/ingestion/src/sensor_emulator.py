import csv
import time
import itertools
import os
from datetime import datetime, timezone
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from dotenv import load_dotenv

load_dotenv()

#where to send data
INFLUX_URL = os.getenv("INFLUXDB_URL")
INFLUX_TOKEN = os.getenv("INFLUXDB_TOKEN")
INFLUX_ORG = os.getenv("INFLUXDB_ORG")
INFLUX_BUCKET = os.getenv("INFLUXDB_BUCKET")
CSV_PATH = os.path.join(os.path.dirname(__file__), "data.csv")

def emulate_sensor():
    #mock buidlings with their sensors and meters
    client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
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
        write_api.write(bucket=INFLUX_BUCKET, record=points_batch)
            
            # #send POST request to core API
            # try:
            #     response = requests.post(CORE_API_URL, json=payload, timeout=5)
            #     print(f"[{payload['sensor_id']}] Sent data for {payload['building_id']}. Core API status: {response.status_code}")
            # except Exception as e:
            #     print(f"Connection error reaching Core API Gateway for {profile['s_id']}: {e}")
        
        print("Batch transmission complete. Waiting 2 seconds...")
        time.sleep(2) #waiting before next batch

if __name__ == "__main__":
    emulate_sensor()
    