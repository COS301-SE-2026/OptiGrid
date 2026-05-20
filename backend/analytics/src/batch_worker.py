import time
import schedule
import logging
from supabase import create_client, Client
from backend.analytics.src.config import SUPABASE_URL, SUPABASE_KEY
from backend.analytics.src.core_engine import AnalyticsEngine
from datetime import datetime

#configuring logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine = AnalyticsEngine()

#run analytics engine for each building periodically (in this case hourly)
def run_analytics_batch():
    logger.info("Starting Analytics Batch Job")
    try:
        #process all buildings, fetches data, calcs metrics, stores it
        engine.process_all_buildings()
    except Exception as e:
        logger.error(f"Failed to process analytics batch: {str(e)}")
    logger.info("Batch Job Complete")

#schedule the job to run at the start of each hour
schedule.every().hour.at(":00").do(run_analytics_batch)

#entry point when the script is run directly
if __name__ == "__main__":
    logger.info("Analytics Worker Booted")
    #run once immediately on startup
    run_analytics_batch()
    #keep script alive and checking clock
    while True:
        schedule.run_pending()
        time.sleep(30) #sleep to prevent CPU overuse while also leaving it responsive