import React, { useRef, useState } from 'react';
import { Camera, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Camera as CameraType } from '@/types/security';
import { useToast } from '@/hooks/use-toast';

interface ScreenshotButtonProps {
  camera: CameraType;
  imgRef: React.RefObject<HTMLImageElement>;
  className?: string;
}

export const ScreenshotButton: React.FC<ScreenshotButtonProps> = ({
  camera,
  imgRef,
  className,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const { toast } = useToast();

  const handleScreenshot = async () => {
    if (!imgRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      // Create canvas from image
      const canvas = document.createElement('canvas');
      canvas.width = imgRef.current.naturalWidth;
      canvas.height = imgRef.current.naturalHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw image to canvas
      ctx.drawImage(imgRef.current, 0, 0);

      // Add timestamp watermark
      const timestamp = new Date().toLocaleString();
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      const text = `${camera.name} - ${timestamp}`;
      const textWidth = ctx.measureText(text).width;
      ctx.strokeText(text, 10, canvas.height - 10);
      ctx.fillText(text, 10, canvas.height - 10);

      // Convert to blob and download
      canvas.toBlob(async (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `sentryvision-${camera.id}-${Date.now()}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          toast({
            title: 'Screenshot Captured',
            description: `Saved from ${camera.name}`,
            duration: 2000,
          });
        }
      }, 'image/jpeg', 0.95);
    } catch (error) {
      console.error('Screenshot failed:', error);
      toast({
        title: 'Screenshot Failed',
        description: error instanceof Error ? error.message : 'Failed to capture screenshot',
        variant: 'destructive',
        duration: 3000,
      });
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={handleScreenshot}
      disabled={isCapturing || !imgRef.current}
      title="Take Screenshot"
    >
      {isCapturing ? (
        <Download className="h-4 w-4 animate-pulse" />
      ) : (
        <Camera className="h-4 w-4" />
      )}
    </Button>
  );
};
