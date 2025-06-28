import React, { useEffect, useState } from 'react';
import socketService from '@/services/SocketService';

const SocketTest = () => {
  const [connected, setConnected] = useState(false);
  const [frames, setFrames] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `${timestamp}: ${message}`]);
    console.log(message);
  };

  useEffect(() => {
    addLog('Starting socket test...');
    
    // Connect to socket
    socketService.connect().then(() => {
      addLog('Socket connected successfully');
      setConnected(true);
      
      // Request streams for both cameras
      addLog('Requesting stream for cam1');
      socketService.requestStream('cam1');
      addLog('Requesting stream for cam2');
      socketService.requestStream('cam2');
    }).catch(err => {
      addLog(`Socket connection failed: ${err.message}`);
    });

    // Listen for frames
    const frameHandler = (data: { cameraId: string; data: string; timestamp: string }) => {
      addLog(`Received frame from ${data.cameraId}, size: ${data.data.length}`);
      setFrames(prev => [...prev.slice(-10), `${data.cameraId}: ${data.timestamp}`]);
    };

    const unsubscribe = socketService.on('frame', frameHandler);

    return () => {
      unsubscribe();
      socketService.disconnect();
    };
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Socket Connection Test</h1>
      
      <div className="mb-4">
        <p>Connection Status: <span className={connected ? 'text-green-600' : 'text-red-600'}>
          {connected ? 'Connected' : 'Disconnected'}
        </span></p>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Recent Frames:</h2>
        <div className="bg-gray-100 p-2 rounded max-h-32 overflow-y-auto">
          {frames.length === 0 ? (
            <p className="text-gray-500">No frames received yet...</p>
          ) : (
            frames.map((frame, index) => (
              <div key={index} className="text-sm">{frame}</div>
            ))
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Logs:</h2>
        <div className="bg-black text-green-400 p-2 rounded max-h-64 overflow-y-auto font-mono text-sm">
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SocketTest;