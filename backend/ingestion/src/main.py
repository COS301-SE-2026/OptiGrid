from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
import redis
import json
from datetime import datetime, timezone
from backend.ingestion.src.config import *

app = FastAPI(title="OptiGrid Ingestion API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

r = redis.Redis(
    host=REDIS_HOST, 
    port=REDIS_PORT, 
    db=REDIS_DB, 
    decode_responses=True,
    socket_connect_timeout=5
)

class TelemetryPoint(BaseModel):
    building_id: str = Field(..., description="Unique UUID for core layout targeting mapping")
    sensor_id: str = Field(..., description="Unique identifier for telemetry device node source")
    meter_id: str = Field(..., description="Identifier for specific target measurement group metric")
    kwh: float = Field(..., description="Calculated metric scalar reading data value")
    timestamp: Optional[str] = Field(None, description="ISO-8601 string timezone aware tracking format")

    @field_validator("timestamp", mode="before")
    @classmethod
    def ensure_timestamp(cls, value: Optional[str]) -> str:
        return value if value else datetime.now(timezone.utc).isoformat()

class BatchTelemetryPayload(BaseModel):
    points: List[TelemetryPoint]

class BuildingInitPayload(BaseModel):
    building_id: str
    
@app.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    try:
        r.ping()
        redis_status = "connected"
    except Exception as e:
        redis_status = f"error: {str(e)}"
    
    return {
        "status": "ok",
        "service": "ingestion-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "redis": redis_status
    }

@app.get("/")
def root():
    return {
        "service": "OptiGrid Ingestion API",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

#endpoint to receives data from core-api
@app.post("/ingest")
def ingest_entry(data: dict):
    #pushes incoming data to redis queue (left push)
    #worker will pick it up from right side (brpop)
    try:
        r.lpush("ingestion_queue", json.dumps(data))
        return {"status": "success", "message": "Data buffered"}
    except Exception as e:
        print("Ingestion Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/init-building", status_code=200)
def init_building(payload: BuildingInitPayload):
    """Registers building mappings into local metadata structures to guard against transactional data drift."""
    try:
        building_config = {
            "building_id": payload.building_id,
            "initialized_at": datetime.now(timezone.utc).isoformat(),
            "status": "active"
        }
        r.hset(f"building:{payload.building_id}", mapping=building_config)
        print(f"[Ingestion Service] Initialized tracking matrix context for: {payload.building_id}")
        return {
            "status": "success", 
            "message": "Ingestion pipeline initialized", 
            "building_id": payload.building_id,
            "initialized_at": building_config["initialized_at"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to provision ingestion parameters: {str(e)}"
        )
