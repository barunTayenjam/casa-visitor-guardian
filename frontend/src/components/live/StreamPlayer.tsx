import React from 'react';
import { Play, AlertTriangle } from 'lucide-react';
import { CameraStreamSkeleton } from '@/components/ui/LoadingSkeleton';
import { cn } from '@/lib/utils';
import { Camera } from '@/types/security';

export type StreamConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'reconnecting';

interface StreamPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  isWanStream: boolean;
  isMuted: boolean;
  connectionState: StreamConnectionState;
  camera: Camera;
  error: string | null;
  onStart: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLVideoElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLVideoElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLVideoElement>) => void;
}

export const StreamPlayer: React.FC<StreamPlayerProps> = ({
  videoRef,
  canvasRef,
  isStreaming,
  isWanStream,
  isMuted,
  connectionState,
  camera,
  error,
  onStart,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) => {
  if (camera.status === 'offline' && !isStreaming) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-500 text-sm font-medium">Camera Offline</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className={cn(
          'h-full w-full object-contain z-0 select-none touch-pan-y bg-black',
          (!isStreaming || isWanStream) && 'hidden',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onStalled={() => {
          console.warn(`[CameraStream:${camera.name}] Video stalled`);
          if (error === undefined) return; // keep hook-shape stable; ref reset handled by parent via key prop
        }}
        onWaiting={() => {
          console.log(`[CameraStream:${camera.name}] Video waiting for data`);
          // Don't restart immediately on waiting, as it might just be a brief buffer
        }}
      />

      <canvas
        ref={canvasRef}
        className={cn(
          'h-full w-full object-contain z-0 select-none bg-black',
          (!isStreaming || !isWanStream) && 'hidden',
        )}
      />

      {(connectionState === 'connecting' || connectionState === 'reconnecting') && (
        <div className="absolute inset-0 z-0">
          <CameraStreamSkeleton />
        </div>
      )}

      {!isStreaming && connectionState === 'idle' && (
        <div
          className="absolute inset-0 z-0 h-full flex items-center justify-center cursor-pointer"
          onClick={onStart}
        >
          <div className="relative z-10 text-center">
            <Play className="h-12 w-12 text-white/80 hover:text-white transition-colors mx-auto mb-2" />
            <p className="text-white/60 text-sm">Click to Start Stream</p>
          </div>
        </div>
      )}
    </>
  );
};
