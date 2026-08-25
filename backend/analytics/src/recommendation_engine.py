import uuid
import random
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RecommendationSynthesizer:
    def __init__(self, client):
        self.supabase = client

    def generate_data_driven_rec(
        self, 
        building_id:str,
        building_type: str,
        forecast_peak:float,
        thresold_kw: float,
        tariffs: List[Dict[str, Any]],
        anomalies: List[Dict[str, Any]],
        time_window: str= "weekly"
    ) -> List[Dict[str, Any]]:
        recs = []

        if thresold_kw < 0:
            thresold_kw = 1
        #predictive peak recommendations calc
        peak_base_ratio = forecast_peak/thresold_kw
        if forecast_peak > thresold_kw and peak_base_ratio > 1.3:
            peak_rec = self._calculate_peak_shaving(building_id, building_type, forecast_peak,
                    thresold_kw, tariffs, time_window, peak_base_ratio
            )
            if peak_rec:
                recs.append(peak_rec)

        #anomalies recommendations calc
        if anomalies:
            for i in anomalies:
                if i.get("severity_level") in ["High", "Critical"] and i.get("status") == "Open":
                    anomaly_rec = self._calculate_anomaly_investigation(building_id, building_type, i)
                    if anomaly_rec:
                        recs.append(anomaly_rec)

        return recs
        
    def generate_non_data_driven_recs(
        self, 
        building_id:str,
        building_type: str,
        tariffs: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:

        recs = []
        curr_month = datetime.now(timezone.utc).month

        is_summer = curr_month in [12, 1, 2]
        is_winter = curr_month in [6, 7, 8]

        if curr_month in [5, 6, 7]:
            rec = self._calculate_season_optimisation(building_id, building_type, "Winter Optimisation")
            if rec:
                recs.append(rec)
        #optimise whether its summer/winter
        if is_summer:
            rec = self._calculate_season_optimisation(building_id, building_type, "Summer Lighting")
            if rec: 
                recs.append(rec)
        elif is_winter:
            rec = self._calculate_season_optimisation(building_id, building_type, "Winter Heating")
            if rec: 
                recs.append(rec)

        return recs

    def get_probable_equipment(self, builing_type: str, sample_size: int = 2) -> str:
        #added things that may be causing high usage since sensors dont measure equipment, only measure usage
        mapping = {
            "Construction": ["Cranes", "Heavy Power Tools", "Site Lighting", "Temporary Heaters", "Welders"],
            "ShoppingCentre": ["Escalators", "Large Refrigeration Units", "HVAC Zones", "Display Lighting", "Air Curtains"],
            "Commercial": ["HVAC Zones", "Elevator Banks", "Server Rooms", "Office Lighting", "Water Pumps"],
            "Industrial": ["Heavy Machinery", "Assembly Lines", "Compressors", "Industrial Fans", "Ovens/Furnaces"],
            "Healthcare": ["Non-Critical HVAC", "Secondary Lighting", "Sterilization Equipment", "Laundry Facilities"],
            "Residential": ["Communal AC", "Pool Pumps", "Geysers", "Communal Lighting", "Elevators"],
            "Mixed_Use": ["Communal HVAC", "Elevators", "Retail Refrigeration", "Parking Lighting", "Water Pumps"]
        }

        equipment = mapping.get(builing_type, [
            "HVAC", "High-Load Equipment", "Lighting", "Pumps"
        ])
        #random recommnedation given
        out = random.sample(equipment, min(sample_size, len(equipment)))
        return " or ".join(out)