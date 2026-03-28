import React, { useRef, useState, useEffect, useCallback } from 'react';

const CLASS_COLORS: Record<string, { bg: string; border: string }> = {
  person: { bg: 'rgba(0, 255, 0, 0.7)', border: '#00ff00' },
  car: { bg: 'rgba(0, 100, 255, 0.7)', border: '#0064ff' },
  truck: { bg: 'rgba(0, 50, 200, 0.7)', border: '#0032c8' },
  motorcycle: { bg: 'rgba(255, 165, 0, 0.7)', border: '#ffa500' },
  bicycle: { bg: 'rgba(255, 140, 0, 0.7)', border: '#ff8c00' },
  dog: { bg: 'rgba(255, 165, 0, 0.7)', border: '#ffa500' },
  cat: { bg: 'rgba(128, 0, 128, 0.7)', border: '#800080' },
  bird: { bg: 'rgba(255, 215, 0, 0.7)', border: '#ffd700' },
  face: { bg: 'rgba(255, 0, 255, 0.7)', border: '#ff00ff' },
};

const defaultColor = { bg: 'rgba(0, 255, 255, 0.7)', border: '#00ffff' };

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetectionItem {
  class?: string;
  confidence: number;
  bbox?: BoundingBox;
  boundingBox?: BoundingBox;
}

interface DetectionBoxOverlayProps {
  imageUrl: string;
  detections: DetectionItem[];
  showLabels?: boolean;
  className?: string;
}

const DetectionBoxOverlay: React.FC<DetectionBoxOverlayProps> = ({
  imageUrl,
  detections,
  showLabels = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 360 });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setCanvasSize({ width: clientWidth, height: clientHeight });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => setImageLoaded(false);
    img.src = imageUrl;
    return () => { imageRef.current = null; setImageLoaded(false); };
  }, [imageUrl]);

  const drawDetections = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = canvas.width / img.naturalWidth;
    const scaleY = canvas.height / img.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach((det) => {
      const box = det.bbox || det.boundingBox;
      if (!box) return;

      const className = (det.class || 'unknown').toLowerCase();
      const colors = CLASS_COLORS[className] || defaultColor;

      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const width = box.width * scaleX;
      const height = box.height * scaleY;

      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

      if (showLabels) {
        const conf = det.confidence >= 1 ? det.confidence : det.confidence * 100;
        const label = `${className}: ${Math.round(conf)}%`;
        const labelWidth = Math.max(width, 80);
        ctx.fillStyle = colors.bg;
        ctx.fillRect(x, y - 20, labelWidth, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px sans-serif';
        ctx.fillText(label, x + 4, y - 6);
      }
    });
  }, [detections, imageLoaded, showLabels, canvasSize]);

  useEffect(() => {
    if (imageLoaded && detections.length > 0) {
      drawDetections();
    }
  }, [imageLoaded, detections, drawDetections, canvasSize]);

  if (!detections || detections.length === 0) return null;

  return (
    <div ref={containerRef} className={`absolute inset-0 pointer-events-none ${className}`}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default DetectionBoxOverlay;
