import pandas as pd
import numpy as np
import logging
import optuna
import mlflow
from datetime import datetime, timedelta, timezone
from influxdb_client import InfluxDBClient, Point, WritePrecision
from supabase import create_client, Client
from typing import Optional, List
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import cross_val_score
from backend.analytics.src.config import *

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# stops optuna's default printing spam stuff
optuna.logging.set_verbosity(optuna.logging.WARNING)

# mlops tracking initialisation
try:
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(MLFLOW_EXPERIMENT_NAME)
except Exception as e:
    logger.warning(f"Could not connect to MLflow server at initialisation: {e}")


class AnalyticsEngine:
    def __init__(self):
        # initialising dbs
        self.influx = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
        self.supabase: Optional[Client] = None
        try:
            self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            logger.warning(f"Supabase client initialisation failed; analytics writes disabled: {e}")

    def register_new_building(self, building_id: str) -> bool:
        """
        Instantiates atomic placeholder rows inside your building_analytics database.
        This provides instant baseline data for charts and prevents frontend component crashes.
        """
        logger.info(f"Received analytics initialization signal for building identifier: {building_id}")
        try:
            if self.supabase is not None:
                initial_state = {
                    "building_id": building_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "todays_usage": 0.0,
                    "todays_cost": 0.0,
                    "forecast_peak": 0.0,
                    "forecast_avg_day": 0.0,
                    "model_mape": 0.0,
                    "forecast_series": [],
                    "min_historic": 0.0,
                    "max_historic": 0.0,
                    "min_forecast": 0.0,
                    "max_forecast": 0.0
                }
                self.supabase.table("building_analytics_weekly").upsert(initial_state).execute()
                self.supabase.table("building_analytics_monthly").upsert(initial_state).execute()
                logger.info(f"Successfully generated analytical layout space for building: {building_id}")
                return True
            else:
                logger.warning("Supabase target manager client is offline. Registration bypassed.")
                return False
        except Exception:
            logger.exception("Error executing provisioning cycle logic for %s", building_id)
            raise

    def get_active_building_ids(self) -> List[str]:
        # return empty list if SUpabase client no available
        if self.supabase is None:
            return []
        try:
            # query buildings table for active buildings only
            res = self.supabase.table("buildings").select("building_id").filter("lifecycle_state", "eq", "ACTIVE").execute()
            if res.data:
                # extract building_id fromeach row, filter out rows missing the field
                return [row["building_id"] for row in res.data if "building_id" in row]
            return []
        except Exception as e:
            # log error
            logger.exception("Failed to fetch active building list from Supabase")
            return []

    def seed_missing_influx_telemetry(self, building_id: str, days_back: int = 14):
        logger.info(f"Seeding baseline historical telemetry in InfluxDB for building: {building_id}")
        try:
            # initialise influx writer
            write_api = self.influx.write_api()
            end_time = datetime.now(timezone.utc)
            start_time = end_time - timedelta(days=days_back)
            
            current_time = start_time
            points_buffer = []  # batch buffer
            
            rng = np.random.default_rng()
            # generate one data point per hour for the specific duration
            while current_time <= end_time:
                hour = current_time.hour
                # create daily usage pattern: higher during day, lower at night
                time_factor = np.sin((hour - 6) * np.pi / 12)
                base_load = 25.0
                multiplier = 12.0
                noise = rng.uniform(-3.0, 3.0)
                
                raw_usage = max(1.5, base_load + (multiplier * time_factor) + noise)
                cost_zar = round(raw_usage * UTILITY_RATE_KWH, 2)
                
                # creating influx data point
                point = Point("energy_telemetry") \
                    .tag("building_id", building_id) \
                    .field("usage", round(raw_usage, 2)) \
                    .field("cost_zar", cost_zar) \
                    .time(current_time, WritePrecision.NS)
                
                points_buffer.append(point)
                current_time += timedelta(hours=1)  # move to next hour
                
                # write in batches of 1000 points to avoid memory issues
                if len(points_buffer) >= 1000:
                    write_api.write(bucket=INFLUXDB_BUCKET, record=points_buffer)
                    points_buffer = []  # clean point buffer
            
            # write remaining points
            if points_buffer:
                write_api.write(bucket=INFLUXDB_BUCKET, record=points_buffer)
            
            write_api.close()
            logger.info("Successfully seeded baseline telemetry for building ", building_id)
        except Exception as e:
            logger.exception("Failed to seed telemetry for building %s", building_id)

    def refresh_todays_metrics(self, building_id: str) -> dict:
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -7d) 
            |> filter(fn: (r) => r["building_id"] == "{building_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        # get influx data
        df = self.influx.query_api().query_data_frame(query)
        # make sure that usage column is correct and exists
        if df.empty:
            self.seed_missing_influx_telemetry(building_id)
            df = self.influx.query_api().query_data_frame(query)
            if df.empty:
                return {}

        if "usage" not in df.columns and "usage_kwh" in df.columns:
            df = df.rename(columns={"usage_kwh": "usage"})
        if "usage" not in df.columns:
            return {}

        # getting the timestamp of the entries and making sure the field name is consistant
        df = df.rename(columns={"_time": "timestamp"})
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df['usage'] = pd.to_numeric(df['usage'], errors='coerce').fillna(0.0)
        df = df.set_index('timestamp')

        hourly_df = df['usage'].resample('h').mean().ffill().fillna(0.0).reset_index()
        if hourly_df.empty:
            return {}

        latest_time = hourly_df['timestamp'].max()
        today_start = latest_time.replace(hour=0, minute=0, second=0, microsecond=0)
        today_df = hourly_df[hourly_df['timestamp'] >= today_start]
        todays_usage = float(today_df['usage'].sum())
        todays_cost = todays_usage * UTILITY_RATE_KWH

        current_time = datetime.now(timezone.utc).isoformat()
        
        update = {
            "building_id": building_id,
            "todays_usage": round(todays_usage, 2),
            "todays_cost": round(todays_cost, 2),
            "updated_at": current_time
        }

        if self.supabase:
            self.supabase.table("building_analytics_weekly").upsert(update).execute()
            self.supabase.table("building_analytics_monthly").upsert(update).execute()

        return {"update": update}
    
    def train_and_forecast_weekly(self, df: pd.DataFrame) -> dict:
        # trains models and selects which is best via MAPE, then forecasts next 24 hours
        if len(df) < 24:
            return {}

        df_ml = df.copy()
        df_ml['hour'] = df_ml['timestamp'].dt.hour
        df_ml['day_of_week'] = df_ml['timestamp'].dt.dayofweek
        df_ml['lag_1'] = df_ml['usage'].shift(1)
        df_ml = df_ml.dropna()

        # prepare features (X) and target (y)
        features = ['hour', 'day_of_week', 'lag_1']
        X = df_ml[features]
        y = df_ml['usage']

        # the objective function used by optuna to determine the better model
        def objective(trial):
            regressor_name = trial.suggest_categorical("regressor", ["RandomForest", "GradientBoosting"])
            # def hyper params
            if regressor_name == "RandomForest":
                n_estimators = trial.suggest_int("n_estimators", 20, 100)
                max_depth = trial.suggest_int("max_depth", 3, 15)
                model = RandomForestRegressor(n_estimators=n_estimators, max_depth=max_depth, min_samples_leaf=1, max_features=1.0, random_state=42)
            else:
                n_estimators = trial.suggest_int("n_estimators", 20, 100)
                max_depth = trial.suggest_int("max_depth", 3, 10)
                learning_rate = trial.suggest_float("learning_rate", 1e-3, 0.3, log=True)
                model = GradientBoostingRegressor(n_estimators=n_estimators, max_depth=max_depth, learning_rate=learning_rate, min_samples_leaf=1, max_features=1.0, random_state=42)
            
            scores = cross_val_score(model, X, y, cv=3, scoring='neg_mean_absolute_percentage_error')
            return -scores.mean()

        study = optuna.create_study(direction="minimize")
        study.optimize(objective, n_trials=10)
        
        best_params = study.best_params
        if best_params["regressor"] == "RandomForest":
            best_model = RandomForestRegressor(n_estimators=best_params["n_estimators"], max_depth=best_params["max_depth"], random_state=42)
        else:
            best_model = GradientBoostingRegressor(n_estimators=best_params["n_estimators"], max_depth=best_params["max_depth"], learning_rate=best_params["learning_rate"], random_state=42)
        # training using better model
        best_model.fit(X, y)

        last_timestamp = df['timestamp'].iloc[-1]
        current_lag = df['usage'].iloc[-1]
        
        # predicting each hour in the upcoming week
        forecast_series = []
        for i in range(1, 169):
            next_time = last_timestamp + timedelta(hours=i)
            next_features = pd.DataFrame([{'hour': next_time.hour, 'day_of_week': next_time.dayofweek, 'lag_1': current_lag}])
            pred = best_model.predict(next_features)[0]
            forecast_series.append({"timestamp": next_time.isoformat(), "predicted_usage": round(pred, 2)})
            current_lag = pred

        daily_sums = [sum(f["predicted_usage"] for f in forecast_series[i:i+24]) for i in range(0, 168, 24)]
        
        return {
            "forecast_peak": round(max(f["predicted_usage"] for f in forecast_series), 2),
            "forecast_avg_day": round(sum(daily_sums) / 7.0, 2),
            "model_mape": round(study.best_value, 4),
            "forecast_series": forecast_series,
            "min_historic": round(df['usage'].min(), 2),
            "max_historic": round(df['usage'].max(), 2),
            "min_forecast": round(min(f["predicted_usage"] for f in forecast_series), 2),
            "max_forecast": round(max(f["predicted_usage"] for f in forecast_series), 2)
        }
        
    # same overall logic as the weekly prediction but rather for 3 months in increments of weeks
    def train_and_forecast_monthly(self, df: pd.DataFrame) -> dict:
        # trains models and selects which is best via MAPE, then forecasts next 4 weeks
        if len(df) < 4:
            return {}

        df_ml = df.copy()
        df_ml['week'] = df_ml['timestamp'].dt.isocalendar().week.astype(int)
        df_ml['month'] = df_ml['timestamp'].dt.month
        df_ml['lag_1'] = df_ml['usage'].shift(1)
        df_ml = df_ml.dropna()

        features = ['week', 'month', 'lag_1']
        X = df_ml[features]
        y = df_ml['usage']

        def objective(trial):
            regressor_name = trial.suggest_categorical("regressor", ["RandomForest", "GradientBoosting"])
            if regressor_name == "RandomForest":
                n_estimators = trial.suggest_int("n_estimators", 20, 100)
                max_depth = trial.suggest_int("max_depth", 3, 10)
                model = RandomForestRegressor(n_estimators=n_estimators, max_depth=max_depth, min_samples_leaf=1, max_features=1.0, random_state=42)
            else:
                n_estimators = trial.suggest_int("n_estimators", 20, 100)
                max_depth = trial.suggest_int("max_depth", 3, 10)
                learning_rate = trial.suggest_float("learning_rate", 1e-3, 0.3, log=True)
                model = GradientBoostingRegressor(n_estimators=n_estimators, max_depth=max_depth, learning_rate=learning_rate, min_samples_leaf=1, max_features=1.0, random_state=42)
            
            scores = cross_val_score(model, X, y, cv=2, scoring='neg_mean_absolute_percentage_error')
            return -scores.mean()

        study = optuna.create_study(direction="minimize")
        study.optimize(objective, n_trials=10)
        
        # Build and train best model
        best_params = study.best_params
        if best_params["regressor"] == "RandomForest":
            best_model = RandomForestRegressor(n_estimators=best_params["n_estimators"], max_depth=best_params["max_depth"], random_state=42)
        else:
            best_model = GradientBoostingRegressor(n_estimators=best_params["n_estimators"], max_depth=best_params["max_depth"], learning_rate=best_params["learning_rate"], random_state=42)
            
        best_model.fit(X, y)

        last_timestamp = df['timestamp'].iloc[-1]
        current_lag = df['usage'].iloc[-1]
        
        forecast_series = []
        for i in range(1, 13):
            next_time = last_timestamp + timedelta(weeks=i)
            next_features = pd.DataFrame([{'week': next_time.isocalendar().week, 'month': next_time.month, 'lag_1': current_lag}])
            pred = best_model.predict(next_features)[0]
            forecast_series.append({"timestamp": next_time.isoformat(), "predicted_usage": round(pred, 2)})
            current_lag = pred

        return {
            "forecast_peak": round(max(f["predicted_usage"] for f in forecast_series), 2),
            "forecast_avg_day": round(sum(f["predicted_usage"] for f in forecast_series) / 12.0, 2),
            "model_mape": round(study.best_value, 4),
            "forecast_series": forecast_series,
            "min_historic": round(df['usage'].min(), 2),
            "max_historic": round(df['usage'].max(), 2),
            "min_forecast": round(min(f["predicted_usage"] for f in forecast_series), 2),
            "max_forecast": round(max(f["predicted_usage"] for f in forecast_series), 2)
        }

    def process_single_building(self, building_id: str):
        logger.info(f"Processing single building analytics pass for building_id: {building_id}")
        self.register_new_building(building_id)
        
        # query influx 30 days
        query_weekly = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -30d) 
            |> filter(fn: (r) => r["_field"] == "usage" or r["_field"] == "usage_kwh")
            |> filter(fn: (r) => r["building_id"] == "{building_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        
        # query influx 180 days
        query_monthly = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -180d) 
            |> filter(fn: (r) => r["_field"] == "usage" or r["_field"] == "usage_kwh")
            |> filter(fn: (r) => r["building_id"] == "{building_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''

        try:
            # execute weekly query and convert to data frame
            res_weekly = self.influx.query_api().query_data_frame(query_weekly)
            df_weekly = pd.concat(res_weekly) if isinstance(res_weekly, list) else res_weekly
            
            # execute monthly query and convert to data frame
            res_monthly = self.influx.query_api().query_data_frame(query_monthly)
            df_monthly = pd.concat(res_monthly) if isinstance(res_monthly, list) else res_monthly
        except Exception as e:
            logger.exception("Failed to query InfluxDB for building %s", building_id)
            return

        # if no weekly data, seed synthetic data then re-query
        if df_weekly is None or df_weekly.empty:
            self.seed_missing_influx_telemetry(building_id)
            try:
                # retry queries after seeding
                res_weekly = self.influx.query_api().query_data_frame(query_weekly)
                df_weekly = pd.concat(res_weekly) if isinstance(res_weekly, list) else res_weekly
                res_monthly = self.influx.query_api().query_data_frame(query_monthly)
                df_monthly = pd.concat(res_monthly) if isinstance(res_monthly, list) else res_monthly
            except Exception as e:
                logger.exception("Re-querying InfluxDB after seeding failed: %s", e)
                return

        # process weekly analytics
        if df_weekly is not None and not df_weekly.empty:
            df_weekly = df_weekly.rename(columns={"_time": "timestamp", "usage_kwh": "usage"})
            df_weekly['timestamp'] = pd.to_datetime(df_weekly['timestamp'])
            df_weekly['usage'] = pd.to_numeric(df_weekly['usage'], errors='coerce').fillna(0.0)
            
            hourly_group = df_weekly.set_index('timestamp')[['usage']].resample('h').mean().ffill().fillna(0.0).reset_index()
            latest_time = hourly_group['timestamp'].max()
            today_start = latest_time.replace(hour=0, minute=0, second=0, microsecond=0)
            today_usage = float(hourly_group[hourly_group['timestamp'] >= today_start]['usage'].sum())
            
            ml_metrics = self.train_and_forecast_weekly(hourly_group)
            if ml_metrics and self.supabase:
                self.supabase.table("building_analytics_weekly").upsert({
                    "building_id": building_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "todays_usage": round(today_usage, 2),
                    "todays_cost": round(today_usage * UTILITY_RATE_KWH, 2),
                    **ml_metrics
                }).execute()

        # process monthly analytics
        if df_monthly is not None and not df_monthly.empty:
            df_monthly = df_monthly.rename(columns={"_time": "timestamp", "usage_kwh": "usage"})
            df_monthly['timestamp'] = pd.to_datetime(df_monthly['timestamp'])
            df_monthly['usage'] = pd.to_numeric(df_monthly['usage'], errors='coerce').fillna(0.0)
            
            weekly_group = df_monthly.set_index('timestamp')[['usage']].resample('W').sum().ffill().fillna(0.0).reset_index()
            latest_time = weekly_group['timestamp'].max()
            week_start = latest_time - timedelta(days=latest_time.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            this_week_usage = float(weekly_group[weekly_group['timestamp'] >= week_start]['usage'].sum())

            ml_metrics = self.train_and_forecast_monthly(weekly_group)
            if ml_metrics and self.supabase:
                self.supabase.table("building_analytics_monthly").upsert({
                    "building_id": building_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "todays_usage": round(this_week_usage, 2),
                    "todays_cost": round(this_week_usage * UTILITY_RATE_KWH, 2),
                    **ml_metrics
                }).execute()

    def process_all_buildings(self):
        active_ids = self.get_active_building_ids()
        logger.info(f"Found {len(active_ids)} ACTIVE buildings from Supabase database.")

        for b_id in active_ids:
            self.register_new_building(b_id)

        # query to fetch last 30 days usage for weekly analysis
        query_weekly = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -30d) 
            |> filter(fn: (r) => r["_field"] == "usage" or r["_field"] == "usage_kwh")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> group()
        '''
        
        # query to fetch last 180 days usage for monthly analysis
        query_monthly = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -180d) 
            |> filter(fn: (r) => r["_field"] == "usage" or r["_field"] == "usage_kwh")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> group()
        '''

        try:
            # Execute weekly query and convert to data frame
            res_weekly = self.influx.query_api().query_data_frame(query_weekly)
            df_weekly = pd.concat(res_weekly) if isinstance(res_weekly, list) else res_weekly
            
            # Execute monthly query and convert to data frame
            res_monthly = self.influx.query_api().query_data_frame(query_monthly)
            df_monthly = pd.concat(res_monthly) if isinstance(res_monthly, list) else res_monthly
        except Exception as e:
            logger.exception(f"InfluxDB batch query failed: ", e)
            df_weekly = pd.DataFrame()
            df_monthly = pd.DataFrame()

        existing_influx_ids = set()
        if df_weekly is not None and not df_weekly.empty and "building_id" in df_weekly.columns:
            existing_influx_ids.update(df_weekly["building_id"].unique())

        missing_ids = [b_id for b_id in active_ids if b_id not in existing_influx_ids]
        if missing_ids:
            logger.info(f"Found {len(missing_ids)} ACTIVE buildings missing telemetry in InfluxDB. Auto-seeding...")
            for b_id in missing_ids:
                self.seed_missing_influx_telemetry(b_id)
            
            try:
                res_weekly = self.influx.query_api().query_data_frame(query_weekly)
                df_weekly = pd.concat(res_weekly) if isinstance(res_weekly, list) else res_weekly
                res_monthly = self.influx.query_api().query_data_frame(query_monthly)
                df_monthly = pd.concat(res_monthly) if isinstance(res_monthly, list) else res_monthly
            except Exception as e:
                logger.exception(f"Re-querying InfluxDB after seeding failed: ", e)

        if df_weekly is not None and not df_weekly.empty and "building_id" in df_weekly.columns:
            # cleaning up column names and data types
            df_weekly = df_weekly.rename(columns={"_time": "timestamp", "usage_kwh": "usage"})
            df_weekly['timestamp'] = pd.to_datetime(df_weekly['timestamp'])
            df_weekly['usage'] = pd.to_numeric(df_weekly['usage'], errors='coerce').fillna(0.0)

            weekly_payloads = []
            # process each building
            for building_id, group in df_weekly.groupby('building_id'):
                # resample to hourly averags
                hourly_group = group.set_index('timestamp')[['usage']].resample('h').mean().ffill().fillna(0.0).reset_index()
                
                # calculating today's usage from midnight to lastest timestamp
                latest_time = hourly_group['timestamp'].max()
                today_start = latest_time.replace(hour=0, minute=0, second=0, microsecond=0)
                today_usage = float(hourly_group[hourly_group['timestamp'] >= today_start]['usage'].sum())
                
                # train ml model and generate forecasts
                ml_metrics = self.train_and_forecast_weekly(hourly_group)
                if not ml_metrics:
                    continue  # skip if model training fails

                # preparing weekly analytics record
                weekly_payloads.append({
                    "building_id": building_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "todays_usage": round(today_usage, 2),
                    "todays_cost": round(today_usage * UTILITY_RATE_KWH, 2),
                    **ml_metrics
                })

            # upload weekly analytics to supabase
            if weekly_payloads and self.supabase:
                self.supabase.table("building_analytics_weekly").upsert(weekly_payloads).execute()

        # process monthly data
        if df_monthly is not None and not df_monthly.empty and "building_id" in df_monthly.columns:
            df_monthly = df_monthly.rename(columns={"_time": "timestamp", "usage_kwh": "usage"})
            df_monthly['timestamp'] = pd.to_datetime(df_monthly['timestamp'])
            df_monthly['usage'] = pd.to_numeric(df_monthly['usage'], errors='coerce').fillna(0.0)

            monthly_payloads = []
            # process each building
            for building_id, group in df_monthly.groupby('building_id'):
                # resample to weekly totals
                weekly_group = group.set_index('timestamp')[['usage']].resample('W').sum().ffill().fillna(0.0).reset_index()
                # calculate this weeks usage
                latest_time = weekly_group['timestamp'].max()
                week_start = latest_time - timedelta(days=latest_time.weekday())
                week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
                this_week_usage = float(weekly_group[weekly_group['timestamp'] >= week_start]['usage'].sum())

                # train ML model
                ml_metrics = self.train_and_forecast_monthly(weekly_group)
                if not ml_metrics:
                    continue  # skip if model fails

                # prepare monthly analytics record
                monthly_payloads.append({
                    "building_id": building_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "todays_usage": round(this_week_usage, 2),
                    "todays_cost": round(this_week_usage * UTILITY_RATE_KWH, 2),
                    **ml_metrics
                })

            #upload monthly to supabase
            if monthly_payloads and self.supabase:
                self.supabase.table("building_analytics_monthly").upsert(monthly_payloads).execute()