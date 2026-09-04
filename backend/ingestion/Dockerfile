FROM python:3.11-slim@sha256:90744cff8f32887f075c47d747a173ff333e9e98801667af93c357fa9f5e28ff AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libatomic1 \
    ca-certificates \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY backend/ingestion/requirements.txt ./backend/ingestion/requirements.txt
RUN pip install --no-cache-dir -r backend/ingestion/requirements.txt

FROM python:3.11-slim@sha256:90744cff8f32887f075c47d747a173ff333e9e98801667af93c357fa9f5e28ff AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libatomic1 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m appuser
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

COPY backend/ingestion/src ./backend/ingestion/src
USER appuser

CMD ["python", "-m", "backend.ingestion.src.sensor_emulator"]