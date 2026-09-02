import uuid
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any

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
        if forecast_peak > thresold_kw and peak_base_ratio > 1.0:
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
        is_spring = curr_month in [9, 10, 11]
        is_autumn = curr_month in [3, 4, 5]

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
        elif is_spring:
            rec = self._calculate_season_optimisation(building_id, building_type, "Spring HVAC Optimisation")
            if rec: 
                recs.append(rec)
        elif is_autumn:
            rec = self._calculate_season_optimisation(building_id, building_type, "Autumn Lighting")
            if rec: 
                recs.append(rec)

        return recs

    def get_probable_equipment(self, building_type: str, sample_size: int = 2) -> str:
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

        equipment = mapping.get(building_type, [
            "HVAC", "High-Load Equipment", "Lighting", "Pumps"
        ])
        #random recommnedation given
        sr = secrets.SystemRandom()
        out = sr.sample(equipment, min(sample_size, len(equipment))) # NOSONAR
        return " or ".join(out)

    def _calculate_peak_shaving(self, building_id, building_type, forecast_peak, threshold_kw, tariffs, time_window, peak_base_ratio):
        equipment = self.get_probable_equipment(building_type)
        kw_reduced = forecast_peak-threshold_kw

        peak_rate = 1.5
        #standard_rate = 1.0
        peak_start = "14:00"
        peak_end = "18:00"

        if tariffs:
            tar = tariffs[0]
            peak_rate = float(tar.get("peak_rate_zar", 1.5))
            if tar.get("peak_start_time"):
                peak_start = str(tar["peak_start_time"])[:5]
            if tar.get("peak_end_time"):
                peak_end = str(tar["peak_end_time"])[:5]

        peak_kwh_saved = kw_reduced * 2.0
        rate = 1
        if time_window == "weekly":
            rate = 4
        monthly_savings = (peak_rate*peak_kwh_saved) * rate


        context = "Peak Shaving"
        if self._is_duplicate(building_id, context):
            return None

        strategy = (
            f"Aggregate sensors forecast a peak load of {round(forecast_peak, 2)}kW, exceeding your threshold by {round((peak_base_ratio - 1) * 100, 1)}%."
            f"To shift load away from peak tariff hours ({peak_start} - {peak_end}), investigate likely drivers such as {equipment}."
        )

        return {
            "building_id": building_id,
            "strategy_description": strategy,
            "estimated_monthly_savings": round(monthly_savings, 2),
            "status": "Pending",
            "recommendation_category": "data",
            "applicable_range": {
                "time_window":{
                    "start": peak_start, 
                    "end": peak_end,
                    "timezone": "Africa/Johannesburg"
                },
                "load_bounds_kw": {
                    "min_expected": round(threshold_kw, 2),
                    "max_allowed": round(forecast_peak, 2)
                },
                "assumed_equipment": equipment,
                "confidence_score": 0.85,
                "context": context
            },
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=(7 if time_window == "weekly" else 30))).isoformat()
        }

    def _calculate_anomaly_investigation(self, building_id, building_type, anomaly):
        context= f"Anomaly Investigation {anomaly.get('anomaly_id')}"
        if self._is_duplicate(building_id, context):
            return None

        equipment = self.get_probable_equipment(building_type, sample_size=3)
        desc = anomaly.get("description", "Unusual aggregate consumption detected")

        startegy = (
            f"Anomaly detected: {desc}. Because we track overall consumption, this could be caused by"
            f" systems left running overnight or malfunctioning equipment (likely {equipment}).Investigate affected zones to reduce the baseload."
        )

        return {
            "building_id": building_id,
            "strategy_description": startegy,
            "estimated_monthly_savings": 200.0,
            "status": "Pending",
            "recommendation_category": "data",
            "applicable_range": {
                "assumed_equipment": equipment,
                "context": context,
                "anomaly_id": anomaly.get("anomaly_id")
            },
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        }

    def _calculate_season_optimisation(self, building_id, building_type, context):
        if self._is_duplicate(building_id, context):
            return None

        equipment = self.get_probable_equipment(building_type)
        if context == "Winter Optimisation":
            strategy = f"Winter tariffs are active. Shift non-essential heavy loads (like {equipment}) to off-peak hours to avoid seasonal peak surcharges."
            savings = 500.0
        elif context == "Summer Lighting":
            strategy= "Sunset is occurring later. Adjust outdoor lighting and communal area timer schedules to match daylight hours."
            savings =150.0
        elif context == "Winter Heating":
            strategy = f"Winter temperatures increase aggregate load. Ensure climate control and heating systems (such as {equipment}) are on strict timers to prevent overnight idling."
            savings = 300.0
        elif context == "Spring HVAC Optimisation":
            strategy = f"Spring weather can be variable. Optimise HVAC systems (such as {equipment}) by relying more on fresh air ventilation to reduce baseload."
            savings = 250.0
        elif context == "Autumn Lighting":
            strategy = f"Days are getting shorter in autumn. Adjust outdoor lighting and communal area timer schedules to match daylight hours efficiently."
            savings = 150.0
        else:
            strategy = f"General seasonal optimisation for {context}. Monitor usage on {equipment}."
            savings = 100.0

        return {
            "building_id": building_id,
            "strategy_description": strategy,
            "estimated_monthly_savings": savings,
            "status": "Pending",
            "recommendation_category": "non_data",
            "applicable_range": {
                "assumed_equipment": equipment,
                "context": context
            },
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        }

    def _is_duplicate(self, building_id:str, context: str) -> bool:
        if not self.supabase: 
            return False

        try:
            #variable to keep track of seven day limit
            seven = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            resp = self.supabase.table("optimisation_recommendations").select("applicable_range") \
            .eq("building_id", building_id) \
            .in_("status", ["Pending", "Implemented"]) \
            .gte("generated_date", seven) \
            .execute()

            if resp.data:
                for i in resp.data:
                    raNge = i.get("applicable_range") or {}
                    context_existed = raNge.get("context","")
                    if context_existed == context:
                        return True
            return False
        except Exception as error:
            logger.warning("Failed deduplication check for %s: %s", building_id, error)
            return False