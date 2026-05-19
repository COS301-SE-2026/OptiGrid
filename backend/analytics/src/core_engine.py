import pandas as pd
from influxdb_client import InfluxDBClient
from supabase import create_client, Client

class AnalyticsEngine:
    def __init__(self):
        self.influx = InfluxDBClient()
