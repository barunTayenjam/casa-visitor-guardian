# OpenCV Python Service Dockerfile (Development Mode)
FROM python:3.11-slim

WORKDIR /app

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    libgl1-mesa-dri \
    libglx-mesa0 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download ArcFace model for faster startup
RUN python3 -c "import insightface; insightface.model_zoo.get_model('buffalo_s', download=True, download_zip=True)" 2>/dev/null || echo "Model will download at first inference"

# Copy source code
COPY . .

# Expose ports
EXPOSE 8084
EXPOSE 9090

# Start Flask development server with debug and auto-reload
CMD ["python", "-u", "-m", "flask", "--app", "app", "run", "--host", "0.0.0.0", "--port", "8084", "--debug", "--reload"]