import pytest
import sys
from unittest.mock import MagicMock, patch, call
sys.modules['mlflow'] = MagicMock()
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from backend.analytics.src.core_engine import AnalyticsEngine
from backend.analytics.src.config import UTILITY_RATE_KWH

# fixtures

@pytest.fixture
def engine():
    """Create analytics engine instance with mocked influxdb and supabase clients"""
    with patch('backend.analytics.src.core_engine.InfluxDBClient') as mock_influx, \
         patch('backend.analytics.src.core_engine.create_client') as mock_create_client:
        
        mock_supabase_client = MagicMock()
        mock_create_client.return_value = mock_supabase_client
        
        eng = AnalyticsEngine()
        yield eng

@pytest.fixture
def sample_weekly_timeseries():
    """Generates 14 days of hourly usage data for weekly forecasting tests"""
    now = datetime.now(timezone.utc)
    dates = pd.date_range(end=now, periods=336, freq='h')  # 14 * 24 = 336 hours
    df = pd.DataFrame({
        'timestamp': dates,
        'usage': np.random.normal(50.0, 150.0, size=336),  # random usage value between 50-150 kwh
        'building_id': 'bld_test_1'
    })
    return df

@pytest.fixture
def sample_monthly_timeseries():
    """Generates 12 weeks of weekly aggregated data fro monthly forecasting tests"""
    now = datetime.now(timezone.utc)
    dates = pd.date_range(end=now, periods=12, freq='W')  # 12 weeks
    df = pd.DataFrame({
        'timestamp': dates,
        'usage': np.random.normal(300.0, 1000.0, size=12),  # weekly usage between 300-1000 kwh
        'building_id': 'bld_test_1'
    })
    return df

def _create_mock_df(periods, val, bld_id, freq='h'):
    now = datetime.now(timezone.utc)
    return pd.DataFrame({
        '_time': pd.date_range(end=now, periods=periods, freq=freq),
        'usage_kwh': [val] * periods,
        'building_id': bld_id
    })


# tests for registering building

def test_register_new_building_positive(engine):
    """Test successful registration of a new building in both analytics tables"""
    mock_table = engine.supabase.table
    mock_upsert = mock_table.return_value.upsert
    mock_execute = mock_upsert.return_value.execute
    mock_execute.return_value = MagicMock()

    result = engine.register_new_building('bld_test_1')

    # verify that the builindg was registered
    assert result is True
    # should insert into both weekly and monthly tables
    assert mock_table.call_count == 2
    mock_table.assert_any_call('building_analytics_weekly')
    mock_table.assert_any_call('building_analytics_monthly')
    
    # verify both upsert calls contain correct inital data
    upsert_calls = mock_upsert.call_args_list
    assert len(upsert_calls) == 2
    for upsert_call in upsert_calls:
        payload = upsert_call[0][0]
        assert payload['building_id'] == 'bld_test_1'
        assert payload['todays_usage'] == 0.0
        assert payload['todays_cost'] == 0.0

def test_register_new_building_no_supabase(engine):
    """Test registration fails gracefully when supabase client is None"""
    engine.supabase = None
    result = engine.register_new_building('bld_test_1')
    assert result is False

def test_register_new_building_exception(engine):
    """Test registraion handles database exceptions properly"""
    engine.supabase.table.side_effect = Exception("Database connection failure")
    # execption should be raised up to caller
    with pytest.raises(Exception, match="Database connection failure"):
        engine.register_new_building('bld_test_1')


# tests for getting active buidling ids

def test_get_active_building_ids_positive(engine):
    """Test successfully fetching active building ids from supabase"""
    mock_res = MagicMock()
    mock_res.data = [
        {"building_id": "bld_1"},
        {"building_id": "bld_2"},
        {"other_key": "ignored"} # should be filterd out
    ]
    engine.supabase.table.return_value.select.return_value.filter.return_value.execute.return_value = mock_res

    res = engine.get_active_building_ids()
    assert res == ["bld_1", "bld_2"] # only valid building_ids should be returned
    engine.supabase.table.assert_called_with("buildings")

