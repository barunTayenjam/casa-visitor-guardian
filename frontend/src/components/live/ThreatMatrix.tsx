import { useEffect, useState } from 'react';
import { eventService } from '@/services/api/eventService';
import { cn } from '@/lib/utils';

interface ThreatCounts {
  persons: number;
  vehicles: number;
  animals: number;
  motion: number;
}

export const ThreatMatrix = () => {
  const [counts, setCounts] = useState<ThreatCounts>({ persons: 0, vehicles: 0, animals: 0, motion: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [personsRes, vehiclesRes] = await Promise.allSettled([
          eventService.getEnhancedEventsList({ event_type: 'person', pageSize: 1 }),
          eventService.getEnhancedEventsList({ event_type: 'vehicle', pageSize: 1 }),
        ]);

        const persons = personsRes.status === 'fulfilled' ? personsRes.value.pagination?.totalEvents || 0 : 0;
        const vehicles = vehiclesRes.status === 'fulfilled' ? vehiclesRes.value.pagination?.totalEvents || 0 : 0;

        setCounts({
          persons,
          vehicles,
          animals: 0,
          motion: 0,
        });
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const threats = [
    { label: 'PERSON', count: counts.persons, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { label: 'VEHICLE', count: counts.vehicles, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { label: 'ANIMAL', count: counts.animals, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
    { label: 'MOTION', count: counts.motion, color: 'text-muted-foreground', bg: 'bg-white/[0.06]', border: 'border-white/[0.10]' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.15em] font-medium text-muted-foreground">
          Threat Matrix
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          Last 24h
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {threats.map((threat) => (
          <div
            key={threat.label}
            className={cn(
              'rounded-lg border p-3 text-center',
              threat.bg,
              threat.border,
            )}
          >
            <div className={cn('text-2xl font-semibold tabular-nums', threat.color)}>
              {loading ? '--' : threat.count}
            </div>
            <div className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground mt-1">
              {threat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
