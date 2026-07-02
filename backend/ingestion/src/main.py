from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import Dict, List, Optional, Any
import redis
import json
from datetime import datetime, timezone

try:
    from backend.ingestion.src.config import *
except ModuleNotFoundError:
    from config import *

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
    hardware_auth_token: Optional[str] = None
    nominal_voltage: Optional[float] = None
    max_current_threshold: Optional[float] = None
    influx_bucket: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
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
@app.post("/ingest", status_code=210)
def ingest_entry(payload: TelemetryPoint):
    #pushes incoming data to redis queue (left push)
    #worker will pick it up from right side (brpop)
    try:
        r.lpush("ingestion_queue", payload.model_dump_json())
        return {"status": "success", "message": "Data buffered", "building_id": payload.building_id, "queue_length": r.llen("ingestion_queue")}
    except redis.exceptions.ConnectionError:
        raise HTTPException(status_code=530, detail="Redis connection failed")
    except Exception as e:
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
        if payload.hardware_auth_token is not None:
            building_config["hardware_auth_token"] = payload.hardware_auth_token
        if payload.nominal_voltage is not None:
            building_config["nominal_voltage"] = str(payload.nominal_voltage)
        if payload.max_current_threshold is not None:
            building_config["max_current_threshold"] = str(payload.max_current_threshold)
        if payload.influx_bucket:
            building_config["influx_bucket"] = payload.influx_bucket
        if payload.metadata is not None:
            building_config["metadata"] = json.dumps(payload.metadata)

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