def test_get_active_building_ids_empty_or_none(engine):
    """Test handleing when no buildings are returned from query"""
    mock_res = MagicMock()
    mock_res.data = None
    engine.supabase.table.return_value.select.return_value.filter.return_value.execute.return_value = mock_res

    res = engine.get_active_building_ids()
    assert res == []  # return empty list instead of None

def test_get_active_building_ids_no_supabase(engine):
    """Test handles query expections by returning empty list"""
    engine.supabase = None
    res = engine.get_active_building_ids()
    assert res == []

def test_get_active_building_ids_exception(engine):
    """Test handles query exceptions by returning an empty list"""
    engine.supabase.table.side_effect = Exception("Supabase select failure")
    res = engine.get_active_building_ids()
    assert res == []  # gracefully handles error


# tests for seeding missing influx data

def test_seed_missing_influx_telemetry_positive(engine):
    """Test successful seeding of missing telemetry data"""
    mock_write_api = MagicMock()
    engine.influx.write_api.return_value = mock_write_api

    engine.seed_missing_influx_telemetry('bld_test_1', days_back=2)
    
    # verify data was written and connection was closed
    assert mock_write_api.write.called
    assert mock_write_api.close.called

def test_seed_missing_influx_telemetry_exception(engine):
    """Test handles influxdb connection errors gracefully"""
    engine.influx.write_api.side_effect = Exception("Influx connection timeout")
    # Should catch internally and log error rather than raising
    # Function should complete without raising any exceptions
    engine.seed_missing_influx_telemetry('bld_test_1', days_back=1)


# tests for refreshing today's metrics

def test_refresh_todays_metrics_positive(engine):
    """Test successful refresh of today's metrics from influxdb to supabase"""
    now = datetime.now(timezone.utc)
    dates = pd.date_range(end=now, periods=48, freq='h')
    df = pd.DataFrame({
        '_time': dates,
        'usage': [15.0] * 48,
        'building_id': 'bld_test_1'
    })
    engine.influx.query_api().query_data_frame.return_value = df
    
    mock_table = engine.supabase.table
    mock_upsert = mock_table.return_value.upsert
    mock_execute = mock_upsert.return_value.execute
    
    res = engine.refresh_todays_metrics('bld_test_1')
    
    # verify successful update
    assert "update" in res
    assert res["update"]["building_id"] == "bld_test_1"
    # should update both weekly and monthly
    assert mock_table.call_count == 2
    mock_table.assert_any_call('building_analytics_weekly')
    mock_table.assert_any_call('building_analytics_monthly')

@patch.object(AnalyticsEngine, 'seed_missing_influx_telemetry')
def test_refresh_todays_metrics_empty_then_seeding(mock_seed, engine):
    """Test that seeding is triggered when no data ecists initially"""
    now = datetime.now(timezone.utc)
    dates = pd.date_range(end=now, periods=48, freq='h')
    df = pd.DataFrame({
        '_time': dates,
        'usage': [10.0] * 48,
        'building_id': 'bld_test_1'
    })
    
    # first query empty second query returns data frame
    engine.influx.query_api().query_data_frame.side_effect = [pd.DataFrame(), df]
    res = engine.refresh_todays_metrics('bld_test_1')

    #verify that seeding was triggered
    assert mock_seed.called
    assert "update" in res
    assert res["update"]["building_id"] == "bld_test_1"

def test_refresh_todays_metrics_completely_empty(engine):
    """Test handles case where data remains empty even after seeding"""
    # returns empty data frames both times
    engine.influx.query_api().query_data_frame.return_value = pd.DataFrame()
    
    res = engine.refresh_todays_metrics('bld_test_1')
    assert res == {}  # returns empty dictionary when no data


# tests for training and forecasting weekly

