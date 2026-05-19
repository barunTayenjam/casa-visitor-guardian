#!/bin/sh
FAIL_COUNT=0
MAX_FAILS=5
while true; do
  if ! curl -sf http://localhost:9753/api/health > /dev/null 2>&1; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "[health-monitor] Health check failed ($FAIL_COUNT/$MAX_FAILS)"
    if [ "$FAIL_COUNT" -ge "$MAX_FAILS" ]; then
      echo "[health-monitor] Health check failed $MAX_FAILS times consecutively. Killing tsx process..."
      pkill -f "tsx" 2>/dev/null
      exit 1
    fi
  else
    FAIL_COUNT=0
  fi
  sleep 15
done
