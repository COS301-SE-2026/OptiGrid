from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
import redis
import json
import os
from backend.ingestion.src.config import *

load_dotenv()

app = FastAPI()
#connect to Redis
r = redis.Redis(host=os.getenv("REDIS_HOST", "optigrid-redis"), port=6379, db=0, decode_responses=True)

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
