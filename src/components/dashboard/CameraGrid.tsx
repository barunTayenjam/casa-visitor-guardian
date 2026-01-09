import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera } from '@/types/security';
import apiService from '@/services/ApiService';
import { useSocketContext } from '@/contexts/SocketContext';

interface CameraGridProps {
  compact?: boolean;
  singleView?: boolean;
}

export const CameraGrid = ({ compact = false, singleView = false }: CameraGridProps) => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const { socket: socketService, connected: isConnected } = useSocketContext();

  // Fetch cameras
  const fetchCameras = useCallback(async () => {
    try {
      setError(null);
      const cameraData = await apiService.getCameras();
      setCameras(cameraData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch cameras';
      setError(errorMessage);
      console.error('CameraGrid: Failed to fetch cameras:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle camera stream control
  const handleStreamToggle = async (cameraId: string, isActive: boolean) => {
    try {
      if (isActive) {
        await apiService.startCameraStream(cameraId);
      } else {
        await apiService.stopCameraStream(cameraId);
      }
      // Refresh cameras to update status
      await fetchCameras();
    } catch (err) {
      console.error(`Failed to ${isActive ? 'start' : 'stop'} stream for camera ${cameraId}:`, err);
    }
  };

  // Handle snapshot
  const handleSnapshot = async (cameraId: string) => {
    try {
      await apiService.takeSnapshot(cameraId);
    } catch (err) {
      console.error(`Failed to take snapshot for camera ${cameraId}:`, err);
    }
  };

  // Get stream URL for camera
  const getStreamUrl = (cameraId: string) => {
    // Use the snapshot endpoint for MJPEG streaming
    return `/stream/${cameraId}`;
  };

  // Get snapshot URL for camera thumbnail
  const getSnapshotUrl = (cameraId: string) => {
    return `/snapshot/${cameraId}.jpg`;
  };

  // Handle camera selection
  const handleCameraClick = (cameraId: string) => {
    setSelectedCamera(selectedCamera === cameraId ? null : cameraId);
  };

  // Setup WebSocket listeners for real-time updates
  useEffect(() => {
    if (!socketService) return;

    const handleCameraStatus = (data: any) => {
      setCameras(prev => prev.map(camera => 
        camera.id === data.cameraId 
          ? { ...camera, status: data.status as 'online' | 'offline' | 'warning' }
          : camera
      ));
    };

    const handleFrame = (data: any) => {
      // Frames are handled by individual camera components
      // This can be used for global frame processing if needed
    };

    const handleCameraError = (data: any) => {
      setCameras(prev => prev.map(camera => 
        camera.id === data.cameraId 
          ? { ...camera, error: data.error, status: 'warning' as const }
          : camera
      ));
    };

    socketService.on('camera-status', handleCameraStatus);
    socketService.on('frame', handleFrame);
    socketService.on('camera-error', handleCameraError);

    return () => {
      socketService.off('camera-status', handleCameraStatus);
      socketService.off('frame', handleFrame);
      socketService.off('camera-error', handleCameraError);
    };
  }, [socketService]);

  // Initial fetch and periodic updates
  useEffect(() => {
    fetchCameras();

    // Refresh camera status every 30 seconds
    const interval = setInterval(fetchCameras, 30000);
    return () => clearInterval(interval);
  }, [fetchCameras]);

  // Request streams for cameras when they come online
  useEffect(() => {
    if (socketService && isConnected) {
      cameras.forEach(camera => {
        if (camera.status === 'online') {
          socketService.requestStream(camera.id);
        }
      });
    }
  }, [socketService, isConnected, cameras]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading cameras...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center text-white">
          <h2 className="text-xl mb-4 text-red-400">Error Loading Cameras</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchCameras}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="text-center text-white">
          <h2 className="text-xl mb-4">No Cameras Configured</h2>
          <p className="text-gray-400">Add cameras to start monitoring.</p>
        </div>
      </div>
    );
  }

  // Single camera view
  if (singleView && cameras.length > 0) {
    const camera = cameras[0];
    return <CameraFeed key={camera.id} camera={camera} />;
  }

  // Grid layout
  const gridCols = cameras.length === 1 ? 'grid-cols-1' : 
                   cameras.length === 2 ? 'grid-cols-2' : 
                   cameras.length === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <div className={`h-full w-full bg-black p-2 ${compact ? 'p-1' : 'p-2'}`}>
      <div className={`grid ${gridCols} gap-2 h-full`}>
        {cameras.map((camera) => (
          <CameraFeed 
            key={camera.id} 
            camera={camera}
            compact={compact}
            onStreamToggle={handleStreamToggle}
            onSnapshot={handleSnapshot}
            onClick={() => handleCameraClick(camera.id)}
            isSelected={selectedCamera === camera.id}
          />
        ))}
      </div>
    </div>
  );
};

// Individual camera feed component
interface CameraFeedProps {
  camera: Camera;
  compact?: boolean;
  onStreamToggle?: (cameraId: string, isActive: boolean) => void;
  onSnapshot?: (cameraId: string) => void;
  onClick?: () => void;
  isSelected?: boolean;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ 
  camera, 
  compact = false, 
  onStreamToggle, 
  onSnapshot,
  onClick,
  isSelected = false
}) => {
  const [imageError, setImageError] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset image error when camera status changes
  useEffect(() => {
    if (camera.status === 'online') {
      setImageError(false);
    }
  }, [camera.status]);

  const handleImageError = () => {
    setImageError(true);
  };

  const getStreamUrl = () => {
    return `/stream/${camera.id}`;
  };

  const getSnapshotUrl = () => {
    return `/snapshot/${camera.id}.jpg`;
  };

  const getStatusColor = () => {
    switch (camera.status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (camera.status) {
      case 'online': return 'Live';
      case 'offline': return 'Offline';
      case 'warning': return 'Warning';
      default: return 'Unknown';
    }
  };

  return (
    <div 
      className={`relative bg-gray-900 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
        compact ? 'aspect-video' : 'aspect-video'
      } ${isSelected ? 'ring-2 ring-blue-500' : ''} ${
        showControls ? 'ring-2 ring-white' : ''
      }`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onClick={onClick}
    >
      {/* Camera stream or snapshot */}
      <div className="relative w-full h-full">
        {camera.status === 'online' && !imageError ? (
          <img
            ref={imgRef}
            src={getStreamUrl()}
            alt={camera.name}
            className="w-full h-full object-cover"
            onError={handleImageError}
            // Add key to force re-render when stream starts/stops
            key={`${camera.id}-${camera.status}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <img
              src={getSnapshotUrl()}
              alt={camera.name}
              className="max-w-full max-h-full object-contain"
              onError={handleImageError}
            />
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="text-4xl mb-2">📹</div>
                  <p className="text-sm">No Signal</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status indicator */}
        <div className="absolute top-2 left-2 flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`}></div>
          <span className="text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">
            {getStatusText()}
          </span>
        </div>

        {/* Camera name and info */}
        <div className="absolute bottom-2 left-2 right-2">
          <div className="bg-black bg-opacity-70 text-white p-2 rounded">
            <h3 className="text-sm font-semibold truncate">{camera.name}</h3>
            {!compact && (
              <div className="text-xs text-gray-300">
                <p>{camera.resolution} • {camera.fps}fps</p>
                {camera.location && <p>{camera.location}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Controls overlay */}
        {showControls && onStreamToggle && (
          <div className="absolute top-2 right-2 flex flex-col space-y-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStreamToggle(camera.id, camera.status !== 'online');
              }}
              className={`p-2 rounded-full bg-black bg-opacity-70 text-white hover:bg-opacity-90 transition-colors ${
                camera.status === 'online' ? 'text-red-400' : 'text-green-400'
              }`}
              title={camera.status === 'online' ? 'Stop Stream' : 'Start Stream'}
            >
              {camera.status === 'online' ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <rect x="6" y="6" width="8" height="8" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                </svg>
              )}
            </button>
            
            {onSnapshot && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSnapshot(camera.id);
                }}
                className="p-2 rounded-full bg-black bg-opacity-70 text-white hover:bg-opacity-90 transition-colors"
                title="Take Snapshot"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Error indicator */}
        {camera.error && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs p-2 rounded max-w-xs">
            <p className="truncate">{camera.error}</p>
          </div>
        )}
      </div>
    </div>
  );
};