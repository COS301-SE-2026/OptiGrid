import math
import time
import random
from datetime import datetime
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
    from config import (
        INFLUXDB_BUCKET,
        INFLUXDB_ORG,
        INFLUXDB_TOKEN,
        INFLUXDB_URL,
        require_influx_config,
    )


def calculate_usage(building_index: int, current_time: datetime) -> float:
    # base power draw, varies per building using the building index
    base_load = 45.0 + (building_index * 12.5)
    # peak capacity
    peak_capacity = 180.0 + (building_index * 30.0)
    # diurnal model
    hour = current_time.hour + (current_time.minute / 60.0) + (current_time.second / 3600.0)
    # sine wave offset to make sure that peak load is around 14:00
    time_factor = math.sin(math.pi * ((hour - 2.0) / 24.0))
    time_factor = max(0.05, time_factor)
    noise = random.uniform(0.97, 1.03)
    calculated_value = (base_load + (peak_capacity * time_factor)) * noise
    return round(calculated_value, 2)


def emulate_sensor():
    # mock buidlings with their sensors and meters
    require_influx_config()

    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    write_api = client.write_api(write_options=SYNCHRONOUS)
    building_profiles = [
        "f3df9051-99b4-468f-8253-c5a821fe59e7",
        "50a61dd2-66cc-4eea-a236-df2ad5307c43",
        "6ea1d4d8-ca58-4aca-9820-54e19e005995",
        "ccf876ce-a06d-4c09-ae93-210b8e75f028",
        "06be3e23-2590-4939-808a-9a563064f51b",
        "50a635ea-847b-4121-8305-50fdbc9801b2",
        # Buildings assigned to the test account.
        "21895355-69be-4bed-add7-d10340b13cfa",  # Spar 2.0
        "23fe0a04-a7aa-4306-9e1f-d4301b1fc66c",  # Spar 2.0
        "b68ba0b8-8c46-48d8-9470-7a2297bfb468",  # SSpar 2.0
        "9e95afa2-797b-4ff8-a3b2-b4753692f96a",  # UP
    ]
    print("IoT Hardware Emulator Started.")
    while True:
        points_batch = []
        current_time = datetime.utcnow()
        
        for idx, building_id in enumerate(building_profiles):
            usage = calculate_usage(idx, current_time)
            
            # creating influx data point
            point = Point("energy_telemetry") \
                .tag("building_id", building_id) \
                .field("usage", usage) \
                .time(current_time, WritePrecision.NS)
                
            # adding to batch
            points_batch.append(point)
            
        try:
            write_api.write(bucket=INFLUXDB_BUCKET, record=points_batch)
            print(f"[{current_time.strftime('%H:%M:%S')}] Streamed batch successfully. Example Usage (Building 1): {points_batch[0]._fields['usage']} kW")
        except Exception as e:
            print(f"Write error encountered: {e}")
            
        time.sleep(2)  # waiting before next batch


if __name__ == "__main__":
    try:
        emulate_sensor()
    except KeyboardInterrupt:
        print("\nIoT Hardware Emulator stopped by user.")