@patch('backend.analytics.src.core_engine.optuna.create_study')
def test_train_and_forecast_weekly_positive(mock_study, engine, sample_weekly_timeseries):
    """Test successful weekly model training and forecasting"""
    # mock Optuna study with predefined best params
    mock_study_instance = MagicMock()
    mock_study_instance.best_params = {
        "regressor": "RandomForest",
        "n_estimators": 2,
        "max_depth": 2
    }
    mock_study_instance.best_value = 0.05  # MAPE = 5%
    mock_study.return_value = mock_study_instance

    res = engine.train_and_forecast_weekly(sample_weekly_timeseries)
    
    # verify forecast results structure
    assert res is not None
    assert "forecast_peak" in res
    assert "forecast_avg_day" in res
    assert res["model_mape"] == 0.05  # matches mock best_value
    assert len(res["forecast_series"]) == 168  # 7 days * 24 hours
    assert "timestamp" in res["forecast_series"][0]
    assert "predicted_usage" in res["forecast_series"][0]

def test_train_and_forecast_weekly_insufficient_data(engine):
    now = datetime.now(timezone.utc)
    df_short = pd.DataFrame({
        'timestamp': pd.date_range(end=now, periods=10, freq='h'),  # only 10 hours of data
        'usage': [100.0] * 10
    })
    
    res = engine.train_and_forecast_weekly(df_short)
    assert res == {}  # not enough data for weekly forecast


# tests for training and forecasting monthly

@patch('backend.analytics.src.core_engine.optuna.create_study')
def test_train_and_forecast_monthly_positive(mock_study, engine, sample_monthly_timeseries):
    """Test successful monthly model training and forecasting"""
    # mock Optuna with predefined best params
    mock_study_instance = MagicMock()
    mock_study_instance.best_params = {
        "regressor": "RandomForest",
        "n_estimators": 2,
        "max_depth": 2
    }
    mock_study_instance.best_value = 0.07  # MAPE = 7%
    mock_study.return_value = mock_study_instance

    res = engine.train_and_forecast_monthly(sample_monthly_timeseries)
    
    # verify forecast results structure
    assert res is not None
    assert "forecast_peak" in res
    assert "forecast_avg_day" in res
    assert res["model_mape"] == 0.07
    assert len(res["forecast_series"]) == 12  # 12 weeks forecast
    assert "timestamp" in res["forecast_series"][0]
    assert "predicted_usage" in res["forecast_series"][0]

def test_train_and_forecast_monthly_insufficient_data(engine):
    now = datetime.now(timezone.utc)
    df_short = pd.DataFrame({
        'timestamp': pd.date_range(end=now, periods=3, freq='W'),  # only 3 weeks of data
        'usage': [50.0] * 3
    })
    
    res = engine.train_and_forecast_monthly(df_short)
    assert res == {}  # not enough data for montly forecast


# tests for processing a single buidling

@patch.object(AnalyticsEngine, 'register_new_building')
@patch.object(AnalyticsEngine, 'train_and_forecast_weekly')
@patch.object(AnalyticsEngine, 'train_and_forecast_monthly')
def test_process_single_building_positive(mock_monthly, mock_weekly, mock_register, engine):
    """Test complete processing of a single building including fetch, ML training and uploading"""
    df_weekly = _create_mock_df(48, 10.0, 'bld_test_1')
    df_monthly = _create_mock_df(5 * 24 * 7, 20.0, 'bld_test_1')
    
    # mock influx queries
    engine.influx.query_api().query_data_frame.side_effect = [df_weekly, df_monthly]
    
    # mock ML results
    mock_weekly.return_value = {"forecast_peak": 100.0, "forecast_avg_day": 80.0, "model_mape": 0.05, "forecast_series": []}
    mock_monthly.return_value = {"forecast_peak": 200.0, "forecast_avg_day": 160.0, "model_mape": 0.06, "forecast_series": []}
    
    engine.process_single_building('bld_test_1')
    
    # verify registraion and uploads
    mock_register.assert_called_once_with('bld_test_1')
    # should upload to weekly and monthly tables
    assert engine.supabase.table.call_count == 2


# tests for processing all buildings

