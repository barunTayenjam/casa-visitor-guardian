#!/bin/bash
set -e

pkill -f "opencv.*app\.py" || true
pkill -f "ffmpeg -loglevel error -rtsp_transport tcp" || true

cd opencv-service
nohup .venv/bin/python app.py > opencv.log 2>&1 &
echo $! > opencv.pid

sleep 5

if grep -q "Listening on ws://0.0.0.0:9090" opencv.log; then
    echo "WebSocket publisher started"
else
    echo "WebSocket publisher not found in log"
    cat opencv.log
    exit 1
fi

# Test WebSocket connection
.venv/bin/python3 -c "
import asyncio
import websockets
async def test():
    try:
        async with websockets.connect('ws://localhost:9090') as ws:
            print('Connected')
            await ws.close()
    except Exception as e:
        print(f'Failed: {e}')
        exit(1)
"
python3 -c "import asyncio; asyncio.run(test())"

# Kill the background process
kill $(cat opencv.pid) 2>/dev/null || true
rm opencv.pid

echo "Test passed"
