import pytest
from unittest.mock import patch, MagicMock
from backend.analytics.src.recommendation_engine import RecommendationSynthesizer
from datetime import datetime, timedelta, timezone

@pytest.fixture
def mock_supabase():
    client = MagicMock()
    client.table.return_value.select.return_value.eq.in_.return_value.gte.return_value.execute.return_value.data = []
    return client


@pytest.fixture
def engine(mock_supabase):
    return RecommendationSynthesizer(mock_supabase)

#test that the data driven stuff is working
def test_data_driven(engine):
    tariffs = [{"peak_rate_zar": 2.0, "peak_start_time": "14:00", "peak_end_time": "18:00"}]
    anomalies = [{"anomaly_id": "a1", "severity_level": "High", "status": "Open", "description": "Spike"}]
    recs = engine.generate_data_driven_rec(
        building_id="building123",
        building_type="Commercial",
        forecast_peak=150.0,
        thresold_kw=100.0,
        tariffs=tariffs,
        anomalies=anomalies
    )
    #asserts
    assert len(recs)== 2
    assert recs[0]["recommendation_category"] == "data"
    assert "Peak Shaving" in recs[0]["applicable_range"]["context"]
    assert recs[1]["applicable_range"]["anomaly_id"] =="a1"

#test negative threshold, should not generate recs
def test_data_driven_neg_threshold(engine):
    recs = engine.generate_data_driven_rec(
        building_id="building123",
        building_type="Commercial",
        forecast_peak=150.0,
        thresold_kw=-100.0,
        tariffs=[],
        anomalies=[]
    )
    #should generate peak savings
    assert len(recs) == 1

#test peak_base_ratio
def test_low_peak_base_ratio(engine):
    recs = engine.generate_data_driven_rec(
        building_id="building123",
        building_type="Commercial",
        forecast_peak=110.0,
        thresold_kw=100.0,
        tariffs=[],
        anomalies=[]
    )
    assert len(recs) == 1

#no rec if savings less than R50
def test_savings_less_than_fifty(engine):
    recs = engine.generate_data_driven_rec(
        building_id="building123",
        building_type="Commercial",
        forecast_peak=60.0,
        thresold_kw=50.0,
        tariffs=[{"peak_rate_zar": 1.0}],
        anomalies=[],
        time_window="daily"
    )

    assert len(recs) == 1

#test weekly n monthly time
def test_time_window(engine):
    with patch("backend.analytics.src.recommendation_engine.datetime") as mock_datetime:
        now = datetime(2026, 8, 29, tzinfo=timezone.utc)
        mock_datetime.now.return_value = now
        mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)

        recs = engine.generate_data_driven_rec(
            building_id="building123",
            building_type="Commercial",
            forecast_peak=110.0,
            thresold_kw=50.0,
            tariffs=[{"peak_rate_zar": 1.0}],
            anomalies=[],
            time_window="monthly"
        )
        assert len(recs) == 1
        expire = (now + timedelta(days=30)).isoformat()
        assert recs[0]["expires_at"] == expire

#testing non data driven now
@patch("backend.analytics.src.recommendation_engine.datetime")
def test_non_data_driven(mock_datetime, engine):
    mock_datetime.now.return_value.month = 7
    mock_datetime.now.return_value.isoformat.return_value = "2026-07-01T00:00:0oz"
    recs = engine.generate_non_data_driven_recs("building-123", "Commercial", [])

    assert len(recs) ==2
    msg = [i["applicable_range"]["context"] for i in recs]
    assert "Winter Optimisation" in msg
    assert "Winter Heating" in msg

#testinf duplication stuff
def test_duplication(mock_supabase, engine):
    mock_supabase.table.return_value.select.return_value.eq.return_value.in_.return_value.gte.return_value.execute.return_value.data = [
        {
            "applicable_range":
                {
                    "context": "Peak Shaving"
                }
        }
    ]
    tariffs = [{ "peak_rate_zar": 2.0}]
    recs = engine.generate_data_driven_rec(
        building_id="building123",
        building_type="Commercial",
        forecast_peak=150.0,
        thresold_kw=100.0,
        tariffs=tariffs,
        anomalies=[]
    )
    assert len(recs)== 0

