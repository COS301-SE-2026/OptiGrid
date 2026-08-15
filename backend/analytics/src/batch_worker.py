import time
import schedule
import logging
import json
import os
import asyncio
from typing import Optional
from bullmq import Queue
from backend.analytics.src.core_engine import AnalyticsEngine

#configuring logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine: Optional[AnalyticsEngine] = None
#this func uses built in bullmq queue to handle the jobs
#also handels generation of UUIDs,redis hash maps and connection poolings(goated stuff)
async def enqueue_jobs(buildings):
    redis_opts = {
        "host": os.getenv("REDIS_HOST", "localhost"),
        "port": int(os.getenv("REDIS_PORT", 6379))
    }
    
    queue = Queue("analytics-refresh", {"connection": redis_opts})
    for building in buildings:
        await queue.add("refresh_building", {"building_id": building})
        
    await queue.close()

#run analytics engine for each building periodically (in this case hourly)
def run_analytics_batch():
    global engine
    logger.info("Starting Analytics Batch Job")
    try:
        if engine is None:
            engine = AnalyticsEngine()     
        active_buildings = engine.get_active_building_ids()
        #run the enqueue job func insetead of prev precoess_all_building func
        asyncio.run(enqueue_jobs(active_buildings))                 
    except Exception as e:
        logger.error(f"Failed to process analytics batch: {str(e)}")
        logger.exception(f"Failed to process analytics batch: {str(e)}")
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
