import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCameras } from '@/contexts/CameraContext';
import {
  Film,
  ChevronLeft,
  ChevronRight,
  Wand2,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Film as FilmIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageLoading } from '@/components/ui/PageLoading';
import { useToast } from '@/hooks/use-toast';
import { systemService } from '@/services/api/systemService';
import { cn } from '@/lib/utils';

type CamStatus = 'idle' | 'queued' | 'generating' | 'done' | 'error';

interface CamState {
  status: CamStatus;
  message?: string;
  exists: boolean;
}

const todayStr = () => new Date().toISOString().split('T')[0];

const TimelapsePage: React.FC = () => {
  const { cameras } = useCameras();
  const [date, setDate] = useState(todayStr());
  const [list, setList] = useState<{ cameraId: string; path: string }[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [camStates, setCamStates] = useState<Record<string, CamState>>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const isPast = date < todayStr();
  const isPastRef = useRef(isPast);
  isPastRef.current = isPast;

  useEffect(() => {
    setLoading(true);
    setActive(null);
    setList([]);
    setCamStates({});
    setSelected(new Set());
    const past = isPastRef.current;
    systemService
      .getTimelapses(date)
      .then((res) => {
        if (res.success) {
          setList(res.timelapses);
          if (res.timelapses.length > 0) setActive(res.timelapses[0].cameraId);
          const existingIds = new Set(res.timelapses.map((t) => t.cameraId));
          const next: Record<string, CamState> = {};
          const nextSelected = new Set<string>();
          for (const cam of cameras) {
            const exists = existingIds.has(cam.id);
            next[cam.id] = { status: 'idle', exists };
            if (!exists && past) nextSelected.add(cam.id);
          }
          setCamStates(next);
          setSelected(nextSelected);
          if (past && res.timelapses.length < cameras.length) setPanelOpen(true);
        }
      })
      .finally(() => setLoading(false));
  }, [date, cameras]);

  const getCameraName = (cameraId: string) =>
    cameras.find((c) => c.id === cameraId)?.name || `Camera ${cameraId}`;

  const changeDate = (days: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const next = d.toISOString().split('T')[0];
    if (next > todayStr()) return;
    setDate(next);
  };

  const toggleSelected = (camId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(camId)) next.delete(camId);
      else next.add(camId);
      return next;
    });
  };

  const generatingCount = useMemo(
    () =>
      Object.values(camStates).filter((s) => s.status === 'generating' || s.status === 'queued')
        .length,
    [camStates],
  );
  const busy = generatingCount > 0;

  const runGenerate = async (camId: string) => {
    setCamStates((p) => ({
      ...p,
      [camId]: { ...p[camId], status: 'generating', message: undefined },
    }));
    try {
      const res = await systemService.generateTimelapse(camId, date);
      setCamStates((p) => ({
        ...p,
        [camId]: { status: 'done', exists: true, message: res.message },
      }));
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setCamStates((p) => ({ ...p, [camId]: { ...p[camId], status: 'error', message: msg } }));
      throw err;
    }
  };

  const handleGenerateSelected = async () => {
    const targets = Array.from(selected);
    if (targets.length === 0) return;
    for (const camId of targets) {
      setCamStates((p) => ({ ...p, [camId]: { ...p[camId], status: 'queued' } }));
    }
    let ok = 0;
    let failed = 0;
    for (const camId of targets) {
      try {
        await runGenerate(camId);
        ok++;
      } catch {
        failed++;
      }
    }
    const fresh = await systemService.getTimelapses(date);
    if (fresh.success) {
      setList(fresh.timelapses);
      if (!active && fresh.timelapses.length > 0) setActive(fresh.timelapses[0].cameraId);
    }
    if (failed === 0) {
      toast({
        title: `Backfilled ${ok} camera${ok === 1 ? '' : 's'}`,
        description: `Timelapse ready for ${date}`,
      });
    } else {
      toast({
        title: `Backfill finished with ${failed} failure${failed === 1 ? '' : 's'}`,
        description: `${ok} succeeded`,
        variant: 'destructive',
      });
    }
    setSelected(new Set());
  };

  const handleGenerateSingle = async (camId: string) => {
    try {
      await runGenerate(camId);
      const fresh = await systemService.getTimelapses(date);
      if (fresh.success) {
        setList(fresh.timelapses);
        setActive(camId);
      }
      toast({ title: 'Timelapse ready', description: getCameraName(camId) });
    } catch (err) {
      toast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <PageLoading message="Loading Timelapses..." />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        <PageHeader
          title="Daily Timelapse"
          subtitle={date}
          icon={Film}
          backTo="/app/streams"
          size="large"
          actions={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => e.target.value <= todayStr() && setDate(e.target.value)}
                className="bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
              />
              <Button onClick={() => changeDate(-1)} variant="outline" size="sm">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </Button>
              <Button
                onClick={() => changeDate(1)}
                variant="outline"
                size="sm"
                disabled={date >= todayStr()}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          }
        />

        {isPast && (
          <div className="bezel">
            <div className="bezel-inner">
              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <Wand2 className="w-4 h-4 text-primary" />
                  <div>
                    <div className="text-sm font-medium">Backfill for {date}</div>
                    <div className="text-xs text-muted-foreground">
                      Stitches captured frames (or detection snapshots as fallback) into a 2-minute
                      MP4 per camera.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {generatingCount > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {generatingCount} running
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {panelOpen ? 'Hide' : 'Show'}
                  </span>
                </div>
              </button>

              {panelOpen && (
                <div className="border-t border-border/50 p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {cameras.map((cam) => {
                      const st = camStates[cam.id] ?? {
                        status: 'idle' as CamStatus,
                        exists: false,
                      };
                      const checked = selected.has(cam.id);
                      const disabled = st.status === 'generating' || st.status === 'queued';
                      return (
                        <label
                          key={cam.id}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors',
                            checked
                              ? 'border-primary/60 bg-primary/5'
                              : 'border-border hover:bg-white/[0.02]',
                            disabled && 'opacity-60 cursor-not-allowed',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleSelected(cam.id)}
                            className="mt-0.5 accent-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium truncate">
                                {getCameraName(cam.id)}
                              </span>
                              <StatusBadge state={st} />
                            </div>
                            {st.message && (
                              <div
                                className={cn(
                                  'text-xs mt-1 break-words',
                                  st.status === 'error'
                                    ? 'text-destructive'
                                    : 'text-muted-foreground',
                                )}
                              >
                                {st.message}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const next = new Set<string>();
                          for (const cam of cameras) {
                            if (!camStates[cam.id]?.exists) next.add(cam.id);
                          }
                          setSelected(next);
                        }}
                      >
                        Select missing
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(new Set(cameras.map((c) => c.id)))}
                      >
                        Select all
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                        Clear
                      </Button>
                      <span>{selected.size} selected</span>
                    </div>
                    <Button
                      onClick={handleGenerateSelected}
                      disabled={selected.size === 0 || busy}
                      size="sm"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Generating…
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3 h-3 mr-1" />
                          Generate {selected.size > 0 ? `(${selected.size})` : ''}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {list.length === 0 ? (
          <div className="bezel">
            <div className="bezel-inner p-10 text-center">
              <FilmIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-base font-medium mb-1">
                {isPast ? 'No timelapse for this date yet' : 'Live capture in progress'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {isPast
                  ? 'Use the Backfill panel above to generate from captured frames or detection snapshots.'
                  : "Today's frames are being sampled every 30s. The timelapse will be stitched automatically at 00:01."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              {list.map((t) => {
                const st = camStates[t.cameraId];
                return (
                  <Button
                    key={t.cameraId}
                    onClick={() => setActive(t.cameraId)}
                    variant={t.cameraId === active ? 'default' : 'outline'}
                    size="sm"
                  >
                    <Film className="w-3 h-3 mr-1" />
                    {getCameraName(t.cameraId)}
                    {st?.status === 'done' && (
                      <CheckCircle2 className="w-3 h-3 ml-1 text-emerald-400" />
                    )}
                  </Button>
                );
              })}
            </div>
            <div className="bezel">
              <div className="bezel-inner overflow-hidden">
                <div className="relative aspect-video bg-black">
                  {(() => {
                    const src = list.find((t) => t.cameraId === active)?.path;
                    if (!src) {
                      return (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          Select a camera
                        </div>
                      );
                    }
                    return (
                      <video
                        ref={videoRef}
                        key={src}
                        src={src}
                        controls
                        autoPlay
                        loop
                        className="w-full h-full object-contain"
                      />
                    );
                  })()}
                </div>
                <div className="p-4 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-muted-foreground">
                    {active && list.find((t) => t.cameraId === active) ? (
                      <>
                        2-minute timelapse for{' '}
                        <span className="text-foreground font-medium">{getCameraName(active)}</span>{' '}
                        on {date}.
                      </>
                    ) : (
                      '2-minute timelapse of the full day at 24 fps.'
                    )}
                  </p>
                  {active && isPast && (
                    <Button
                      onClick={() => handleGenerateSingle(active)}
                      disabled={busy}
                      variant="ghost"
                      size="sm"
                    >
                      <Wand2 className="w-3 h-3 mr-1" />
                      Regenerate
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ state: CamState }> = ({ state }) => {
  if (state.status === 'generating') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Generating
      </Badge>
    );
  }
  if (state.status === 'queued') {
    return <Badge variant="secondary">Queued</Badge>;
  }
  if (state.status === 'done') {
    return (
      <Badge className="gap-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
        <Check className="w-3 h-3" />
        Ready
      </Badge>
    );
  }
  if (state.status === 'error') {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="w-3 h-3" />
        Failed
      </Badge>
    );
  }
  if (state.exists) {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-300">
        <CheckCircle2 className="w-3 h-3" />
        Exists
      </Badge>
    );
  }
  return <Badge variant="outline">Missing</Badge>;
};

export default TimelapsePage;
