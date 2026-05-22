FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libatomic1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

COPY backend/ingestion/requirements.txt ./backend/ingestion/requirements.txt
RUN pip install --no-cache-dir -r backend/ingestion/requirements.txt

COPY backend/ingestion/src ./backend/ingestion/src

CMD ["python", "-m", "backend.ingestion.src.worker"]
