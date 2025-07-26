import { TabletEventViewer } from '@/components/dashboard/TabletEventViewer';
import { useEvents } from '@/contexts/EventsContext';
import { Card } from '@/components/ui/card';
import { EventsDataDebug } from '@/components/debug/EventsDataDebug';
import { useDebug } from '@/contexts/DebugContext';

const MotionEvents = () => {
  const { events, loading, error } = useEvents();
  const { debugEnabled } = useDebug();
  
  if (debugEnabled) {
    console.log('MotionEvents rendering:', { events: events.length, loading, error });
  }
  
  // Fallback rendering for debugging
  if (error) {
    return (
      <div className="h-full p-6">
        <Card className="p-6">
          <h2 className="text-xl font-bold text-red-600 mb-4">Events Error</h2>
          <p>{error}</p>
        </Card>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="h-full p-6">
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Loading Events...</h2>
          <p>Please wait while we load your events.</p>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="h-full p-4">
      <div className="bg-green-50 text-green-800 p-4 rounded">
        Events Page - {events.length} events loaded
      </div>
    </div>
  );
};

export default MotionEvents;
