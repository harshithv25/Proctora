# Proctora AI Live Proctoring Microservice Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5001

WORKDIR /app

# Install system dependencies for OpenCV and image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency definition and install
COPY requirements-render.txt .
RUN pip install --no-cache-dir -r requirements-render.txt

# Copy microservice application files and model weights
COPY . .

EXPOSE 5001

# Run Uvicorn server bound to 0.0.0.0 on dynamically assigned Render port
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-5001}"]
