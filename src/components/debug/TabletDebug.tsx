import { useEvents } from '@/contexts/EventsContext';
import { useCameras } from '@/contexts/CameraContext';
import { useLocation } from 'react-router-dom';

export const TabletDebug = () => {
  const { events, loading, error } = useEvents();
  const { cameras } = useCameras();
  const location = useLocation();

  return (
    <div className="fixed top-0 right-0 bg-black/80 text-white p-4 text-xs z-50 max-w-xs">
      <h3 className="font-bold mb-2">Debug Info</h3>
      <div>Route: {location.pathname}</div>
      <div>Events: {events.length}</div>
      <div>Loading: {loading ? 'Yes' : 'No'}</div>
      <div>Error: {error || 'None'}</div>
      <div>Cameras: {cameras.length}</div>
      <div className="mt-2">
        <div>Events List:</div>
        {events.slice(0, 3).map(event => (
          <div key={event.id} className="text-xs">
            - {event.cameraName} ({event.timestamp.toLocaleTimeString()})
          </div>
        ))}
      </div>
    </div>
  );
};