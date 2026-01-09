import React from 'react';
import DetectionGallery from '@/components/detection/DetectionGallery';

const MotionEvents = () => {
  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Motion Events</h1>
          <p className="text-sm text-muted-foreground">
            Review detected motion events from all cameras
          </p>
        </div>
      </div>

      <DetectionGallery />
    </div>
  );
};

export default MotionEvents;