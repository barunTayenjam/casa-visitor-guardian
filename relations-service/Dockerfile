FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ gcc git libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8085

CMD ["python", "-u", "-m", "flask", "--app", "app", "run", "--host", "0.0.0.0", "--port", "8085"]
