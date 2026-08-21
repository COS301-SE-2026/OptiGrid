from abc import ABC, abstractmethod
from datetime import datetime, timezone
from influxdb_client import Point, WritePrecision
import logging
import os
import redis

logger = logging.getLogger(__name__)

# Oberserver Participant
class Observer(ABC):
    @abstractmethod
    def update(self, payload: dict):
        pass

# Oberserver Subject/Concrete Subject
class TelemetrySubject:
    def __init__(self):
        self._observers = []

    def attach(self, observer: Observer):
        if observer not in self._observers:
            self._observers.append(observer)

    def detach(self, observer: Observer):
        try:
            self._observers.remove(observer)
        except ValueError:
            pass

    def notify(self, payload: dict):
        for observer in self._observers:
            try:
                observer.update(payload)
            except Exception as e:
                logger.exception(f"Observer {observer.__class__.__name__} failed: {e}")

# Concrete Observer
class InfluxStorageObserver(Observer):
    def __init__(self, write_api, bucket: str):
        self.write_api = write_api
        self.bucket = bucket

    def update(self, payload: dict):
        building_id = payload.get("building_id")
        sensor_id = payload.get("sensor_id")
        power_kw = payload.get("power_kw", 0.0)
        voltage_v = payload.get("voltage_v")
        current_a = payload.get("current_a")
        ts_str = payload.get("timestamp")

        if ts_str:
            try:
                time_val = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            except Exception:
                time_val = datetime.now(timezone.utc)
        else:
            time_val = datetime.now(timezone.utc)

        # create influx data point with queue data
        point = (
            Point("energy_telemetry")
            .tag("building_id", building_id)
            .tag("sensor_id", sensor_id)
            .field("usage", float(power_kw))
            .field("voltage_v", float(voltage_v) if voltage_v is not None else 230.0)
            .field("current_a", float(current_a) if current_a is not None else 0.0)
            .time(time_val, WritePrecision.NS)
        )

        # attempt to flush to influx
        self.write_api.write(bucket=self.bucket, record=point)
        print(f"[WORKER] Flushed telemetry to InfluxDB for building {str(building_id)[:8]} ({power_kw} kW)")

# Concrete Observer
class AnomalyDetectorObserver(Observer):
    def __init__(self, redis_url=None):
        try:
            from backend.ingestion.src.config import REDIS_HOST, REDIS_PORT, REDIS_DB
        except ModuleNotFoundError:
            from config import REDIS_HOST, REDIS_PORT, REDIS_DB
            
        redis_url = redis_url or os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}")
        self.redis = redis.Redis.from_url(redis_url, decode_responses=True)
        self._last_alert_time = {} # (building_id, metric_type) -> timestamp
        self._debounce_seconds = 900 # 15 minutes
        import functools, time
        self._get_thresholds = functools.lru_cache(maxsize=128)(self._fetch_thresholds_cached)
        self._last_cache_clear = time.time()
        
    def _fetch_thresholds_cached(self, building_id: str):
        import json, logging
        try:
            keys = self.redis.keys(f"threshold:{building_id}:*")
            thresholds = []
            for k in keys:
                data = self.redis.get(k)
                if data:
                    thresholds.append(json.loads(data))
            return thresholds
        except Exception as e:
            logging.exception(f"Failed to fetch thresholds from Redis: {e}")
            return []

    def _update_ema_zscore(self, sensor_id: str, value: float):
        import math
        # alpha for roughly 60 samples window
        alpha = 2.0 / (60.0 + 1.0)
        
        key = f"zscore:ema:{sensor_id}"
        data = self.redis.hgetall(key)
        
        if not data:
            # Initialize
            self.redis.hset(key, mapping={"ema": value, "emavar": 0.0, "count": 1})
            return 0.0
            
        ema = float(data.get(b"ema", data.get("ema", 0.0)))
        emavar = float(data.get(b"emavar", data.get("emavar", 0.0)))
        count = int(data.get(b"count", data.get("count", 0)))
        
        diff = value - ema
        incr = alpha * diff
        new_ema = ema + incr
        new_emavar = (1.0 - alpha) * (emavar + diff * incr)
        
        self.redis.hset(key, mapping={"ema": new_ema, "emavar": new_emavar, "count": count + 1})
        
        stddev = math.sqrt(new_emavar)
        if stddev < 1e-5:
            return 0.0
            
        return (value - ema) / stddev

    def _evaluate_threshold(self, t, sensor_id, power_kw, z_score):
        if t.get("metric_type") != "POWER_USAGE":
            return False, "Warning", None, z_score
            
        upper = t.get("upper_limit_kw")
        lower = t.get("lower_limit_kw")
        use_z_score = t.get("use_z_score", False)
        z_thresh = t.get("z_score_threshold")
        
        if upper is not None and power_kw > float(upper):
            sev = "Critical" if abs(power_kw - float(upper)) / float(upper) > 0.5 else "Warning"
            return True, sev, float(upper), z_score
            
        if lower is not None and power_kw < float(lower):
            sev = "Critical" if abs(power_kw - float(lower)) / float(lower) > 0.5 else "Warning"
            return True, sev, float(lower), z_score
            
        if use_z_score:
            if z_score is None:
                z_score = self._update_ema_zscore(sensor_id, power_kw)
            if z_thresh is not None and abs(z_score) > float(z_thresh):
                return True, "Warning", float(z_thresh), z_score
            
        return False, "Warning", None, z_score

    def update(self, payload: dict):
        import time, json, logging
        from datetime import datetime, timezone
        # Clear cache every 30 seconds to get fresh thresholds
        if time.time() - self._last_cache_clear > 30:
            self._get_thresholds.cache_clear()
            self._last_cache_clear = time.time()
            
        building_id = payload.get("building_id")
        sensor_id = payload.get("sensor_id")
        power_kw = payload.get("power_kw", 0.0)
        
        if not building_id or not sensor_id:
            return
            
        thresholds = self._get_thresholds(building_id)
        if not thresholds:
            return
            
        now = time.time()
        z_score = None
            
        for t in thresholds:
            is_anomaly, severity, expected, z_score = self._evaluate_threshold(t, sensor_id, power_kw, z_score)
            if is_anomaly:
                self._trigger_anomaly(
                    building_id, sensor_id, "POWER_USAGE", severity, power_kw, expected,
                    z_score if t.get("use_z_score", False) else None, now, payload.get("timestamp")
                )
                
    def _trigger_anomaly(self, building_id, sensor_id, metric, severity, value, limit, z_score, now, timestamp_str):
        import json, logging
        from datetime import datetime, timezone
        
        # Debounce to avoid alert fatigue
        alert_key = (building_id, metric)
        if alert_key in self._last_alert_time:
            if now - self._last_alert_time[alert_key] < self._debounce_seconds:
                return
                
        self._last_alert_time[alert_key] = now
        
        anomaly_msg = {
            "building_id": building_id,
            "sensor_id": sensor_id,
            "metric_type": metric,
            "severity_level": severity,
            "detected_value": float(value),
            "expected_value": float(limit) if limit is not None else 0.0,
            "z_score_value": float(z_score) if z_score is not None else None,
            "detected_timestamp": timestamp_str or datetime.now(timezone.utc).isoformat()
        }
        
        try:
            self.redis.publish("anomalies_channel", json.dumps(anomaly_msg))
            print(f"[ANOMALY DETECTOR] Published {metric} anomaly for {building_id[:8]} ({value})")
        except Exception as e:
            logging.exception(f"Failed to publish anomaly: {e}")
