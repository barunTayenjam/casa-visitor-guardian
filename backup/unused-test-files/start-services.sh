#!/bin/bash

# Start the backend server
echo "Starting backend server..."
npm start --prefix server &

# Start the OpenCV service
echo "Starting OpenCV service..."
npm start --prefix opencv-service &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
