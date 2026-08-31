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
    assert len(recs) == 0

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

    assert len(recs) == 0

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