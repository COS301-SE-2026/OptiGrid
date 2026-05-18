import csv
import requests
import time
import itertools
import os

#where to send data
CORE_API_URL = os.getenv("CORE_API_URL", "http://localhost:8000/ingest")
CSV_PATH = os.path.join(os.path.dirname(__file__), "data.csv")

def emulate_sensor():
    #mock buidlings with their sensors and meters
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
        batch_rows = [next(csv_cycle) for _ in range(len(building_profiles))]
        
        #send data for each building
        for profile, row in zip(building_profiles, batch_rows):
            payload = {
                "sensor_id": profile["s_id"],
                "building_id": profile["b_id"],
                "meter_id": profile["m_id"],
                "type": row.get('TYPE', ''),
                "date": row.get('DATE', ''),
                "start_time": row.get('START TIME', ''),
                "end_time": row.get('END TIME', ''),
                "usage": row.get('USAGE', '0'),
                "units": row.get('UNITS', ''),
                "cost": row.get('COST', '$0.00')
            }
            
            #send POST request to core API
            try:
                response = requests.post(CORE_API_URL, json=payload, timeout=5)
                print(f"[{payload['sensor_id']}] Sent data for {payload['building_id']}. Core API status: {response.status_code}")
            except Exception as e:
                print(f"Connection error reaching Core API Gateway for {profile['s_id']}: {e}")
        
        print("Batch transmission complete. Waiting 2 seconds...")
        time.sleep(2) #waiting before next batch

if __name__ == "__main__":
    emulate_sensor()
    