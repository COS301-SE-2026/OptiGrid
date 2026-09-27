import math
import uuid
import secrets
import logging
import requests
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NEUTRAL_TEMP_C = 22.0
WEATHER_AMPLIFIER = 0.05
SHED_PENALTY_SCALE = 165.0
MAX_COMFORT_PENALTY = 95.0

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
        cumulative_kwh: float = 0.0,
        time_window: str= "weekly"
    ) -> List[Dict[str, Any]]:
        recs = []

        if thresold_kw <= 0:
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
                if str(i.get("severity_level", "")).lower() in ["high", "critical"] and i.get("status") == "Open":
                    anomaly_rec = self._calculate_anomaly_investigation(building_id, building_type, i)
                    if anomaly_rec:
                        recs.append(anomaly_rec)

        #prepaid advice calc
        prepaid_rec = self.generate_prepaid_purchase_advice(building_id, cumulative_kwh, tariffs)
        if prepaid_rec:
            recs.append(prepaid_rec)

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
        standard_rate = 1.0
        peak_start = "17:00"
        peak_end = "19:00"

        if tariffs:
            tar = tariffs[0]
            tariff_structure = tar.get("tariff_structure", {})
            if tariff_structure:
                #we get the rates for the curr season and to calculate the savings
                now = datetime.now(timezone.utc)
                peak_rate = self.get_current_rate(now, tariff_structure, peak_only=True)
                season = self.get_season(now, tariff_structure.get("seasons", []))
                blocks = tariff_structure.get("blocks", [])
                if blocks:
                    standard_rate = float(blocks[0].get("rates", {}).get(season, {}).get("Standard", 1.0))
                else:
                    standard_rate = 1.0
                
                weekday_schedule = tariff_structure.get("tou_schedule", {}).get("weekday", [])
                peak_periods = [p for p in weekday_schedule if p.get("period") == "Peak"]
                if peak_periods:
                    evening_peak = peak_periods[-1]
                    start_hr = evening_peak.get("startHour", 17)
                    end_hr = evening_peak.get("endHour", 19)
                    peak_start = f"{start_hr:02d}:00"
                    peak_end = f"{end_hr:02d}:00"
            else:
                peak_rate = float(tar.get("peak_rate_zar", 1.5))
                if tar.get("peak_start_time"):
                    peak_start = str(tar["peak_start_time"])[:5]
                if tar.get("peak_end_time"):
                    peak_end = str(tar["peak_end_time"])[:5]

        peak_kwh_saved = kw_reduced * 0.5 # assume 50% of the peak reduction is achievable for 1 hour
        # Assume peak occurs half the weekdays (approx 10 days a month)
        rate = 10
        rate_differential = max(0, peak_rate - standard_rate)
        monthly_savings = (rate_differential * peak_kwh_saved) * rate


        context = "Peak Shaving"
        if self._is_duplicate(building_id, context):
            return None

        outside_temp = self._fetch_outside_temperature()
        comfort_score = self._calculate_comfort_score(kw_reduced, forecast_peak, outside_temp)

        strategy = (
            f"Aggregate sensors forecast a peak load of {round(forecast_peak, 2)}kW, exceeding your threshold by {round((peak_base_ratio - 1) * 100, 1)}%. "
            f"To shift load away from peak tariff hours ({peak_start} - {peak_end}), investigate likely drivers such as {equipment}. "
            f"Note: This aggressive load reduction may drop the building's thermal comfort score to {comfort_score}/100."
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
                "target_equipment": equipment,
                "confidence_score": 0.85,
                "context": context,
                "predicted_comfort_score": comfort_score,
                "tradeoff_inputs": {
                    "outside_temp_c": round(outside_temp, 1)
                }
            },
            "generated_date": datetime.now(timezone.utc).isoformat(),
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
            "estimated_monthly_savings": 100.0,
            "status": "Pending",
            "recommendation_category": "data",
            "applicable_range": {
                "target_equipment": equipment,
                "context": context,
                "anomaly_id": anomaly.get("anomaly_id")
            },
            "generated_date": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        }

    def _is_seasonal_duplicate(self, building_id: str, equipment: str) -> bool:
        if not self.supabase:
            return False
        try:
            season_start = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
            resp = self.supabase.table("optimisation_recommendations").select("applicable_range") \
            .eq("building_id", building_id) \
            .eq("recommendation_category", "non_data") \
            .gte("generated_date", season_start) \
            .execute()
            
            if resp.data:
                #only max of 3 recoomendations allowed to avoid spamming the user
                if len(resp.data) >= 3:
                    return True
                for item in resp.data:
                    rng = item.get("applicable_range") or {}
                    if rng.get("target_equipment") == equipment:
                        return True
            return False
        except Exception as error:
            logger.warning("Failed season check for %s: %s", building_id, error)
            return False

    def _calculate_season_optimisation(self, building_id, building_type, context):
        equipment = self.get_probable_equipment(building_type)
        if self._is_seasonal_duplicate(building_id, equipment):
            return None
        if context == "Winter Optimisation":
            strategy = f"Winter tariffs are active. Shift non-essential heavy loads (like {equipment}) to off-peak hours to avoid seasonal peak surcharges."
            savings = 250.0
        elif context == "Summer Lighting":
            strategy= "Sunset is occurring later. Adjust outdoor lighting and communal area timer schedules to match daylight hours."
            savings = 75.0
        elif context == "Winter Heating":
            strategy = f"Winter temperatures increase aggregate load. Ensure climate control and heating systems (such as {equipment}) are on strict timers to prevent overnight idling."
            savings = 150.0
        elif context == "Spring HVAC Optimisation":
            strategy = f"Spring weather can be variable. Optimise HVAC systems (such as {equipment}) by relying more on fresh air ventilation to reduce baseload."
            savings = 125.0
        elif context == "Autumn Lighting":
            strategy = f"Days are getting shorter in autumn. Adjust outdoor lighting and communal area timer schedules to match daylight hours efficiently."
            savings = 75.0
        else:
            strategy = f"General seasonal optimisation for {context}. Monitor usage on {equipment}."
            savings = 50.0

        comfort_score = self._calculate_comfort_score(0.0, 1.0)
        return {
            "building_id": building_id,
            "strategy_description": strategy,
            "estimated_monthly_savings": savings,
            "status": "Pending",
            "recommendation_category": "non_data",
            "applicable_range": {
                "target_equipment": equipment,
                "context": context,
                "predicted_comfort_score": comfort_score
            },
            "generated_date": datetime.now(timezone.utc).isoformat(),
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

    def _fetch_outside_temperature(self) -> float:
        try:
            #default is jhb, SA
            lat= -26.2041
            long = 28.0473
            #im using free whther api to pull whether
            url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={long}&current=temperature_2m"

            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                return float(data.get("current", {}).get("temperature_2m", NEUTRAL_TEMP_C))
            return NEUTRAL_TEMP_C
        except Exception as e:
            logger.warning("Failed to fetch weather for comfort score: %s", e)
            return NEUTRAL_TEMP_C

    def _calculate_comfort_score(self, kw_reduced: float, forecast_peak: float, outside_temp: Optional[float] = None) -> int:
        shed_share = 0.0
        if forecast_peak > 0:
            shed_share = max(0.0, min(1.0, kw_reduced / forecast_peak))
        if shed_share <= 0.0:
            return 100

        if outside_temp is None:
            outside_temp = self._fetch_outside_temperature()

        weather_stress = 1.0 + WEATHER_AMPLIFIER * abs(outside_temp - NEUTRAL_TEMP_C)
        penalty = min(MAX_COMFORT_PENALTY, SHED_PENALTY_SCALE * shed_share * weather_stress)
        comfort_score = math.floor(100.0 - penalty + 0.5)

        return max(0, min(100, comfort_score))

    def get_season(self, dt: datetime, seasons: List[Dict[str, Any]]) -> str:
        if not seasons:
            return None
        month = dt.month
        for s in seasons:
            start = s.get("startMonth", 1)
            end = s.get("endMonth", 12)
            if start <= end:
                if start <= month <= end:
                    return s.get("name")
            else:
                if month >= start or month <= end:
                    return s.get("name")
        return seasons[0].get("name") if seasons else None

    def get_tou_period(self, dt: datetime, schedule: Dict[str, Any]) -> str:
        if not schedule:
            return "Flat"
        hour = dt.hour
        day = dt.weekday()
        if day == 6:
            periods = schedule.get("sunday", [])
        elif day == 5:
            periods = schedule.get("saturday", [])
        else:
            periods = schedule.get("weekday", [])
        
        for p in periods:
            if p.get("startHour", 0) <= hour < p.get("endHour", 24):
                return p.get("period", "Flat")
        return "Flat"

    def get_current_rate(self, dt: datetime, tariff_structure: Dict[str, Any], peak_only: bool = False) -> float:
        if not tariff_structure:
            return 1.5
        
        season = self.get_season(dt, tariff_structure.get("seasons", []))
        tou = "Peak" if peak_only else self.get_tou_period(dt, tariff_structure.get("tou_schedule", {}))
        
        blocks = tariff_structure.get("blocks", [])
        if not blocks:
            return 1.5
            
        rate = blocks[0].get("rates", {}).get(season, {}).get(tou, 1.5)
        return float(rate)

    def generate_prepaid_purchase_advice(self, building_id: str, cumulative_kwh: float, tariffs: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not tariffs:
            return None
            
        tar = tariffs[0]
        tariff_structure = tar.get("tariff_structure", {})
        if not tariff_structure:
            return None
        
        #we only send recs at end of month amd to those who have inclining block rate
        blocks = tariff_structure.get("blocks", [])
        if len(blocks) <= 1:
            return None
            
        now = datetime.now(timezone.utc)
        if now.day < 20:
            return None
            
        current_block = 0
        for i, block in enumerate(blocks):
            max_kwh = block.get("max_kwh")
            if max_kwh is None or cumulative_kwh <= max_kwh:
                current_block = i
                break
                
        if current_block > 0:
            season = self.get_season(now, tariff_structure.get("seasons", []))
            base_rate = blocks[0].get("rates", {}).get(season, {}).get("Flat", blocks[0].get("rates", {}).get(season, {}).get("Standard", 0))
            expensive_rate = blocks[current_block].get("rates", {}).get(season, {}).get("Flat", blocks[current_block].get("rates", {}).get(season, {}).get("Standard", 0))
            
            savings_per_unit = max(0, float(expensive_rate) - float(base_rate))
            if savings_per_unit <= 0:
                return None
                
            strategy = (
                f"You have used {round(cumulative_kwh, 1)} kWh this month and are currently purchasing electricity at a high block rate (approx R{expensive_rate:.2f}/kWh). "
                f"Since we are near the end of the month, delay large prepaid electricity purchases until the 1st of next month to buy at the cheaper Block 1 rate (approx R{base_rate:.2f}/kWh)."
            )
            
            context = "Prepaid Purchase Advice"
            if self._is_duplicate(building_id, context):
                return None
                
            return {
                "building_id": building_id,
                "strategy_description": strategy,
                "estimated_monthly_savings": round(savings_per_unit * 100, 2),
                "status": "Pending",
                "recommendation_category": "finance",
                "applicable_range": {
                    "time_window":{
                        "start": "00:00",
                        "end": "23:59",
                        "timezone": "Africa/Johannesburg"
                    },
                    "equipment": "Prepaid Meter"
                },
                "context": context
            }
        return None
