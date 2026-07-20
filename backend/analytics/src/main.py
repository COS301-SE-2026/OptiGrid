import logging
import time
import threading
import schedule
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from backend.analytics.src.core_engine import AnalyticsEngine
from backend.analytics.src.batch_worker import run_analytics_batch

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AnalyticsMain")

app = FastAPI(title="OptiGrid Analytics API", version="1.0.0")
engine_instance = AnalyticsEngine()


class BuildingInitPayLoad(BaseModel):
    building_id: str


@app.get("/health")
def health_check():
    return {"status": "success", "service": "analytics-api-worker"}


@app.post("/init-building")
def init_building(payload: BuildingInitPayLoad):
    # receive lifecycle synchronoisation commands from the core api transaction proxy
    try:
        success = engine_instance.register_new_building(payload.building_id)
        if not success:
            raise HTTPException(status_code=500, detail="Analytics database provider skipped the row execution.")
        return {
            "status": "success",
            "message": "Analytics database layout allocated",
            "building_id": payload.building_id
        }
    except Exception as e:
        logger.error(f"Failed to register asset footprint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Engine error during provisioning: {str(e)}")


def run_scheduler():
    logger.info("Background analytics scheduler started")
    schedule.every().hour.at(":00").do(run_analytics_batch)
    # running initial background pass on startup
    try:
        run_analytics_batch()
    except Exception as e:
        logger.error(f"Initial worker batch run failed: {str(e)}")
    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    import uvicorn
    logger.info("Analytics worker booting...")
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    uvicorn.run(app, host="0.0.0.0", port=5001)
