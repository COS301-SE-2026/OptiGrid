from abc import ABC, abstractmethod
from datetime import datetime, timezone
from influxdb_client import Point, WritePrecision
import logging

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
                logger.error(f"Observer {observer.__class__.__name__} failed: {e}")

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
