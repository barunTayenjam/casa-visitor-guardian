import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollText, RefreshCw, Pause, Play } from 'lucide-react';
import { apiClient } from '@/services/api/baseClient';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  timestamp: string;
  service: string;
  level: string;
  module?: string | null;
  cameraId?: string | null;
  message: string;
}

type LevelFilter = 'all' | 'warn' | 'error';
type ServiceFilter = 'all' | 'backend' | 'opencv';

const AUTO_REFRESH_MS = 10000;

const levelStyles: Record<string, string> = {
  error: 'bg-red-500/15 text-red-400 border-red-500/25',
  warn: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  info: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

const FilterChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]',
      active
        ? 'bg-primary/20 border-primary/40 text-primary'
        : 'bg-white/[0.04] border-white/[0.10] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]',
    )}
  >
    {children}
  </button>
);

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<LevelFilter>('all');
  const [service, setService] = useState<ServiceFilter>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const visibleRef = useRef(!document.hidden);

  const loadLogs = useCallback(async () => {
    try {
      const params: Record<string, string> = { limit: '200' };
      if (level !== 'all') params.level = level;
      if (service !== 'all') params.service = service;
      const res = await apiClient.get<{ logs: LogEntry[] }>('/system/logs', params);
      setLogs(res.logs ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [level, service]);

  useEffect(() => {
    setLoading(true);
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const tick = () => {
      if (visibleRef.current) loadLogs();
    };
    const interval = setInterval(tick, AUTO_REFRESH_MS);
    const onVisibility = () => {
      visibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autoRefresh, loadLogs]);

  return (
    <div className="w-full min-h-[100dvh] flex flex-col">
      <div className="px-5 pt-6 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.12] text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground mb-3">
            Diagnostics
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">System Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Warnings and errors from backend and OpenCV, retained 14 days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-8"
            onClick={() => setAutoRefresh((v) => !v)}
            title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
          >
            {autoRefresh ? <Pause className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => loadLogs()}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="px-5 pb-3 flex flex-wrap items-center gap-2">
        <FilterChip active={level === 'all'} onClick={() => setLevel('all')}>
          All levels
        </FilterChip>
        <FilterChip active={level === 'warn'} onClick={() => setLevel('warn')}>
          Warnings
        </FilterChip>
        <FilterChip active={level === 'error'} onClick={() => setLevel('error')}>
          Errors
        </FilterChip>
        <div className="w-px h-5 bg-white/[0.10] mx-1" />
        <FilterChip active={service === 'all'} onClick={() => setService('all')}>
          All services
        </FilterChip>
        <FilterChip active={service === 'backend'} onClick={() => setService('backend')}>
          Backend
        </FilterChip>
        <FilterChip active={service === 'opencv'} onClick={() => setService('opencv')}>
          OpenCV
        </FilterChip>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-28">
        <div className="bezel-lg">
          <div className="bezel-lg-inner">
            {loading && logs.length === 0 ? (
              <div className="p-4 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="h-3 w-36 bg-white/[0.08] rounded-full shrink-0" />
                    <div className="h-5 w-14 bg-white/[0.08] rounded-full shrink-0" />
                    <div className="h-3 flex-1 bg-white/[0.06] rounded-full" />
                  </div>
                ))}
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="No log entries"
                description="Nothing matching these filters. Warnings and errors appear here as they happen."
                className="py-20"
              />
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {logs.map((log, index) => (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4 px-4 py-2.5 hover:bg-white/[0.03] transition-colors"
                    style={{
                      animation: `fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both`,
                      animationDelay: `${Math.min(index * 30, 360)}ms`,
                    }}
                  >
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums whitespace-nowrap sm:pt-0.5 shrink-0">
                      {formatTime(log.timestamp)}
                    </span>
                    <span
                      className={cn(
                        'inline-flex w-fit items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider shrink-0',
                        levelStyles[log.level] ?? levelStyles.info,
                      )}
                    >
                      {log.level}
                    </span>
                    <span className="text-[11px] text-muted-foreground/80 whitespace-nowrap sm:pt-0.5 shrink-0 hidden md:inline">
                      {log.service}
                      {log.module ? ` · ${log.module}` : ''}
                    </span>
                    <p className="text-sm text-foreground/90 break-words min-w-0">
                      {log.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
