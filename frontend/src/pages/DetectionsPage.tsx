import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Crosshair, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import {
  fetchDetectionRows,
  fetchDetectionStats,
  detectionImageUrl,
  type DetectionRow,
  type DetectionStats,
} from '@/services/api/detectionDataService';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

type RangeFilter = '1h' | '24h' | '7d' | 'all';

const rangeToFrom: Record<RangeFilter, string | undefined> = {
  '1h': new Date(Date.now() - 3600_000).toISOString(),
  '24h': new Date(Date.now() - 24 * 3600_000).toISOString(),
  '7d': new Date(Date.now() - 7 * 24 * 3600_000).toISOString(),
  all: undefined,
};

const threatStyles: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/25',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  none: 'bg-white/[0.08] text-muted-foreground border-white/[0.10]',
};

const classStyles: Record<string, string> = {
  person: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  dog: 'bg-lime-500/15 text-lime-400 border-lime-500/25',
  cat: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
  car: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
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

const Chip = ({
  label,
  count,
  active,
  style,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  style?: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
      active
        ? style || 'bg-white/[0.06] text-foreground border-white/[0.16]'
        : 'bg-white/[0.04] text-muted-foreground border-transparent hover:bg-white/[0.06]',
    )}
  >
    {label}
    {count !== undefined && <span className="opacity-60">{count}</span>}
  </button>
);

const AttrRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.06] py-1.5 last:border-0">
    <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="text-sm text-foreground text-right">{value}</span>
  </div>
);

