FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libatomic1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

COPY backend/analytics/requirements.txt ./backend/analytics/requirements.txt
RUN pip install --no-cache-dir -r backend/analytics/requirements.txt

COPY backend/analytics/src ./backend/analytics/src

CMD ["python", "-m", "backend.analytics.src.main"]
