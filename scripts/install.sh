#!/usr/bin/env bash
set -euo pipefail

BOLD='\033[1m'; DIM='\033[2m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { printf "${GREEN}✔${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}⚠${NC} %s\n" "$*"; }
err()   { printf "${RED}✘${NC} %s\n" "$*"; exit 1; }
step()  { printf "\n${CYAN}${BOLD}▸ %s${NC}\n" "$*"; }

# ── Prerequisites ──────────────────────────────
step "Checking prerequisites"
command -v docker &>/dev/null || err "Docker not found. Install from: https://docs.docker.com/engine/install/"
command -v openssl &>/dev/null || err "openssl not found. Run: apt install openssl (Linux) or brew install openssl (Mac)"
command -v curl &>/dev/null || err "curl not found."

DC="docker compose"
docker compose version &>/dev/null || DC="docker-compose"

# ── Clone if needed ────────────────────────────
PROJECT_DIR="$HOME/sentryvision"
if [ -f "$PROJECT_DIR/docker-compose.yml" ]; then
  info "Found existing installation at $PROJECT_DIR"
elif git rev-parse --git-dir &>/dev/null 2>&1; then
  PROJECT_DIR="$(git rev-parse --show-toplevel)"
  info "Using repository at $PROJECT_DIR"
else
  step "Downloading SentryVision"
  git clone https://github.com/anomalyco/home-security-non-docker.git "$PROJECT_DIR"
  info "Downloaded to $PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# ── Generate secrets ───────────────────────────
step "Generating secure configuration"
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_ACCESS_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
CREDENTIAL_ENCRYPTION_KEY=$(openssl rand -hex 32)

cat > .env <<ENVEOF
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
CREDENTIAL_ENCRYPTION_KEY=${CREDENTIAL_ENCRYPTION_KEY}
LOW_RESOURCE_MODE=true
REDIS_DISABLED=true
CORS_ORIGIN=http://localhost:9753
SEED_ADMIN_PASSWORD=admin123
SEED_USER_PASSWORD=user123
DEFAULT_FPS=2
DEFAULT_RESOLUTION=640x360
ENVEOF

# ── Detect IPs for WebRTC ──────────────────────
LAN_IP=$(ip -4 addr show 2>/dev/null | grep -oP 'inet \K192\.168\.[0-9]+\.[0-9]+' | head -1 || \
         ip -4 addr show 2>/dev/null | grep -oP 'inet \K10\.[0-9]+\.[0-9]+\.[0-9]+' | head -1 || \
         ip -4 addr show 2>/dev/null | grep -oP 'inet \K172\.1[6-9]\.[0-9]+\.[0-9]+' | head -1 || \
         echo "")

# Write a minimal go2rtc.yaml with no cameras (user adds them via web UI later)
cat > go2rtc.yaml <<YAMLEOF
streams: {}

api:
  listen: ":1984"
  origin: "*"

webrtc:
  listen: ":8555"
  candidates:
    - ${LAN_IP:-127.0.0.1}:8555
    - stun:8555

log:
  level: "info"
  format: "text"
YAMLEOF

# Write empty cameras.json (user adds via web UI)
echo "[]" > server/cameras.json

# ── Create data folders ────────────────────────
step "Creating data folders"
mkdir -p data/detections data/events data/snapshots public/events \
  opencv-service/data opencv-service/models opencv-service/known_faces

# ── Download YOLO model ─────────────────────────
step "Downloading detection model (YOLOv8n)"
curl -sL -o opencv-service/models/yolov8n.onnx \
  "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.onnx" &
info "Downloading in background (continues while we build)"

# ── Build & start ──────────────────────────────
step "Building and starting services (first time = ~5 minutes)"
$DC up -d --build

# ── Wait for health ────────────────────────────
step "Waiting for services to start"
for svc in postgres backend opencv; do
  NAME="sentryvision-${svc}"
  printf "  ${NAME} "
  for i in $(seq 1 45); do
    if docker inspect "$NAME" --format '{{.State.Health.Status}}' 2>/dev/null | grep -q healthy; then
      printf "${GREEN}✓${NC}\n"; break
    fi
    printf "."; sleep 2
  done
done

# Wait for YOLO download to finish
wait

# ── Done ───────────────────────────────────────
step "SentryVision is running!"

echo ""
printf "  ${BOLD}Open your browser:${NC}\n"
LAN_URL=""
[ -n "$LAN_IP" ] && LAN_URL="http://${LAN_IP}:9753"
cat <<SUMMARY
  ┌─────────────────────────────────────────────────┐
  │  ${CYAN}${BOLD}http://localhost:9753${NC}                        │
  ${LAN_URL:+ │  ${CYAN}${BOLD}$LAN_URL${NC}               │}
  │                                                 │
  │  ${BOLD}Login:${NC}  admin / admin123                       │
  │                                                 │
  │  After logging in, add your cameras from the    │
  │  Settings page — no need to edit config files.  │
  │                                                 │
  │  ${YELLOW}Change the admin password on first login!${NC}      │
  └─────────────────────────────────────────────────┘
SUMMARY

echo ""
$DC ps

echo ""
info "Run '$DC logs -f' to see live logs"
info "Run 'bash scripts/install.sh' again to update SentryVision"
