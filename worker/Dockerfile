FROM python:3.12-slim

WORKDIR /app

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    libcups2-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml /backend/pyproject.toml
COPY backend/app /backend/app
RUN pip install --no-cache-dir -e /backend

COPY worker/pyproject.toml ./
COPY worker/worker ./worker
RUN pip install --no-cache-dir -e .

CMD ["python", "-m", "worker.main"]
