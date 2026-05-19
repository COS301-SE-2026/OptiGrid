import pandas as pd
from influxdb_client import InfluxDBClient
from supabase import create_client, Client
from .config import *

class AnalyticsEngine:
    def __init__(self):
        self.influx = InfluxDBClient(url=INFLUX_URL, token="INFLUX_TOKEN", org=INFLUX_ORG)
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
    def fetch_telemetry(self, building_id: str) -> pd.DataFrame:
        #fetching raw data from influx
        query = f'''
        from(bucket: "{INFLUX_BUCKET}") 
            |> range(start: -30d) 
            |> filter(fn: (r) => r["building_id"] == "{building_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        df = self.influx.query_api().query_data_frame(query)
        if(df.empty):
            return pd.DataFrame()
        df = df.rename(columns={"_time":"timestamp"}) #just renaming column
        df['timestamp'] = pd.to_datetime(df['timestamp']) #converting to pandas datatime
        df['usage'] = pd.to_numeric(df['usage'], errors='coerce').fillna(0.0) #ensuring usage is numeric and invalid values are 0.0
        
        #resample hourly to ensure no stale data
        df = df.set_index('timestamp').resample('1H').sum().reset_index()
        return df
    
    def compute_todays_metrics(self, df: pd.DataFrame) -> dict:
        if df.empty: return {"todays_usage": 0.0, "todays_cost": 0.0}
        
        #filter for today's date
        today = datetime.now().date()
        today_df = df[df['timestamp'].dt.date == today]
        todays_usage = float(today_df['usage'].sum())
        todays_cost = todays_usage * UTILITY_RATE_KWH
        
        #metrics currently required
        total_kwh = float(df["usage"].sum())
        peak_kwh = float(df["usage"].max())
        
        return{
            "todays_usage": round(todays_usage, 2),
            "todays_cost": round(todays_cost, 2)
        }
    
    def process_building(self, building_id: str):
        df = self.fetch_telemetry(building_id)
        if df.empty: return
        
        #can just run more analytics and add it to db
        metrics = self.get_todays_metrics(df)
        self.supabase.table("building_analytics").upsert({
            "building_id": building_id, **metrics
            }).execute()
        