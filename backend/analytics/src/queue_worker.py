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

async def process_job(job, job_token):
    #will complete soon, need to make changes in core_engine.py
