#!/bin/sh
set -e

# Bridge baked-in weights into the bind-mounted /app on first boot.
# /app is mounted from the host at runtime, hiding the image's /app content;
# ultralytics resolves the CLIP text encoder relative to the working dir
# (/app/weights), so copy it out of /opt once and let the host persist it.
if [ -f /opt/weights/clip/ViT-B-32.pt ] && [ ! -f /app/weights/clip/ViT-B-32.pt ]; then
    echo "[entrypoint] seeding /app/weights/clip from image (first boot)"
    mkdir -p /app/weights/clip
    cp /opt/weights/clip/ViT-B-32.pt /app/weights/clip/ViT-B-32.pt
fi

exec "$@"
