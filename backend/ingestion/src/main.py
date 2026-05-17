from fastapi import FastAPI, HTTPException
import redis
import json
import os

app = FastAPI()
r = redis.Redis(host=os.getenv("REDIS_HOST", "optigrid-redis"), port=6379, db=0, decode_responses=True)

@app.post("/ingest")
def ingest_entry(data: dict):
    #data arrives as raw dictionary from csv reader
    try:
        r.lpush("ingestion_queue", json.dumps(data))
        return {"status": "success", "message": "Data buffered"}
    except Exception as e:
        print("Ingestion Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
