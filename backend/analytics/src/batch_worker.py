import time
import schedule
import logging
from supabase import create_client, Client
from .config import SUPABASE_URL, SUPABASE_KEY
from .core_engine import AnalyticsEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
engine = AnalyticsEngine()

#getting all the building ids in the database
def get_active_building():
    response = supabase.table("Building").select("building_id").execute
    return [record["building_id"] for record in response.data]

#run analytics engine for each building periodically (in this case hourly)
def run_analytics_batch():
    logger.info("Starting Analytics Batch Job")
    buildings = get_active_building()
    for b_id in buildings:
        try:
            engine.process_building(b_id)
        except:
            logger.error(f"Failed to process analytics for building {b_id}: {str(e)}")
    logger.info("Batch Job Complete")

schedule.every().hour.at(":00").do(run_analytics_batch)
