from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="OptiGrid Ingestion Service")


class Reading(BaseModel):
    buildingId: str
    meterId: str
    timestamp: str
    value: float
    unit: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ingestion"}


@app.post("/readings")
def ingest_reading(reading: Reading) -> dict[str, object]:
    return {
        "status": "accepted",
        "message": "Reading received",
        "reading": reading.model_dump(),
    }
