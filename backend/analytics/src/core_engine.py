import pandas as pd
import numpy as np
import logging
import optuna
import mlflow
from datetime import datetime, timedelta, timezone
from influxdb_client import InfluxDBClient
from supabase import create_client, Client
from typing import Optional
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
        except Exception as e:
            logger.error(f"Error executing provisioning cycle logic for {building_id}: {str(e)}")
            raise e
    
    def refresh_todays_metrics(self, building_id: str) -> dict:
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -7d) 
            |> filter(fn: (r) => r["building_id"] == "{building_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        # get influx data
        df = self.influx.query_api().query_data_frame(query)
        if df.empty:
            return {}
        # make sure that usage column is correct and exists
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

    def fetch_telemetry(self, building_id: str) -> pd.DataFrame:
        # fetching raw data from influx for the last 30 days
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -30d) 
            |> filter(fn: (r) => r["building_id"] == "{building_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        df = self.influx.query_api().query_data_frame(query)
        if(df.empty):
            return pd.DataFrame()

        if "usage" not in df.columns and "usage_kwh" in df.columns:
            df = df.rename(columns={"usage_kwh": "usage"})
        if "usage" not in df.columns:
            logger.warning("Telemetry query returned no usage field.")
            return pd.DataFrame()
        
        df = df.rename(columns={"_time":"timestamp"})  # just renaming column
        df['timestamp'] = pd.to_datetime(df['timestamp'])  # converting to pandas datatime
        df['usage'] = pd.to_numeric(df['usage'], errors='coerce').fillna(0.0)  # ensuring usage is numeric and invalid values are 0.0
        
        # resample hourly to ensure no stale data
        df = df.set_index('timestamp')
        hourly_df = df['usage'].resample('h').mean().ffill().fillna(0.0).reset_index()
        return hourly_df
    
    def compute_todays_metrics(self, df: pd.DataFrame) -> dict:
        if df.empty: 
            return {"todays_usage": 0.0, "todays_cost": 0.0}
        
        # filter for today's date
        df = df.copy()
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
        
    def create_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df_ml = df.copy()
        df_ml['hour'] = df_ml['timestamp'].dt.hour
        df_ml['day_of_week'] = df_ml['timestamp'].dt.dayofweek
        df_ml['lag_1'] = df_ml['usage'].shift(1)
        return df_ml.dropna()  # get rid of first row which as a NaN lag value
    
    def train_and_forecast_weekly(self, df: pd.DataFrame, building_id: str) -> dict:
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
                model = RandomForestRegressor(n_estimators=n_estimators, max_depth=max_depth, random_state=42)
            else:
                n_estimators = trial.suggest_int("n_estimators", 20, 100)
                max_depth = trial.suggest_int("max_depth", 3, 10)
                learning_rate = trial.suggest_float("learning_rate", 1e-3, 0.3, log=True)
                model = GradientBoostingRegressor(n_estimators=n_estimators, max_depth=max_depth, learning_rate=learning_rate, random_state=42)
            
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
    def train_and_forecast_monthly(self, df: pd.DataFrame, building_id: str) -> dict:
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
                model = RandomForestRegressor(n_estimators=n_estimators, max_depth=max_depth, random_state=42)
            else:
                n_estimators = trial.suggest_int("n_estimators", 20, 100)
                max_depth = trial.suggest_int("max_depth", 3, 10)
                learning_rate = trial.suggest_float("learning_rate", 1e-3, 0.3, log=True)
                model = GradientBoostingRegressor(n_estimators=n_estimators, max_depth=max_depth, learning_rate=learning_rate, random_state=42)
            
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
    
    # def train_and_forecast(self, df: pd.DataFrame, building_id: str) -> dict:
    #     # trains models and selects which is best via MAPE, then forecasts next 24 hours
    #     if len(df) < 24:
    #         return None
        
    #     # prepare features (X) and target (y)
    #     features = ['hour', 'day_of_week', 'lag_1']
    #     X = df[features]
    #     y = df['usage']
        
    #     # def objective function optuna
    #     def objective(trial):
    #         # optuna chooses which algorithm to test for this specific trail
    #         regressor_name = trial.suggest_categorical("regressor", ["RandomForest", "GradientBoosting"])
            
    #         # define hyperparams
    #         if regressor_name == "RandomForest":
    #             rf_n_estimators = trial.suggest_int("rf_n_estimators", 20, 100)  # 20 to 100 trees
    #             rf_max_depth = trial.suggest_int("rf_max_depth", 3, 15)  # tree depth controls complexity
    #             model = RandomForestRegressor(n_estimators=rf_n_estimators, max_depth=rf_max_depth, random_state=42)
    #         else:
    #             gb_n_estimators = trial.suggest_int("gb_n_estimators", 20, 100)  # no of boosting stages
    #             gb_max_depth = trial.suggest_int("gb_max_depth", 3, 10)
    #             gb_learning_rate = trial.suggest_float("gb_learning_rate", 1e-3, 0.3, log=True)  # step size log scale
    #             model = GradientBoostingRegressor(n_estimators=gb_n_estimators, max_depth=gb_max_depth, learning_rate=gb_learning_rate, random_state=42)
            
    #         # evaluates trail model using 3 fold cross validation
    #         # negative mape since sklearn maximises scores
    #         cv_scores = cross_val_score(model, X, y, cv=3, scoring='neg_mean_absolute_percentage_error')
    #         # return positive mape (lower is better), optuna tries to minimise this
    #         return -cv_scores.mean()

    #     # run optuna study
    #     study = optuna.create_study(direction="minimize")
    #     study.optimize(objective, n_trials=15)
        
    #     # get best model from best trial
    #     best_params = study.best_params
    #     best_model_name = best_params["regressor"]
    #     best_mape = study.best_value
        
    #     # build best model with optimal hyperparamters
    #     if best_model_name == "RandomForest":
    #         best_model = RandomForestRegressor(
    #             n_estimators=best_params["rf_n_estimators"], 
    #             max_depth=best_params["rf_max_depth"],
    #             random_state=42)
    #     else:
    #         best_model = GradientBoostingRegressor(
    #             n_estimators=best_params["gb_n_estimators"], 
    #             max_depth=best_params["gb_max_depth"],
    #             learning_rate=best_params["gb_learning_rate"],
    #             random_state=42)
        
    #     # train all data on the best model
    #     best_model.fit(X, y)
        
    #     # autoregressive 24 hour forecast
    #     last_timestamp = df['timestamp'].iloc[-1]  # timestamp of the last known data point
    #     current_lag = df['usage'].iloc[-1]  # last known usage value
        
    #     forecast_series = []  # stores 24 hourly predictions
        
    #     # generate predictions for next 24 hours, 1 hour at a time
    #     for i in range(1, 25):
    #         next_time = last_timestamp + timedelta(hours=i)
    #         next_features = pd.DataFrame([{
    #             'hour': next_time.hour,
    #             'day_of_week': next_time.dayofweek,
    #             'lag_1': current_lag
    #         }])
            
    #         # append prediction to forecast series
    #         pred = best_model.predict(next_features)[0]
    #         forecast_series.append({
    #             "timestamp": next_time.isoformat(),
    #             "predicted_usage": round(pred, 2)
    #         })
    #         # update the lag to be the predication for the next run, 
    #         # auto-regressive = using predictions as inputs
    #         current_lag = pred
        
    #     forecast_peak = max(f["predicted_usage"] for f in forecast_series)
    #     forecast_avg_day = sum(f["predicted_usage"] for f in forecast_series) / 24.0
        
    #     # MLOps logging
    #     try:
    #         with mlflow.start_run(run_name=f"Bld_{building_id}_{datetime.now().strftime('%H%M%S')}"):
    #             mlflow.log_param("building_id", building_id)
    #             mlflow.log_param("champion_model", best_model_name)
    #             mlflow.log_params(best_params)  # Logs the exact depths/rates chosen
    #             mlflow.log_metric("cv_mape", best_mape)
    #             mlflow.log_metric("forecast_peak", forecast_peak)
    #     except Exception as e:
    #         logger.warning(f"MLflow logging bypassed: {e}")

    #     return {
    #         "forecast_peak": round(forecast_peak, 2),
    #         "forecast_avg_day": round(forecast_avg_day, 2),
    #         "model_mape": round(best_mape, 4),
    #         "forecast_series": forecast_series
    #     }


    def process_all_buildings(self):
        # gets data for all buildings for the last 24 hours
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}") 
            |> range(start: -7d) 
            |> filter(fn: (r) => r["_field"] == "usage" or r["_field"] == "usage_kwh")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> group()
        '''
        result = self.influx.query_api().query_data_frame(query)
        
        # handling the list vs dataframe result
        if isinstance(result, list):
            if not result:
                logger.warning("No data returned from InfluxDB.")
                return
            # concat multiple dataframes from list into single dataframe
            df = pd.concat(result)
        else:
            df = result

        if df.empty:
            logger.warning("Dataframe is empty.")
            return

        # fixing column naming
        df = df.rename(columns={"_time": "timestamp"})
        if "usage" not in df.columns and "usage_kwh" in df.columns:
            df = df.rename(columns={"usage_kwh": "usage"})
        if "usage" not in df.columns:
            logger.warning("No usage/usage_kwh field found in analytics source data.")
            return
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df['usage'] = pd.to_numeric(df['usage'], errors='coerce').fillna(0.0)

        # process each building data individually
        upsert_payloads = []
        for building_id, group in df.groupby('building_id'):
            #resample individual building streams
            grouped_hourly = group.set_index('timestamp')[['usage']].resample('h').mean().ffill().fillna(0.0).reset_index()
            
            # calculate metrics
            metrics = self.compute_todays_metrics(grouped_hourly)
            df_features = self.create_features(grouped_hourly)
            ml_metrics = {
                "forecast_peak": 0.0,
                "forecast_avg_day": 0.0,
                "model_mape": 0.0,
                "forecast_series": []
            }
            
            if not df_features.empty:
                results = self.train_and_forecast(df_features, building_id)
                if results:
                    ml_metrics = results
            
            upsert_payloads.append({
                "building_id": building_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                **metrics,  # unpacks todays_usage and todays_cost
                **ml_metrics
            })
        
        # bulk upsert command
        if upsert_payloads and self.supabase is not None:
            self.supabase.table("building_analytics").upsert(upsert_payloads).execute()
            logger.info(f"Successfully processed {len(upsert_payloads)} buildings in batch.")
        elif upsert_payloads:
            logger.warning("Skipping analytics upsert because Supabase client is unavailable.")
        
