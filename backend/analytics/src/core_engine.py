import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List

import mlflow
import numpy as np
import optuna
import pandas as pd
from influxdb_client import InfluxDBClient, Point, WritePrecision
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.model_selection import cross_val_score
from supabase import Client, create_client

from backend.analytics.src.config import (
    INFLUXDB_BUCKET,
    INFLUXDB_ORG,
    INFLUXDB_TOKEN,
    INFLUXDB_URL,
    MLFLOW_EXPERIMENT_NAME,
    MLFLOW_TRACKING_URI,
    SUPABASE_KEY,
    SUPABASE_URL,
    UTILITY_RATE_KWH,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# stops optuna's default printing spam stuff
optuna.logging.set_verbosity(optuna.logging.WARNING)

# mlops tracking initialisation
try:
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(MLFLOW_EXPERIMENT_NAME)
except Exception as e:
    logger.warning("Could not connect to MLflow server at initialisation: %s", e)


class AnalyticsEngine:
    def __init__(self):
        # initialising dbs
        self.influx = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
        self.supabase: Optional[Client] = None
        try:
            self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            logger.warning("Supabase client initialisation failed; analytics writes disabled: %s", e)

    def register_new_building(self, building_id: str) -> bool:
        """
        Instantiates atomic placeholder rows inside your building_analytics database.
        This provides instant baseline data for charts and prevents frontend component crashes.
        """
        clean_id = str(building_id).replace("\r", "").replace("\n", "")
        logger.info("Received analytics initialization signal for building identifier: %s", clean_id)
        try:
            if self.supabase is not None:
                initial_state = {
                    "building_id": clean_id,
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
                logger.info("Successfully generated analytical layout space for building: %s", clean_id)
                return True
            
            logger.warning("Supabase target manager client is offline. Registration bypassed.")
            return False
        except Exception:
            logger.exception("Error executing provisioning cycle logic for %s", clean_id)
            raise

    def get_active_building_ids(self) -> List[str]:
        # return empty list if SUpabase client no available
        if self.supabase is None:
            return []
        try:
            # query buildings table for active buildings only
            res = self.supabase.table("buildings").select("building_id").filter("lifecycle_state", "eq", "active").execute()
            if res.data:
                # extract building_id fromeach row, filter out rows missing the field
                return [row["building_id"] for row in res.data if "building_id" in row]
            return []
        except Exception:
            # log error
            logger.exception("Failed to fetch active building list from Supabase")
            return []

    def seed_missing_influx_telemetry(self, building_id: str, days_back: int = 14):
        clean_id = str(building_id).replace("\r", "").replace("\n", "")
        logger.info("Seeding baseline historical telemetry in InfluxDB for building: %s", clean_id)
        try:
            write_api = self.influx.write_api()
            end_time = datetime.now(timezone.utc)
            start_time = end_time - timedelta(days=days_back)
            
            import hashlib
            import random
            h = int(hashlib.sha256(clean_id.encode("utf-8")).hexdigest(), 16)
            base_kw = 12.0 + ((h % 5300) / 100.0)
            amplitude_kw = 6.0 + (((h >> 16) % 1800) / 100.0)
            phase_shift_hrs = (((h >> 32) % 400) / 100.0) - 2.0
            
            current_time = start_time
            points_buffer = []
            
            while current_time <= end_time:
                hour_fraction = current_time.hour + (current_time.minute / 60.0) + (current_time.second / 3600.0)
                adjusted_hour = hour_fraction + phase_shift_hrs
                time_factor = np.sin((adjusted_hour - 6.0) * np.pi / 12.0)
                
                evening_bump = np.exp(-0.5 * ((adjusted_hour - 18.0) / 2.0)**2) * 0.4
                weekday = current_time.weekday()
                weekend_factor = 0.6 if weekday >= 5 else 1.0
                
                month_fraction = current_time.month + (current_time.day / 30.0)
                seasonal_factor = 1.0 + 0.25 * np.cos(4.0 * np.pi * (month_fraction - 1.0) / 12.0)
                
                noise = random.gauss(0.0, max(0.8, amplitude_kw * 0.15))
                
                raw_usage = max(1.0, (base_kw + (amplitude_kw * (time_factor + evening_bump))) * weekend_factor * seasonal_factor + noise)
                cost_zar = round(raw_usage * UTILITY_RATE_KWH, 2)
                
                point = Point("energy_telemetry") \
                    .tag("building_id", clean_id) \
                    .field("usage", round(raw_usage, 2)) \
                    .field("usage_kwh", round(raw_usage, 2)) \
                    .field("cost_zar", cost_zar) \
                    .time(current_time, WritePrecision.NS)
                
                points_buffer.append(point)
                current_time += timedelta(minutes=15)
                
                if len(points_buffer) >= 1000:
                    write_api.write(bucket=INFLUXDB_BUCKET, record=points_buffer)
                    points_buffer = []
            
            if points_buffer:
                write_api.write(bucket=INFLUXDB_BUCKET, record=points_buffer)
            
            write_api.close()
            logger.info("Successfully seeded baseline telemetry for building %s", clean_id)
        except Exception:
            logger.exception("Failed to seed telemetry for building %s", clean_id)

    def refresh_todays_metrics(self, building_id: str) -> dict:
        clean_id = str(building_id).replace("\r", "").replace("\n", "")
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -7d) 
            |> filter(fn: (r) => r["building_id"] == "{clean_id}")
            |> filter(fn: (r) => r["_measurement"] == "energy_telemetry_downsampled")
            |> filter(fn: (r) => r["_field"] == "usage" or r["_field"] == "usage_kwh")
            |> aggregateWindow(every: 1d, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        # get influx data
        df = self.influx.query_api().query_data_frame(query)
        # make sure that usage column is correct and exists
        if df.empty:
            self.seed_missing_influx_telemetry(clean_id)
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

        hourly_df = df['usage'].resample('h').sum().fillna(0.0).reset_index()
        if hourly_df.empty:
            return {}

        latest_time = hourly_df['timestamp'].max()
        today_start = latest_time.replace(hour=0, minute=0, second=0, microsecond=0)
        today_df = hourly_df[hourly_df['timestamp'] >= today_start]
        todays_usage = float(today_df['usage'].sum())
        todays_cost = todays_usage * UTILITY_RATE_KWH

        current_time = datetime.now(timezone.utc).isoformat()
        
        update = {
            "building_id": clean_id,
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
            best_model = RandomForestRegressor(
                n_estimators=best_params["n_estimators"], 
                max_depth=best_params["max_depth"], 
                min_samples_leaf=1, 
                max_features=1.0, 
                random_state=42
            )
        else:
            best_model = GradientBoostingRegressor(
                n_estimators=best_params["n_estimators"], 
                max_depth=best_params["max_depth"], 
                learning_rate=best_params["learning_rate"], 
                min_samples_leaf=1, 
                max_features=1.0, 
                random_state=42
            )
        # training using better model
        best_model.fit(X, y)

        last_timestamp = df['timestamp'].iloc[-1]

        historical_max = df['usage'].max()
        historical_median = df['usage'].median()
        current_lag = df['usage'].iloc[-1]
        if current_lag > historical_max * 1.5:
            current_lag = historical_median
        
        recent_std = df['usage'].tail(24).std()
        if pd.isna(recent_std) or recent_std == 0:
            recent_std = df['usage'].mean() * 0.05
        
        # predicting each hour in the upcoming week
        forecast_series = []
        trend_drift = 0.0
        
        for i in range(1, 169):
            next_time = last_timestamp + timedelta(hours=i)
            next_features = pd.DataFrame([{'hour': next_time.hour, 'day_of_week': next_time.dayofweek, 'lag_1': current_lag}])
            pred = best_model.predict(next_features)[0]
            
            trend_drift += np.random.normal(0, recent_std * 0.05)  # NOSONAR
            noise = np.random.normal(0, recent_std * 0.15)  # NOSONAR
            pred_with_noise = max(0.1, pred + trend_drift + noise)
            
            forecast_series.append({"timestamp": next_time.isoformat(), "predicted_usage": round(pred_with_noise, 2)})
            
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
        
        # cyclical encoding for tree based model extrapolation
        df_ml['week_sin'] = np.sin(2 * np.pi * df_ml['week'] / 52.0)
        df_ml['week_cos'] = np.cos(2 * np.pi * df_ml['week'] / 52.0)
        df_ml['month_sin'] = np.sin(2 * np.pi * df_ml['month'] / 12.0)
        df_ml['month_cos'] = np.cos(2 * np.pi * df_ml['month'] / 12.0)
        
        df_ml['lag_1'] = df_ml['usage'].shift(1)
        df_ml = df_ml.dropna()

        features = ['week_sin', 'week_cos', 'month_sin', 'month_cos', 'lag_1']
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
            best_model = RandomForestRegressor(
                n_estimators=best_params["n_estimators"], 
                max_depth=best_params["max_depth"], 
                min_samples_leaf=1, 
                max_features=1.0, 
                random_state=42
            )
        else:
            best_model = GradientBoostingRegressor(
                n_estimators=best_params["n_estimators"], 
                max_depth=best_params["max_depth"], 
                learning_rate=best_params["learning_rate"], 
                min_samples_leaf=1, 
                max_features=1.0, 
                random_state=42
            )
            
        best_model.fit(X, y)

        last_timestamp = df['timestamp'].iloc[-1]
        
        # clamp current lag
        historical_max = df['usage'].max()
        historical_median = df['usage'].median()
        current_lag = df['usage'].iloc[-1]
        if current_lag > historical_max * 1.5:
            current_lag = historical_median
            
        recent_std = df['usage'].tail(4).std()
        if pd.isna(recent_std) or recent_std == 0:
            recent_std = df['usage'].mean() * 0.05
            
        trend_drift = 0.0
        
        forecast_series = []
        for i in range(1, 13):
            next_time = last_timestamp + timedelta(weeks=i)
            wk = next_time.isocalendar().week
            mo = next_time.month
            
            next_features = pd.DataFrame([{
                'week_sin': np.sin(2 * np.pi * wk / 52.0),
                'week_cos': np.cos(2 * np.pi * wk / 52.0),
                'month_sin': np.sin(2 * np.pi * mo / 12.0),
                'month_cos': np.cos(2 * np.pi * mo / 12.0),
                'lag_1': current_lag
            }])
            pred = best_model.predict(next_features)[0]
            
            # add some noise
            trend_drift += np.random.normal(0, recent_std * 0.1)  # NOSONAR
            noise = np.random.normal(0, recent_std * 0.2)  # NOSONAR
            pred_with_noise = max(0.1, pred + trend_drift + noise)
            
            forecast_series.append({"timestamp": next_time.isoformat(), "predicted_usage": round(pred_with_noise, 2)})
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
        clean_id = str(building_id).replace("\r", "").replace("\n", "")
        logger.info("Processing single building analytics pass for building_id: %s", clean_id)
        self.register_new_building(clean_id)
        
        # query influx 30 days
        query_weekly = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -30d) 
            |> filter(fn: (r) => r["_field"] == "usage" or r["_field"] == "usage_kwh")
            |> filter(fn: (r) => r["_measurement"] == "energy_telemetry_downsampled")
            |> filter(fn: (r) => r["building_id"] == "{clean_id}")
            |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        
        # query influx 180 days
        query_monthly = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -180d) 
            |> filter(fn: (r) => r["_field"] == "usage" or r["_field"] == "usage_kwh")
            |> filter(fn: (r) => r["_measurement"] == "energy_telemetry_downsampled")
            |> filter(fn: (r) => r["building_id"] == "{clean_id}")
            |> aggregateWindow(every: 1d, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''

        try:
            # execute weekly query and convert to data frame
            res_weekly = self.influx.query_api().query_data_frame(query_weekly)
            df_weekly = pd.concat(res_weekly) if isinstance(res_weekly, list) else res_weekly
            
            # execute monthly query and convert to data frame
            res_monthly = self.influx.query_api().query_data_frame(query_monthly)
            df_monthly = pd.concat(res_monthly) if isinstance(res_monthly, list) else res_monthly
        except Exception:
            logger.exception("Failed to query InfluxDB for building %s", clean_id)
            return

        # if no weekly data, seed synthetic data then re-query
        if df_weekly is None or df_weekly.empty:
            self.seed_missing_influx_telemetry(clean_id)
            try:
                # retry queries after seeding
                res_weekly = self.influx.query_api().query_data_frame(query_weekly)
                df_weekly = pd.concat(res_weekly) if isinstance(res_weekly, list) else res_weekly
                res_monthly = self.influx.query_api().query_data_frame(query_monthly)
                df_monthly = pd.concat(res_monthly) if isinstance(res_monthly, list) else res_monthly
            except Exception:
                logger.exception("Re-querying InfluxDB after seeding failed for %s", clean_id)
                return

        # process weekly analytics
        if df_weekly is not None and not df_weekly.empty:
            df_weekly = df_weekly.rename(columns={"_time": "timestamp"})
            if 'usage_kwh' in df_weekly.columns:
                if 'usage' in df_weekly.columns:
                    df_weekly['usage'] = df_weekly['usage'].fillna(df_weekly['usage_kwh'])
                    df_weekly = df_weekly.drop(columns=['usage_kwh'])
                else:
                    df_weekly = df_weekly.rename(columns={'usage_kwh': 'usage'})
            df_weekly['timestamp'] = pd.to_datetime(df_weekly['timestamp'])
            df_weekly['usage'] = pd.to_numeric(df_weekly['usage'], errors='coerce').fillna(0.0)
            self._process_weekly_batch(df_weekly)

        # process monthly analytics
        if df_monthly is not None and not df_monthly.empty:
            df_monthly = df_monthly.rename(columns={"_time": "timestamp"})
            if 'usage_kwh' in df_monthly.columns:
                if 'usage' in df_monthly.columns:
                    df_monthly['usage'] = df_monthly['usage'].fillna(df_monthly['usage_kwh'])
                    df_monthly = df_monthly.drop(columns=['usage_kwh'])
                else:
                    df_monthly = df_monthly.rename(columns={'usage_kwh': 'usage'})
            df_monthly['timestamp'] = pd.to_datetime(df_monthly['timestamp'])
            df_monthly['usage'] = pd.to_numeric(df_monthly['usage'], errors='coerce').fillna(0.0)
            self._process_monthly_batch(df_monthly)

    def _process_weekly_batch(self, df_weekly: pd.DataFrame):
        weekly_payloads = []
        # process each building
        for b_id, group in df_weekly.groupby('building_id'):
            # resample to hourly totals
            hourly_group = group.set_index('timestamp')[['usage']].resample('h').sum().fillna(0.0).reset_index()
            
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
                "building_id": b_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "todays_usage": round(today_usage, 2),
                "todays_cost": round(today_usage * UTILITY_RATE_KWH, 2),
                **ml_metrics
            })

        # upload weekly analytics to supabase
        if weekly_payloads and self.supabase:
            self.supabase.table("building_analytics_weekly").upsert(weekly_payloads).execute()

    def _process_monthly_batch(self, df_monthly: pd.DataFrame):
        monthly_payloads = []
        # process each building
        for b_id, group in df_monthly.groupby('building_id'):
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
                "building_id": b_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "todays_usage": round(this_week_usage, 2),
                "todays_cost": round(this_week_usage * UTILITY_RATE_KWH, 2),
                **ml_metrics
            })

        # upload monthly to supabase
        if monthly_payloads and self.supabase:
            self.supabase.table("building_analytics_monthly").upsert(monthly_payloads).execute()

    def _ensure_telemetry_seeded(
        self,
        active_ids: List[str],
        df_weekly: pd.DataFrame,
        query_weekly: str,
        query_monthly: str
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        existing_influx_ids = set()
        if df_weekly is not None and not df_weekly.empty and "building_id" in df_weekly.columns:
            existing_influx_ids.update(df_weekly["building_id"].unique())

        missing_ids = [b_id for b_id in active_ids if b_id not in existing_influx_ids]
        if not missing_ids:
            return df_weekly, pd.DataFrame()

        logger.info("Found %d ACTIVE buildings missing telemetry in InfluxDB. Auto-seeding...", len(missing_ids))
        for b_id in missing_ids:
            self.seed_missing_influx_telemetry(b_id)

        try:
            # retry queries after seeding
            res_w = self.influx.query_api().query_data_frame(query_weekly)
            df_w = pd.concat(res_w) if isinstance(res_w, list) else res_w
            res_m = self.influx.query_api().query_data_frame(query_monthly)
            df_m = pd.concat(res_m) if isinstance(res_m, list) else res_m
            return df_w, df_m
        except Exception:
            logger.exception("Re-querying InfluxDB after seeding failed")
            return df_weekly, pd.DataFrame()

    def _run_batch_analytics(self, df_weekly: pd.DataFrame, df_monthly: pd.DataFrame):
        if df_weekly is not None and not df_weekly.empty and "building_id" in df_weekly.columns:
            # cleaning up column names and data types
            df_weekly = df_weekly.rename(columns={"_time": "timestamp", "usage_kwh": "usage"})
            df_weekly['timestamp'] = pd.to_datetime(df_weekly['timestamp'])
            df_weekly['usage'] = pd.to_numeric(df_weekly['usage'], errors='coerce').fillna(0.0)
            self._process_weekly_batch(df_weekly)

        # process monthly data
        if df_monthly is not None and not df_monthly.empty and "building_id" in df_monthly.columns:
            df_monthly = df_monthly.rename(columns={"_time": "timestamp", "usage_kwh": "usage"})
            df_monthly['timestamp'] = pd.to_datetime(df_monthly['timestamp'])
            df_monthly['usage'] = pd.to_numeric(df_monthly['usage'], errors='coerce').fillna(0.0)
            self._process_monthly_batch(df_monthly)

    def process_all_buildings(self):
        active_ids = self.get_active_building_ids()
        logger.info("Found %d ACTIVE buildings from Supabase database.", len(active_ids))

        for b_id in active_ids:
            self.register_new_building(b_id)

        # query to fetch last 30 days usage for weekly analysis
        query_weekly = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -30d) 
            |> filter(fn: (r) => r["_field"] == "usage")
            |> filter(fn: (r) => r["_measurement"] == "energy_telemetry_downsampled")
            |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> group(columns: ["building_id"])
        '''
        
        # query to fetch last 180 days usage for monthly analysis
        query_monthly = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -180d) 
            |> filter(fn: (r) => r["_field"] == "usage")
            |> filter(fn: (r) => r["_measurement"] == "energy_telemetry_downsampled")
            |> aggregateWindow(every: 1d, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> group(columns: ["building_id"])
        '''

        try:
            # Execute weekly query and convert to data frame
            res_weekly = self.influx.query_api().query_data_frame(query_weekly)
            df_weekly = pd.concat(res_weekly) if isinstance(res_weekly, list) else res_weekly
            
            # Execute monthly query and convert to data frame
            res_monthly = self.influx.query_api().query_data_frame(query_monthly)
            df_monthly = pd.concat(res_monthly) if isinstance(res_monthly, list) else res_monthly
        except Exception:
            logger.exception("InfluxDB batch query failed")
            df_weekly = pd.DataFrame()
            df_monthly = pd.DataFrame()

        df_weekly, df_m_seeded = self._ensure_telemetry_seeded(active_ids, df_weekly, query_weekly, query_monthly)
        if not df_m_seeded.empty:
            df_monthly = df_m_seeded

        # filter out any stale InfluxDB buildings that are no longer active in Supabase
        if not df_weekly.empty and "building_id" in df_weekly.columns:
            df_weekly = df_weekly[df_weekly['building_id'].isin(active_ids)]
        if not df_monthly.empty and "building_id" in df_monthly.columns:
            df_monthly = df_monthly[df_monthly['building_id'].isin(active_ids)]

        self._run_batch_analytics(df_weekly, df_monthly)

    def process_building(self, building_id:str): 
        self.register_new_building(building_id)
        #fetches analytcis for last 30 days for weekly analysis(implemented optimisation for this query as well)
        weekly = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_field"] == "usage")
            |> filter(fn: (r) => r["_measurement"] == "energy_telemetry_downsampled")
            |> filter(fn: (r) => r["building_id"] == "{building_id}")
            |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> group(columns: ["building_id"])
        '''

        #query for the montly analysis
        monthly = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
            |> range(start: -180d)
            |> filter(fn: (r) => r["_field"] == "usage")
            |> filter(fn: (r) => r["_measurement"] == "energy_telemetry_downsampled")
            |> filter(fn: (r) => r["building_id"] == "{building_id}")
            |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> group(columns: ["building_id"])
        '''

        try:
            #get data frama for weekly n monthly
            res_weekly = self.influx.query_api().query_data_frame(weekly)
            df_weekly = pd.concat(res_weekly) if isinstance(res_weekly, list) else res_weekly
            res_monthly = self.influx.query_api().query_data_frame(monthly)
            df_monthly = pd.concat(res_monthly) if isinstance(res_monthly, list) else res_monthly
        except Exception as error:
            logger.exception("InfluxDB building query failed")
            df_weekly = pd.DataFrame()
            df_monthly = pd.DataFrame()

        df_weekly = self._ensure_telemetry_seeded([building_id], df_weekly, weekly, monthly)
        monthly_seeded = self._ensure_telemetry_seeded([building_id], df_weekly, weekly, monthly)
        if not monthly_seeded.empty: 
            df_monthly = monthly_seeded
        #process monthly and weekly data
        if df_weekly is not None and not df_weekly.empty and "building_id" in df_weekly.columns:
            df_weekly = df_weekly.rename(columns={"_time": "timestamp", "usage_kwh": "usage"})
            df_weekly['timestamp'] = pd.to_datetime(df_weekly['timestamp'])
            df_weekly['usage'] = pd.to_numeric(df_weekly['usage'], errors='coerce').fillna(0.0)
            self._process_weekly_batch(df_weekly)

        if df_monthly is not None and not df_monthly.empty and "building_id" in df_monthly.columns:
                    df_monthly = df_monthly.rename(columns={"_time": "timestamp", "usage_kwh": "usage"})
                    df_monthly['timestamp'] = pd.to_datetime(df_monthly['timestamp'])
                    df_monthly['usage'] = pd.to_numeric(df_monthly['usage'], errors='coerce').fillna(0.0)
                    self._process_monthly_batch(df_monthly)