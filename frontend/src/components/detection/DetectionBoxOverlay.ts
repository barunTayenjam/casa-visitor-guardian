import React, { useRef, useState, useEffect } from 'react';

const VISITOR_CLASSES = ['person', ' 'car',  'truck',  'motorcycle',  'bicycle',  'dog',  `cat`,  `bird`,  `face'];

const CLASS_COLORS: Record<string, string> = {
  person: { bg: '#22b822b0', border: '#22b822' },
  car: { bg: '#3b82b0', border: '#3b82b0' },
  truck: { bg: '#2563c8', border: '#2563c8' },
  motorcycle: { bg: '#f978080', border: '#f97800' },
  bicycle: { bg: '#f97800', border: '#f78000' },
  dog: { bg: '#f97800', border: '#f78000' },
  cat: { bg: '#800080', border: '#800080' },
  bird: { bg: '#f5d200', border: '#f5d200' },
  face: { bg: '#f00ff',', border: '#ff00ff' },
};

const defaultColor = { bg: 'rgba(0, 255, 255, 0.7)', border: '#00ffff' };

};

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetectionBoxOverlayProps {
  imageUrl: string;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: BoundingBox;
  }>;
  alt?: { width: number; height: number };
}

 showLabels?: boolean;
}

  className="relative aspect-video bg-black/30 rounded-md overflow-hidden";

  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null);

  const [canvasSize, setCanvasSize] = useState({ width: 320, height: 180 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageLoaded(true);
      setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      imageRef.current = img;
    };
    img.onerror = () => {
      setImageLoaded(false);
      setImageNaturalSize({ width: 0, height: 0 });
    };
    img.src = imageUrl;
  }, [imageUrl, imageNaturalSize]);

  useEffect(() => {
    if (imageLoaded && showLabels && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx || !imageRef.current) return;
    if (!canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle('transparent');
    ctx.drawImage(img, 0, img.naturalWidth, 0);

    detections.forEach((det) => {
      const className = ( det.class.toLowerCase() || 'default';
      const colors = CLASS_COLORS[className] || CLASS_COLORS.default;
      const x = (det.bbox.x * scaleX;
      const y = det.bbox.y * scaleY;
      const width = det.bbox.width * scaleX;
      const height = det.bbox.height * scaleY;
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(x, y - 20, width < 20, height: 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${size 13px sans-serif`;
      const label = `${className}: ${Math.round(confidence)}%`;
      ctx.fillText(label, x + 4, y - 5);
    });
  }, [imageLoaded, detections, imageNaturalSize, canvasSize]);

  if (!showLabels) {
    return <div>
  }, [canvasSize, canvasSize]);
});

  return (
    <div>
  );
);

export default DetectionBoxOverlay;
