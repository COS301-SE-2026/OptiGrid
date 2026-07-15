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
    base_load = 24.0 + (building_index * 0.6)
    multiplier = 11.0 + (building_index * 0.3)
    # diurnal model
    hour = current_time.hour + (current_time.minute / 60.0) + (current_time.second / 3600.0)
    # sine wave offset to make sure that peak load is around 14:00
    time_factor = math.sin((hour - 6.0) * math.pi / 12.0)
    noise = random.uniform(-3.0, 3.0)
    calculated_value = (base_load + (multiplier * time_factor)) * noise
    calculated_value = max(8.0, calculated_value)
    
    # 2% chance of anomalies
    anomaly_chance = random.random()
    if anomaly_chance < 0.02:
        anomaly_type = random.choice(["spike", "dropout"])
        if anomaly_type == "spike":
            calculated_value *= random.uniform(3.5, 4.5)  # Spikes out of bounds
        elif anomaly_type == "dropout":
            calculated_value = random.uniform(0.0, 0.5)  # Dropouts fall to near-zero
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
        "50a635ea-847b-4121-8305-50fdbc9801b2"
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
            print(f"[{current_time.strftime('%H:%M:%S')}] Streamed batch successfully.")
        except Exception as e:
            print(f"Write error encountered: {e}")
            
        time.sleep(2)  # waiting before next batch


if __name__ == "__main__":
    try:
        emulate_sensor()
    except KeyboardInterrupt:
        print("\nIoT Hardware Emulator stopped by user.")