@patch.object(AnalyticsEngine, 'get_active_building_ids')
@patch.object(AnalyticsEngine, 'register_new_building')
@patch.object(AnalyticsEngine, 'seed_missing_influx_telemetry')
@patch.object(AnalyticsEngine, 'train_and_forecast_weekly')
@patch.object(AnalyticsEngine, 'train_and_forecast_monthly')
def test_process_all_buildings_positive(mock_monthly, mock_weekly, mock_seed, mock_register, mock_get_ids, engine):
    """Test processing all active buildings with data available"""
    mock_get_ids.return_value = ['bld_test_1', 'bld_test_2']
    
    df_weekly = _create_mock_df(48, 10.0, 'bld_test_1')
    df_monthly = _create_mock_df(5 * 24 * 7, 20.0, 'bld_test_1')
    
    # creat data for building 2 after seeding
    df_weekly_all = pd.concat([df_weekly, _create_mock_df(48, 15.0, 'bld_test_2')])
    df_monthly_all = pd.concat([df_monthly, _create_mock_df(5 * 24 * 7, 30.0, 'bld_test_2')])
    
    # mock influx queries: inital queries, then queries after seeding
    engine.influx.query_api().query_data_frame.side_effect = [
        df_weekly, # inital weekly query
        df_monthly,  # inital monthly query
        df_weekly_all,  # weekly query after seeding
        df_monthly_all  # monthly query after seeding
    ]
    
    mock_weekly.return_value = {"forecast_peak": 100.0, "forecast_avg_day": 80.0, "model_mape": 0.05, "forecast_series": []}
    mock_monthly.return_value = {"forecast_peak": 200.0, "forecast_avg_day": 160.0, "model_mape": 0.06, "forecast_series": []}
    
    engine.process_all_buildings()
    
    # verify both buildings were registered
    assert mock_register.call_count == 2
    mock_seed.assert_called_once_with('bld_test_2')
    assert engine.supabase.table.call_count == 2

@patch.object(AnalyticsEngine, 'get_active_building_ids')
@patch.object(AnalyticsEngine, 'register_new_building')
def test_process_all_buildings_negative_empty_influx(mock_register, mock_get_ids, engine):
    """Test handleing when no data exists in inlfux db"""
    mock_get_ids.return_value = ['bld_test_1']
    engine.influx.query_api().query_data_frame.return_value = pd.DataFrame()
    
    engine.process_all_buildings()
    
    # building registered but no analytics uploaded
    mock_register.assert_called_once_with('bld_test_1')
    engine.supabase.table.assert_not_called()  # no data to upload

@patch.object(AnalyticsEngine, 'get_active_building_ids')
@patch.object(AnalyticsEngine, 'register_new_building')
@patch.object(AnalyticsEngine, 'train_and_forecast_weekly')
@patch.object(AnalyticsEngine, 'train_and_forecast_monthly')
def test_process_all_buildings_edge_list_return(mock_monthly, mock_weekly, mock_register, mock_get_ids, engine):
    """Test handleing when influxdb returns list od data frames instead of single data frame"""
    mock_get_ids.return_value = ['bld_test_1', 'bld_test_2']
    
    now = datetime.now(timezone.utc)
    dates_weekly = pd.date_range(end=now, periods=48, freq='h')

    # creates separate data frames for each building
    df1 = _create_mock_df(48, 10.0, 'bld_test_1')
    df2 = _create_mock_df(48, 15.0, 'bld_test_2')
    df3 = _create_mock_df(5 * 24 * 7, 20.0, 'bld_test_1')
    df4 = _create_mock_df(5 * 24 * 7, 30.0, 'bld_test_2')
    
    # influxdb returns list of dataframes
    engine.influx.query_api().query_data_frame.side_effect = [
        [df1, df2],  # weekly returns list
        [df3, df4]  # monthly returns list
    ]
    
    mock_weekly.return_value = {"forecast_peak": 100.0, "forecast_avg_day": 80.0, "model_mape": 0.05, "forecast_series": []}
    mock_monthly.return_value = {"forecast_peak": 200.0, "forecast_avg_day": 160.0, "model_mape": 0.06, "forecast_series": []}
    
    #execute - should handle list concatentation properly
    engine.process_all_buildings()
    assert engine.supabase.table.call_count == 2