const ExpandedDetail = ({ row }: { row: DetectionRow }) => {
  const attrs = row.personAttributes;
  const img = detectionImageUrl(row.filePath);
  return (
    <td colSpan={9} className="bg-card px-6 py-4">
      <div className="grid gap-6 md:grid-cols-3">
        {attrs ? (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-foreground">Person attributes</h4>
            <AttrRow label="Clothing" value={attrs.clothing ?? '—'} />
            <AttrRow
              label="Colors"
              value={
                attrs.clothing_colors?.length ? (
                  <span className="inline-flex gap-1.5">
                    {attrs.clothing_colors.map((c) => (
                      <span key={c} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs">
                        {c}
                      </span>
                    ))}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <AttrRow label="Distance" value={attrs.distance ?? '—'} />
            <AttrRow label="Facing" value={attrs.facing ?? '—'} />
            <AttrRow label="Carrying" value={attrs.carryingItem ?? '—'} />
            <AttrRow label="Body language" value={attrs.bodyLanguage ?? '—'} />
            <AttrRow label="Actions" value={attrs.actions?.join(', ') || '—'} />
            <AttrRow label="Age est." value={attrs.estimatedAge ?? '—'} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No person attributes (non-person class).</div>
        )}

        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">Track &amp; motion</h4>
          <AttrRow label="Track ID" value={row.trackId ?? '—'} />
          <AttrRow label="Track state" value={row.trackState ?? '—'} />
          <AttrRow label="Tracklet length" value={row.trackletLen ?? '—'} />
          <AttrRow label="Identity" value={row.identity ?? 'unknown'} />
          <AttrRow
            label="Identity conf."
            value={row.identityConfidence != null ? `${(row.identityConfidence * 100).toFixed(0)}%` : '—'}
          />
          <AttrRow label="Face embedding" value={row.embeddingDim > 0 ? `${row.embeddingDim}-d vector` : '—'} />
          <AttrRow
            label="Motion"
            value={
              row.motionStats
                ? `${row.motionStats.motion_pixels ?? 0} px (${row.motionStats.motion_percentage ?? 0}%)`
                : '—'
            }
          />
          <AttrRow label="Motion conf." value={row.motionStats?.confidence ?? '—'} />
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">Context</h4>
          <AttrRow label="Event type" value={row.eventType ?? '—'} />
          <AttrRow label="Severity" value={row.severity ?? '—'} />
          <AttrRow label="Threat" value={row.threatLevel ?? 'none'} />
          {row.sceneContext &&
            Object.entries(row.sceneContext).map(([k, v]) => (
              <AttrRow key={k} label={k.replace(/([A-Z])/g, ' $1').toLowerCase()} value={String(v)} />
            ))}
          {img && (
            <a href={img} target="_blank" rel="noreferrer" className="mt-3 block">
              <img
                src={img}
                alt={`detection ${row.class}`}
                className="max-h-44 rounded-md border border-white/[0.10] object-contain"
              />
            </a>
          )}
        </div>
      </div>
    </td>
  );
};

export default function DetectionsPage() {
  const [rows, setRows] = useState<DetectionRow[]>([]);
  const [stats, setStats] = useState<DetectionStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeFilter>('24h');
  const [classFilter, setClassFilter] = useState<string>('');
  const [cameraFilter, setCameraFilter] = useState<string>('');
  const [threatFilter, setThreatFilter] = useState<string>('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, s] = await Promise.all([
        fetchDetectionRows({
          class: classFilter || undefined,
          camera: cameraFilter || undefined,
          threat: threatFilter || undefined,
          from: rangeToFrom[range],
          page,
          limit,
        }),
        fetchDetectionStats({ from: rangeToFrom[range], camera: cameraFilter || undefined }),
      ]);
      setRows(list.rows);
      setTotal(list.total);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [classFilter, cameraFilter, threatFilter, range, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const cameras = useMemo(() => stats?.cameras.map((c) => c.key) ?? [], [stats]);
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-6 bg-background min-h-[100dvh]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[0.5rem] bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Crosshair className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Detections</h1>
            <p className="text-sm text-muted-foreground">
              Every tracked object — structured metadata from the OpenCV pipeline
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="flex flex-wrap items-center gap-2">
          {stats.byClass.map((c) => (
            <Chip
              key={c.key}
              label={c.key}
              count={c.count}
              active={classFilter === c.key}
              style={classStyles[c.key]}
              onClick={() => {
                setClassFilter(classFilter === c.key ? '' : c.key);
                setPage(1);
              }}
            />
          ))}
          <span className="mx-1 h-4 w-px bg-white/[0.10]" />
          {cameras.map((cam) => (
            <Chip
              key={cam}
              label={cam}
              active={cameraFilter === cam}
              onClick={() => {
                setCameraFilter(cameraFilter === cam ? '' : cam);
                setPage(1);
              }}
            />
          ))}
          <span className="mx-1 h-4 w-px bg-white/[0.10]" />
          {(['critical', 'high', 'medium', 'low'] as const).map((t) => {
            const count = stats.byThreat.find((x) => x.key === t)?.count ?? 0;
            return (
              <Chip
                key={t}
                label={t}
                count={count}
                active={threatFilter === t}
                style={threatStyles[t]}
                onClick={() => {
                  setThreatFilter(threatFilter === t ? '' : t);
                  setPage(1);
                }}
              />
            );
          })}
          <span className="mx-1 h-4 w-px bg-white/[0.10]" />
          {(['1h', '24h', '7d', 'all'] as const).map((r) => (
            <Chip
              key={r}
              label={r === 'all' ? 'All time' : `Last ${r}`}
              active={range === r}
              onClick={() => {
                setRange(r);
                setPage(1);
              }}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-[0.5rem] border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-[0.5rem] border border-white/[0.10]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.10] bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-8" />
              <th className="px-3 py-2.5">Time</th>
              <th className="px-3 py-2.5">Camera</th>
              <th className="px-3 py-2.5">Class</th>
              <th className="px-3 py-2.5">Conf</th>
              <th className="px-3 py-2.5">Track</th>
              <th className="px-3 py-2.5">Clothing</th>
              <th className="px-3 py-2.5">Distance</th>
              <th className="px-3 py-2.5">Threat</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-muted-foreground">
                  Loading detections…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-muted-foreground">
                  <EmptyState
                    icon={Crosshair}
                    title="No detections"
                    description="No tracked objects in this window."
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                    className="cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.03]"
                  >
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {expanded === row.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-foreground">
                      {formatTime(row.timestamp)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{row.cameraId}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-xs font-medium',
                          classStyles[row.class] ??
                            'bg-white/[0.06] text-foreground/80 border-white/[0.10]',
                        )}
                      >
                        {row.class}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-foreground">
                      {row.confidence != null ? `${(row.confidence * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {row.trackId != null ? `#${row.trackId}` : '—'}
                      {row.humanVerified && (
                        <span className="ml-1.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                          verified
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {row.personAttributes?.clothing ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {row.personAttributes?.distance ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.threatLevel ? (
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-xs font-medium',
                            threatStyles[row.threatLevel] ?? threatStyles.none,
                          )}
                        >
                          {row.threatLevel}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                  {expanded === row.id && (
                    <tr className="border-b border-white/[0.06]">
                      <ExpandedDetail row={row} />
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total.toLocaleString()} detections · page {page} / {pages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
