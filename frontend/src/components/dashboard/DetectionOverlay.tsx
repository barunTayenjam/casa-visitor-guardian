import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Detection } from '@/types/security';

interface DetectionOverlayProps {
  cameraId: string;
  currentFrame: string | null;
  showDetections: boolean;
  detections: Detection[];
  detectionResolution?: { width: number; height: number };
  displayResolution?: { width: number; height: number };
}

const CLASS_COLORS: Record<string, { bg: string; border: string }> = {
  person: { bg: 'rgba(0, 255, 0, 0.7)', border: '#00ff00' },
  car: { bg: 'rgba(0, 0, 255, 0.7)', border: '#0000ff' },
  truck: { bg: 'rgba(0, 0, 200, 0.7)', border: '#0000c8' },
  motorcycle: { bg: 'rgba(255, 165, 0, 0.7)', border: '#ffa500' },
  bicycle: { bg: 'rgba(255, 165, 0, 0.7)', border: '#ffa500' },
  dog: { bg: 'rgba(255, 165, 0, 0.7)', border: '#ffa500' },
  cat: { bg: 'rgba(128, 0, 128, 0.7)', border: '#800080' },
  face: { bg: 'rgba(255, 0, 255, 0.7)', border: '#ff00ff' },
  default: { bg: 'rgba(0, 255, 255, 0.7)', border: '#00ffff' },
};

export const DetectionOverlay: React.FC<DetectionOverlayProps> = ({
  cameraId,
  currentFrame,
  showDetections,
  detections,
  detectionResolution,
  displayResolution,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 360 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setCanvasSize({ width: clientWidth, height: clientHeight });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (!currentFrame || !canvasRef.current) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageLoaded(true);
      imageRef.current = img;
      drawDetections();
    };
    img.onerror = () => {
      console.error('Failed to load image for detection overlay');
      setImageLoaded(false);
    };
    img.src = currentFrame;
  }, [currentFrame]);

  useEffect(() => {
    if (imageLoaded && detections.length > 0) {
      drawDetections();
    }
  }, [detections, imageLoaded]);

  const drawDetections = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate proper scaling
    // Detection coordinates are in detectionResolution (e.g., 640x360)
    // We need to scale them to match the displayed image size
    const detectWidth = detectionResolution?.width || 640;
    const detectHeight = detectionResolution?.height || 360;
    
    // Scale factor from detection resolution to displayed image resolution
    const scaleX = img.width / detectWidth;
    const scaleY = img.height / detectHeight;

    detections.forEach((detection) => {
      const bbox = detection.bbox;
      const className = detection.class?.toLowerCase() || 'default';
      const colors = CLASS_COLORS[className] || CLASS_COLORS.default;

      const x = bbox.x * scaleX;
      const y = bbox.y * scaleY;
      const width = bbox.width * scaleX;
      const height = bbox.height * scaleY;

      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = colors.bg;
      ctx.fillRect(x, y - 20, width < 100 ? 100 : width, 20);

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      const label = `${className}: ${(detection.confidence || 0).toFixed(0)}%`;
      ctx.fillText(label, x + 4, y - 5);
    });
  }, [detections, imageLoaded, detectionResolution]);

  if (!showDetections || !currentFrame) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{
          width: '100%',
          height: '100%',
          opacity: detections.length > 0 ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />
      {detections.length > 0 && (
        <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
          {detections.length} object{detections.length !== 1 ? 's' : ''} detected
        </div>
      )}
    </div>
  );
};

export default DetectionOverlay;
