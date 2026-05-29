#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/barun/Documents/home-security-non-docker/opencv-service')

from rtsp_ingestion import RTSPService, load_camera_config
import os
import json

# Load camera config
config_path = os.environ.get('CAMERAS_CONFIG_PATH', '/app/cameras.json')
print(f"Loading camera config from: {config_path}")

# Try to load from the actual location
actual_config_path = '/home/barun/Documents/home-security-non-docker/server/cameras.json'
if os.path.exists(actual_config_path):
    config_path = actual_config_path
    print(f"Using actual config path: {config_path}")

try:
    cameras = load_camera_config(config_path)
    print(f"Loaded {len(cameras)} cameras")
    if cameras:
        print(f"First camera: {cameras[0]}")
    
    # Start RTSP service
    print("Starting RTSP service...")
    service = RTSPService(cameras)
    service.start_non_blocking()
    print("RTSP service started in background")
    
    # Give it a moment to start
    import time
    time.sleep(2)
    
    # Check status
    status = service.get_status()
    print(f"Service status: {status}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()