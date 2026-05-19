import pandas as pd
import numpy as np
import mlflow
import logging
from datetime import datetime, timedelta
from influxdb_client import InfluxDBClient
from supabase import create_client, Client
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import cross_val_score
from sklearn.metrics import mean_absolute_percentage_error
from config import *

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

#mlops tracking initialisation
# mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
# mlflow.set_experiment(MLFLOW_EXPERIMENT_NAME)
class AnalyticsEngine:
    def __init__(self):
        #initialising dbs
        self.influx = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
    def fetch_telemetry(self, building_id: str) -> pd.DataFrame:
        #fetching raw data from influx for the last 30 days
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
        df = df.set_index('timestamp')
        hourly_df = df['usage'].resample('h').mean().ffill().fillna(0.0).reset_index()
        return hourly_df
    
    def compute_todays_metrics(self, df: pd.DataFrame) -> dict:
        if df.empty: return {"todays_usage": 0.0, "todays_cost": 0.0}
        
        #filter for today's date
        df['date_only'] = df['timestamp'].dt.date
        
        # Pull the latest available day from the data instead of strict system clock
        latest_day = df['date_only'].max() 
        
        today_df = df[df['date_only'] == latest_day]
        todays_usage = float(today_df['usage'].sum())
        todays_cost = todays_usage * UTILITY_RATE_KWH
        
        return {
            "todays_usage": round(todays_usage, 2),
            "todays_cost": round(todays_cost, 2)
        }
    
    def process_all_buildings(self):
        #gets data for all buildings for the last 24 hours
        query = f'''
        from(bucket: "{INFLUX_BUCKET}") 
            |> range(start: -24h) 
            |> filter(fn: (r) => r["_field"] == "usage")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> group()
        '''
        result = self.influx.query_api().query_data_frame(query)
        
        # handling the list vs dataframe result
        if isinstance(result, list):
            if not result:
                logger.warning("No data returned from InfluxDB.")
                return
            #concat multiple dataframes from list into single dataframe
            df = pd.concat(result)
        else:
            df = result

        if df.empty:
            logger.warning("Dataframe is empty.")
            return

        #fixing column naming
        df = df.rename(columns={"_time": "timestamp"})
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df['usage'] = pd.to_numeric(df['usage'], errors='coerce').fillna(0.0)

        #process each building data individually
        upsert_payloads = []
        for building_id, group in df.groupby('building_id'):
            #resample individual building streams
            grouped_hourly = group.set_index('timestamp')[['usage']].resample('h').mean().ffill().fillna(0.0).reset_index()
            
            #calculate metrics
            metrics = self.compute_todays_metrics(grouped_hourly)
            upsert_payloads.append({
                "building_id": building_id,
                **metrics #unpacks todays_usage and todays_cost
            })
        
        #bulk upsert command
        if upsert_payloads:
            self.supabase.table("building_analytics").upsert(upsert_payloads).execute()
            logger.info(f"Successfully processed {len(upsert_payloads)} buildings in batch.")
        