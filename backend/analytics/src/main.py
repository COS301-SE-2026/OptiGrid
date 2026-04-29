from fastapi import FastAPI

app = FastAPI(title="OptiGrid Analytics Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "analytics"}
