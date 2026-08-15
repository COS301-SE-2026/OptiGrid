import os
import time
import logging
import asyncio
from bullmq import Worker
from backend.analytics.src.core_engine import AnalyticsEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
BULLMQ_QUEUE_NAME = "analytics-refresh"

engine = AnalyticsEngine()

#we need job_token param because BUllmq will throw error if we dont have it
async def process_job(job, job_token):
    try: 
        building_id = job.data.get("building_id")
        if not building_id:
            logger.error("Invalid or no building_id given in job data")
            return

        if hasattr(engine, "process_building"):
            engine.process_building(building_id)
        else:
            logger.error("Core_engine.py doesnt have the fucntion or spelt incorrectly")
    except Exception as error:
        logger.error(f"Error processing job: {error}")
        raise error

async def main():
    redis_opts = {
        "host": REDIS_HOST,
        "port": REDIS_PORT
    }

    worker = Worker(
        BULLMQ_QUEUE_NAME,
        process_job,
        {
            "connection": redis_opts
        }
    )
    #ensure worker runs every hour
    while True:
        await asyncio.sleep(3600)

if __name__ == "__main__":
    asyncio.run(main())