# Ingestion Service

Telemetry ingestion service for OptiGrid.

## Endpoints

- `GET /health`
- `POST /readings`

## Local Run

```bash
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```
