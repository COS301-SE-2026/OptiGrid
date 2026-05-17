FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libatomic1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# FIXED: Removed 'backend/ingestion/' prefix since Docker build context is now inside this folder
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# FIXED: Removed prefix so it copies the local src folder straight to /app/src
COPY src ./src

# Note: Removed 'RUN prisma generate' as this is a Python service. 
# Databases/Prisma are already successfully handled by your core-api container!

CMD ["python", "-m", "src.main"]