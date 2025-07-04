import { useState } from 'react';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCameras } from '@/contexts/CameraContext';
import { useEvents } from '@/contexts/EventsContext';
import { useSocketContext } from '@/contexts/SocketContext';

export const DebugInfo = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { cameras, loading: camerasLoading, error: camerasError } = useCameras();
  const { events } = useEvents();
  const { connected, connectionStatus } = useSocketContext();

  if (!import.meta.env.DEV) {
    return null; // Only show in development
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-80">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Debug Info
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        {isOpen && (
          <CardContent className="text-xs space-y-2">
            <div>
              <strong>Socket:</strong>
              <Badge variant={connected ? "default" : "destructive"} className="ml-2">
                {connectionStatus}
              </Badge>
            </div>
            <div>
              <strong>Cameras:</strong>
              <Badge variant={camerasLoading ? "secondary" : "default"} className="ml-2">
                {camerasLoading ? 'Loading' : `${cameras.length} loaded`}
              </Badge>
            </div>
            {camerasError && (
              <div>
                <strong>Camera Error:</strong>
                <div className="text-red-500 text-xs mt-1">{camerasError}</div>
              </div>
            )}
            <div>
              <strong>Events:</strong>
              <Badge variant="outline" className="ml-2">
                {events.length} events
              </Badge>
            </div>
            <div>
              <strong>Environment:</strong>
              <Badge variant="outline" className="ml-2">
                {import.meta.env.MODE}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              API: {import.meta.env.DEV ? '/api (proxy)' : import.meta.env.VITE_API_URL}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default DebugInfo;