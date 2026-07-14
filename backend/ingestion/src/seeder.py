import os
import sys
import json
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


# A stable test tariff so seeded costs can be compared consistently in the UI.
# It is intentionally configurable for local demos and is not a production tariff.
SEEDER_COST_ZAR_PER_KWH = float(os.getenv("SEEDER_COST_ZAR_PER_KWH", "2.50"))

DEFAULT_BUILDING_IDS = [
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


def seeded_cost_zar(usage_kwh: float) -> float:
    return round(usage_kwh * SEEDER_COST_ZAR_PER_KWH, 2)


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
                .field("cost_zar", seeded_cost_zar(raw_usage)) \
                .time(current_time, WritePrecision.NS)
            
            points_buffer.append(point)
        # hourly increments
        current_time += timedelta(hours=1)
        
        # flushing the points buffer to influx when it gets too large
        if len(points_buffer) >= 1000:
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


def backfill_seeded_costs(building_ids: list, days_back: int = 14):
    """Add cost_zar to existing seeded usage points without duplicating usage."""
    require_influx_config()
    if not building_ids:
        print("No building ids provided for cost backfill.")
        return

    building_filter = " or ".join(
        f'r.building_id == {json.dumps(building_id)}' for building_id in building_ids
    )
    flux_query = f'''
from(bucket: {json.dumps(INFLUXDB_BUCKET)})
  |> range(start: -{days_back}d)
  |> filter(fn: (r) => r._measurement == "energy_telemetry")
  |> filter(fn: (r) => r._field == "usage")
  |> filter(fn: (r) => {building_filter})
  |> keep(columns: ["_time", "_value", "building_id"])
'''

    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    query_api = client.query_api()
    write_api = client.write_api()
    points_buffer = []
    total_points = 0

    try:
        for record in query_api.query_stream(flux_query):
            building_id = record.values.get("building_id")
            usage_kwh = float(record.get_value())
            if not building_id:
                continue

            points_buffer.append(
                Point("energy_telemetry")
                .tag("building_id", building_id)
                .field("cost_zar", seeded_cost_zar(usage_kwh))
                .time(record.get_time(), WritePrecision.NS)
            )

            if len(points_buffer) >= 1000:
                write_api.write(bucket=INFLUXDB_BUCKET, record=points_buffer)
                total_points += len(points_buffer)
                points_buffer = []

        if points_buffer:
            write_api.write(bucket=INFLUXDB_BUCKET, record=points_buffer)
            total_points += len(points_buffer)
    finally:
        write_api.close()
        client.close()

    print(
        f"Cost backfill finished. Added cost_zar to {total_points} usage readings "
        f"at R {SEEDER_COST_ZAR_PER_KWH:.2f}/kWh."
    )


if __name__ == "__main__":
    seed_calculated_buildings(building_ids=DEFAULT_BUILDING_IDS, days_back=14)
