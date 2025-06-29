// Simple test script to verify backend connection
const fetch = require('node-fetch');
const { io } = require('socket.io-client');

async function testConnection() {
  console.log('Testing backend connection...');
  
  // Test HTTP API
  try {
    console.log('1. Testing HTTP API...');
    const response = await fetch('http://localhost:9753/api/health');
    const data = await response.json();
    console.log('✅ HTTP API working:', data);
  } catch (error) {
    console.log('❌ HTTP API failed:', error.message);
  }
  
  // Test Socket.IO
  try {
    console.log('2. Testing Socket.IO...');
    const socket = io('http://localhost:9753', {
      transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
      console.log('✅ Socket.IO connected');
      
      // Test camera stream request
      socket.emit('requestStream', 'cam1');
      console.log('📡 Requested stream for cam1');
      
      setTimeout(() => {
        socket.disconnect();
        console.log('🔌 Disconnected');
        process.exit(0);
      }, 2000);
    });
    
    socket.on('connect_error', (error) => {
      console.log('❌ Socket.IO connection failed:', error.message);
      process.exit(1);
    });
    
    socket.on('streamRequested', (data) => {
      console.log('✅ Stream request confirmed:', data);
    });
    
    socket.on('frame', (data) => {
      console.log('📺 Received frame for camera:', data.cameraId);
    });
    
  } catch (error) {
    console.log('❌ Socket.IO test failed:', error.message);
  }
}

testConnection();