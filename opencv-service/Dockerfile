# OpenCV Python Service Dockerfile (Development Mode)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (updated for Debian trixie)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    cmake \
    g++ \
    make \
    libgl1-mesa-dri \
    libglx-mesa0 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8084

# Start Flask development server with debug and auto-reload
CMD ["python", "-u", "-m", "flask", "--app", "app", "run", "--host", "0.0.0.0", "--port", "8084", "--debug", "--reload"]