import logging
import time
import schedule
from backend.analytics.src.core_engine import AnalyticsEngine
from backend.analytics.src.batch_worker import run_analytics_batch

logger = logging.getLogger("AnalyticsMain")

def run_override():
    logger.warning("Manual override trigger detected: Starting global analytics refresh")
    engine = AnalyticsEngine()
    try:
        #runs instantly using the new batch logic
        engine.process_all_buildings() 
        logger.info("Manual refresh complete")
    except Exception as e:
        logger.error(f"Error during manual override: {e}")

#entry point for script
if __name__ == "__main__":
    import sys
    #if run passed as CLI argument, trigger manuel refresh
    if len(sys.argv) > 1 and sys.argv[1] == "run":
        run_override()
    else:
        logger.info("Analytics worker booting in schedule mode")
        schedule.every.hour.at(":00").do(run_analytics_batch)
        #run initial pass on startup
        run_analytics_batch()
        
        while True:
            schedule.run_pending()
            time.sleep(30)