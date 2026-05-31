import React, { useState } from 'react';
import { Camera, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Camera as CameraType } from '@/types/security';
import { useToast } from '@/hooks/use-toast';

interface ScreenshotButtonProps {
  camera: CameraType;
  imgRef?: React.RefObject<HTMLImageElement>;
  videoRef?: React.RefObject<HTMLVideoElement>;
  className?: string;
}

export const ScreenshotButton: React.FC<ScreenshotButtonProps> = ({
  camera,
  imgRef,
  videoRef,
  className,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const { toast } = useToast();

  const handleScreenshot = async () => {
    const mediaEl = videoRef?.current || imgRef?.current;
    if (!mediaEl || isCapturing) return;

    setIsCapturing(true);

    try {
      const canvas = document.createElement('canvas');
      const isVideo = 'videoWidth' in mediaEl;
      canvas.width = isVideo ? (mediaEl as HTMLVideoElement).videoWidth : (mediaEl as HTMLImageElement).naturalWidth;
      canvas.height = isVideo ? (mediaEl as HTMLVideoElement).videoHeight : (mediaEl as HTMLImageElement).naturalHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      ctx.drawImage(mediaEl, 0, 0);

      const timestamp = new Date().toLocaleString();
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      const text = `${camera.name} - ${timestamp}`;
      ctx.strokeText(text, 10, canvas.height - 10);
      ctx.fillText(text, 10, canvas.height - 10);

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
    } catch (err) {
      console.error('Screenshot failed:', err);
      toast({
        title: 'Screenshot Failed',
        description: err instanceof Error ? err.message : 'Failed to capture screenshot',
        variant: 'destructive',
        duration: 3000,
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const hasMedia = !!(videoRef?.current || imgRef?.current);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={handleScreenshot}
      disabled={isCapturing || !hasMedia}
      title="Take Screenshot"
      aria-label="Take screenshot"
    >
      {isCapturing ? (
        <Download className="h-5 w-5 animate-pulse" />
      ) : (
        <Camera className="h-5 w-5" />
      )}
    </Button>
  );
};