@patch("backend.analytics.src.recommendation_engine.logger")
def test_duplciate_exception_handling(logger, mock_supabase, engine):
    mock_supabase.table.side_effect = Exception("Error")
    out = engine._is_duplicate("building123", "Peak Shaving")
    assert out is False
    logger.warning.assert_called()

#testing the comfort stuff
@patch('backend.analytics.src.recommendation_engine.requests.get')
def test_comfort_hot(mock_get, engine):
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "current": {
            "temperature_2m": 35.0
        }
    }
    mock_get.return_value = resp
    #assert
    res = engine._calculate_comfort_score(kw_reduced=50.0, forecast_peak=100.0)
    assert res == 5

@patch('backend.analytics.src.recommendation_engine.requests.get')
def test_comfort_normal(mock_get, engine):
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "current": {
            "temperature_2m": 22.0
        }
    }
    mock_get.return_value = resp
    #act n assert
    res = engine._calculate_comfort_score(kw_reduced=50.0, forecast_peak=100.0)
    assert res == 18

@patch('backend.analytics.src.recommendation_engine.RecommendationSynthesizer._calculate_comfort_score')
def test_peak_shaving_omfort(mock_comfort_score, engine):
    mock_comfort_score.return_value = 85
    recs = engine.generate_data_driven_rec(
        building_id="building-123",
        building_type="Commercial",
        forecast_peak=150.0,
        thresold_kw=100.0,
        tariffs=[],
        anomalies=[]
    )
    #ant n asser
    assert len(recs) > 0
    peak_rec = recs[0]
    assert "predicted_comfort_score" in peak_rec["applicable_range"]
    assert peak_rec["applicable_range"]["predicted_comfort_score"] == 85

@patch('backend.analytics.src.recommendation_engine.RecommendationSynthesizer._calculate_comfort_score')
def test_season_optimisation_injects_comfort_score(mock_comfort_score, engine):
    mock_comfort_score.return_value = 90
    with patch("backend.analytics.src.recommendation_engine.datetime") as mock_datetime:
        mock_datetime.now.return_value.month = 12
        recs = engine.generate_non_data_driven_recs(
            building_id="B1",
            building_type="Commercial",
            tariffs=[]
        )
        #act n assert
        assert len(recs) > 0
        assert "predicted_comfort_score" in recs[0]["applicable_range"]
        assert recs[0]["applicable_range"]["predicted_comfort_score"] == 90

def test_comfort_without_shed_skips_weather_lookup(engine):
    with patch('backend.analytics.src.recommendation_engine.requests.get') as mock_get:
        res = engine._calculate_comfort_score(kw_reduced=0.0, forecast_peak=1.0)
        assert res == 100
        mock_get.assert_not_called()

def test_comfort_costs_points_even_in_mild_weather(engine):
    res = engine._calculate_comfort_score(kw_reduced=50.0, forecast_peak=150.0, outside_temp=22.0)
    assert res == 45

def test_comfort_heat_amplifies_the_penalty(engine):
    res = engine._calculate_comfort_score(kw_reduced=50.0, forecast_peak=150.0, outside_temp=35.0)
    assert res == 9

@patch('backend.analytics.src.recommendation_engine.requests.get')
def test_comfort_falls_back_to_neutral_temperature(mock_get, engine):
    mock_get.side_effect = Exception("offline")
    res = engine._calculate_comfort_score(kw_reduced=50.0, forecast_peak=150.0)
    assert res == 45

@patch('backend.analytics.src.recommendation_engine.RecommendationSynthesizer._fetch_outside_temperature')
def test_peak_shaving_stores_the_weather_behind_its_comfort_score(mock_temperature, engine):
    mock_temperature.return_value = 30.0
    recs = engine.generate_data_driven_rec(
        building_id="building-123",
        building_type="Commercial",
        forecast_peak=150.0,
        thresold_kw=100.0,
        tariffs=[],
        anomalies=[]
    )
    peak_rec = recs[0]
    assert peak_rec["applicable_range"]["tradeoff_inputs"] == {"outside_temp_c": 30.0}
    assert peak_rec["applicable_range"]["predicted_comfort_score"] == 23