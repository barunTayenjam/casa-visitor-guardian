# OpenCV Python Service Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (updated for Debian trixie)
RUN apt-get update && apt-get install -y --no-install-recommends \
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

# Start Flask development server
CMD ["python", "app.py"]