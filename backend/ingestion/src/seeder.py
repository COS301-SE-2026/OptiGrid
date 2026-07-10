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


def seed_calculated_buildings(building_ids: list, days_back: int = 14):
    print("Starting seeder.")


if __name__ == "__main__":
    current_buildings = [
        
    ]
    seed_calculated_buildings(building_ids=current_buildings, days_back=14)
