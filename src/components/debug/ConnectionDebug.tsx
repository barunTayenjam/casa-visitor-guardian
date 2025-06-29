import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import socketService from '@/services/SocketService';
import apiService from '@/services/ApiService';
import { useCameras } from '@/contexts/CameraContext';

export const ConnectionDebug: React.FC = () => {
  const [socketConnected, setSocketConnected] = useState(false);
  const [apiStatus, setApiStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [logs, setLogs] = useState<string[]>([]);
  const { cameras, loading, error, refreshCameras } = useCameras();

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 9)]);
    console.log(message);
  };

  useEffect(() => {
    // Check socket connection status
    const checkSocketStatus = () => {
      setSocketConnected(socketService.isConnected());
    };

    // Check API status
    const checkApiStatus = async () => {
      try {
        await apiService.getCameras();
        setApiStatus('connected');
        addLog('API connection successful');
      } catch (err) {
        setApiStatus('error');
        addLog(`API connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    checkSocketStatus();
    checkApiStatus();

    // Set up interval to check status
    const interval = setInterval(() => {
      checkSocketStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const testSocketConnection = async () => {
    try {
      addLog('Testing socket connection...');
      await socketService.connect();
      addLog('Socket connection successful');
    } catch (err) {
      addLog(`Socket connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const testCameraStreams = () => {
    addLog('Testing camera streams...');
    cameras.forEach(camera => {
      addLog(`Requesting stream for ${camera.id} (${camera.name})`);
      socketService.requestStream(camera.id);
    });
  };

  const testBackendHealth = async () => {
    try {
      addLog('Testing backend health...');
      const response = await fetch('/api/health');
      const data = await response.json();
      addLog(`Backend health: ${data.status}, active cameras: ${data.activeCameras}`);
    } catch (err) {
      addLog(`Backend health check failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const testProxyConnection = async () => {
    try {
      addLog('Testing proxy connection to backend...');
      const response = await fetch('/api/health');
      const data = await response.json();
      addLog(`Proxy connection successful: ${data.status}`);
    } catch (err) {
      addLog(`Proxy connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const restartConnection = async () => {
    try {
      addLog('Restarting connection...');
      
      // Disconnect socket
      socketService.disconnect();
      addLog('Socket disconnected');
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reconnect
      await socketService.connect();
      addLog('Socket reconnected');
      
      // Refresh cameras
      await refreshCameras();
      addLog('Cameras refreshed');
      
    } catch (err) {
      addLog(`Restart failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <Card className="p-4 mb-4">
      <h3 className="text-lg font-semibold mb-4">Connection Debug Panel</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="font-medium mb-2">Socket Status</h4>
          <Badge variant={socketConnected ? 'default' : 'destructive'}>
            {socketConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
        
        <div>
          <h4 className="font-medium mb-2">API Status</h4>
          <Badge variant={
            apiStatus === 'connected' ? 'default' : 
            apiStatus === 'error' ? 'destructive' : 'secondary'
          }>
            {apiStatus === 'connected' ? 'Connected' : 
             apiStatus === 'error' ? 'Error' : 'Unknown'}
          </Badge>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-medium mb-2">Cameras ({cameras.length})</h4>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <div className="space-y-1">
            {cameras.map(camera => (
              <div key={camera.id} className="flex items-center gap-2 text-sm">
                <Badge variant={camera.status === 'online' ? 'default' : 'secondary'}>
                  {camera.id}
                </Badge>
                <span>{camera.name}</span>
                <span className="text-muted-foreground">({camera.status})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Button size="sm" onClick={testSocketConnection}>
          Test Socket
        </Button>
        <Button size="sm" onClick={testCameraStreams} disabled={cameras.length === 0}>
          Test Streams
        </Button>
        <Button size="sm" onClick={testBackendHealth}>
          Test Backend
        </Button>
        <Button size="sm" onClick={testProxyConnection}>
          Proxy Test
        </Button>
        <Button size="sm" onClick={restartConnection} variant="outline">
          Restart
        </Button>
      </div>

      <div>
        <h4 className="font-medium mb-2">Debug Logs</h4>
        <div className="bg-black text-green-400 p-2 rounded text-xs font-mono max-h-32 overflow-y-auto">
          {logs.length === 0 ? (
            <p>No logs yet...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
};