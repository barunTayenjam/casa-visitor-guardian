FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ gcc git curl libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Bake model weights so fresh installs are self-contained (no first-use
# downloads). Everything lives under /opt because the compose bind mount of
# ./relations-service over /app shadows image content in /app at runtime.
# - relsgg relation model -> HF cache at /opt/hf-cache (HF_HOME)
# - YOLO-World detector   -> /opt/models
# - CLIP text encoder     -> /opt/weights (bridged into /app/weights by the
#   entrypoint on first boot, since ultralytics resolves it CWD-relative)
ENV HF_HOME=/opt/hf-cache
RUN mkdir -p /opt/models /opt/hf-cache /opt/weights \
    && curl -fsSL -o /opt/models/yolov8s-worldv2.pt \
       https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8s-worldv2.pt \
    && python -c "from relsgg import RelateAnything; RelateAnything.from_pretrained('maelic/relsgg-vits16plus', device='cpu')" \
    && cd /opt && python -c "from ultralytics import YOLOWorld; m = YOLOWorld('/opt/models/yolov8s-worldv2.pt'); m.set_classes(['person'])" \
    && cd /app

EXPOSE 8085

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["python", "-u", "-m", "flask", "--app", "app", "run", "--host", "0.0.0.0", "--port", "8085"]
