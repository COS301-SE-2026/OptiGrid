import pytest
import sys
from unittest.mock import MagicMock
sys.modules['mlflow'] = MagicMock()
import pandas as pd
import numpy as np
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from backend.analytics.src.core_engine import AnalyticsEngine
from backend.analytics.src.config import UTILITY_RATE_KWH

@pytest.fixture
def engine():
    with patch('backend.analytics.src.core_engine.InfluxDBClient'), \
        patch('backend.analytics.src.core_engine.create_client'):
        yield AnalyticsEngine()

#generates 7 days worth of hourly data per building 
@pytest.fixture
def sample_timeseries():
    now = datetime.now()
    dates = pd.date_range(end=now, periods=168, freq='h') #7 * 24
    df = pd.DataFrame({
        'timestamp': dates,
        'usage': np.random.uniform(50.0, 150.0, size=168),
        'building_id': 'bld_test_1'
    })
    return df

#negative test case to ensure dataframes return safe default zeros
def test_compute_todays_metrics_negative_empty(engine):
    empty_df = pd.DataFrame()
    metrics = engine.compute_todays_metrics(empty_df)
    
    assert metrics['todays_usage'] == 0.0
    assert metrics['todays_cost'] == 0.0
    
#positive test case, ensuring time features and lag shifts created properly
def test_create_features_positive(engine, sample_timeseries):
    """POSITIVE: Ensures time features and lag shifts are created properly."""
    df_features = engine.create_features(sample_timeseries)
    
    # lag shift means the first row is NaN, so length should be -1
    assert len(df_features) == len(sample_timeseries) - 1
    assert 'hour' in df_features.columns
    assert 'day_of_week' in df_features.columns
    assert 'lag_1' in df_features.columns
    
#postive test case mocks optuma to test ml loop execution and JSONB format
@patch('backend.analytics.src.core_engine.optuna.create_study')
def test_train_and_forecast_positive(mock_study, engine, sample_timeseries):
    mock_study_instance = MagicMock()
    mock_study_instance.best_params = {
        "regressor": "RandomForest",
        "rf_n_estimators": 20,
        "rf_max_depth": 3
    }
    mock_study_instance.best_value = 0.05  #mape
    mock_study.return_value = mock_study_instance
    
    df_features = engine.create_features(sample_timeseries)
    results = engine.train_and_forecast(df_features, 'bld_test_1')
    
    assert results is not None
    assert "forecast_peak" in results
    assert "forecast_avg_day" in results
    assert results["model_mape"] == 0.05
    assert len(results["forecast_series"]) == 24
    
    #check JSONB array structure
    first_forecast = results["forecast_series"][0]
    assert "timestamp" in first_forecast
    assert "predicted_usage" in first_forecast

#negative test case, engine aborts if no data < 24 hours exists
def test_train_and_forecast_negative_insufficient_data(engine):
    now = datetime.now()
    dates = pd.date_range(end=now, periods=10, freq='h')
    df_short = pd.DataFrame({
        'timestamp': dates,
        'usage': [100.0] * 10
    })
    df_features = engine.create_features(df_short)
    
    results = engine.train_and_forecast(df_features, 'bld_test_1')
    assert results is None

#positive test case, simulating successfull batch pull and db upsert
@patch.object(AnalyticsEngine, 'train_and_forecast')
@patch.object(AnalyticsEngine, 'compute_todays_metrics')
def test_process_all_buildings_positive(mock_metrics, mock_train, engine, sample_timeseries):
    #mock influx to return sample data
    engine.influx.query_api().query_data_frame.return_value = sample_timeseries.rename(
        columns={"timestamp": "_time"} 
    )
    
    mock_metrics.return_value = {"todays_usage": 100.0, "todays_cost": 22.0}
    mock_train.return_value = {
        "forecast_peak": 150.0,
        "forecast_avg_day": 120.0,
        "model_mape": 0.05,
        "forecast_series": []
    }
    
    engine.process_all_buildings()
    
    # ensure supabase upsert was called once with formatted list
    upsert_mock = engine.supabase.table().upsert
    upsert_mock.assert_called_once()
    
    payload = upsert_mock.call_args[0][0] #inspect payload
    assert len(payload) == 1
    assert payload[0]['building_id'] == 'bld_test_1'
    assert 'updated_at' in payload[0]
    assert payload[0]['todays_cost'] == 22.0
    assert payload[0]['forecast_peak'] == 150.0

#negative test, tests graceful exit when influx returns nothing
def test_process_all_buildings_negative_empty_influx(engine):
    engine.influx.query_api().query_data_frame.return_value = []
    engine.process_all_buildings()
    
    # upsert should not be called on empty data
    engine.supabase.table().upsert.assert_not_called()

#edge case, influx sometimes returns list of dataframes instead of a single dataframe
def test_process_all_buildings_edge_list_return(engine, sample_timeseries):
    df1 = sample_timeseries.rename(columns={"timestamp": "_time"})
    df2 = df1.copy()
    df2['building_id'] = 'bld_test_2'
    
    engine.influx.query_api().query_data_frame.return_value = [df1, df2]
    
    engine.process_all_buildings()
    
    #ensure it concat-ed them and processed both buildings
    upsert_mock = engine.supabase.table().upsert
    payload = upsert_mock.call_args[0][0]
    
    assert len(payload) == 2
    ids_processed = [p['building_id'] for p in payload]
    assert 'bld_test_1' in ids_processed
    assert 'bld_test_2' in ids_processed