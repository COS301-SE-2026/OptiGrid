import pandas as pd
import numpy as np
import logging
import optuna
import mlflow
from datetime import datetime, timedelta, timezone
from influxdb_client import InfluxDBClient
from supabase import create_client, Client
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import cross_val_score
from sklearn.metrics import mean_absolute_percentage_error
from backend.analytics.src.config import *

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

#stops optuna's default printing spam stuff
optuna.logging.set_verbosity(optuna.logging.WARNING)

#mlops tracking initialisation
try:
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(MLFLOW_EXPERIMENT_NAME)
except Exception as e:
    logger.warning(f"Could not connect to MLflow server at initialisation: {e}")

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
        return df_ml.dropna() #get rid of first row which as a NaN lag value
    
    def train_and_forecast(self, df: pd.DataFrame, building_id: str) -> dict:
        #trains models and selects which is best via MAPE, then forecasts next 24 hours
        if len(df) < 24:
            return None
        
        #prepare features (X) and target (y)
        features = ['hour', 'day_of_week', 'lag_1']
        X = df[features]
        y = df['usage']
        
        #def objective function optuna
        def objective(trial):
            #optuna chooses which algorithm to test for this specific trail
            regressor_name = trial.suggest_categorical("regressor", ["RandomForest", "GradientBoosting"])
            
            #define hyperparams
            if regressor_name == "RandomForest":
                rf_n_estimators = trial.suggest_int("rf_n_estimators", 20, 100) #20 to 100 trees
                rf_max_depth = trial.suggest_int("rf_max_depth", 3, 15) # tree depth controls complexity
                model = RandomForestRegressor(n_estimators=rf_n_estimators, max_depth=rf_max_depth, random_state=42)
            else:
                gb_n_estimators = trial.suggest_int("gb_n_estimators", 20, 100) #no of boosting stages
                gb_max_depth = trial.suggest_int("gb_max_depth", 3, 10)
                gb_learning_rate = trial.suggest_float("gb_learning_rate", 1e-3, 0.3, log=True) #step size log scale
                model = GradientBoostingRegressor(n_estimators=gb_n_estimators, max_depth=gb_max_depth, learning_rate=gb_learning_rate, random_state=42)
            
            #evaluates trail model using 3 fold cross validation
            #negative mape since sklearn maximises scores
            cv_scores = cross_val_score(model, X, y, cv=3, scoring='neg_mean_absolute_percentage_error')
            #return positive mape (lower is better), optuna tries to minimise this
            return -cv_scores.mean()

        #run optuna study
        study = optuna.create_study(direction="minimize")
        study.optimize(objective, n_trials=15)
        
        #get best model from best trial
        best_params = study.best_params
        best_model_name = best_params["regressor"]
        best_mape = study.best_value
        
        #build best model with optimal hyperparamters
        if best_model_name == "RandomForest":
            best_model = RandomForestRegressor(
                n_estimators=best_params["rf_n_estimators"], 
                max_depth=best_params["rf_max_depth"],
                random_state=42)
        else:
            best_model = GradientBoostingRegressor(
                n_estimators=best_params["gb_n_estimators"], 
                max_depth=best_params["gb_max_depth"],
                learning_rate=best_params["gb_learning_rate"],
                random_state=42)
        
        #train all data on the best model
        best_model.fit(X, y)
        
        #autoregressive 24 hour forecast
        last_timestamp = df['timestamp'].iloc[-1] #timestamp of the last known data point
        current_lag = df['usage'].iloc[-1] #last known usage value
        
        forecast_series = [] #stores 24 hourly predictions
        
        #generate predictions for next 24 hours, 1 hour at a time
        for i in range(1, 25):
            next_time = last_timestamp + timedelta(hours=i)
            next_features = pd.DataFrame([{
                'hour': next_time.hour,
                'day_of_week': next_time.dayofweek,
                'lag_1': current_lag
            }])
            
            #append prediction to forecast series
            pred = best_model.predict(next_features)[0]
            forecast_series.append({
                "timestamp": next_time.isoformat(),
                "predicted_usage": round(pred, 2)
            })
            #update the lag to be the predication for the next run, 
            # auto-regressive = using predictions as inputs
            current_lag = pred
        
        forecast_peak = max(f["predicted_usage"] for f in forecast_series)
        forecast_avg_day = sum(f["predicted_usage"] for f in forecast_series) / 24.0
        
        #MLOps logging
        try:
            with mlflow.start_run(run_name=f"Bld_{building_id}_{datetime.now().strftime('%H%M%S')}"):
                mlflow.log_param("building_id", building_id)
                mlflow.log_param("champion_model", best_model_name)
                mlflow.log_params(best_params) # Logs the exact depths/rates chosen
                mlflow.log_metric("cv_mape", best_mape)
                mlflow.log_metric("forecast_peak", forecast_peak)
        except Exception as e:
            logger.warning(f"MLflow logging bypassed: {e}")

        return {
            "forecast_peak": round(forecast_peak, 2),
            "forecast_avg_day": round(forecast_avg_day, 2),
            "model_mape": round(best_mape, 4),
            "forecast_series": forecast_series
        }
        
        
        
    def process_all_buildings(self):
        #gets data for all buildings for the last 24 hours
        query = f'''
        from(bucket: "{INFLUX_BUCKET}") 
            |> range(start: -7d) 
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
                **metrics, #unpacks todays_usage and todays_cost
                **ml_metrics
            })
        
        #bulk upsert command
        if upsert_payloads:
            self.supabase.table("building_analytics").upsert(upsert_payloads).execute()
            logger.info(f"Successfully processed {len(upsert_payloads)} buildings in batch.")
        