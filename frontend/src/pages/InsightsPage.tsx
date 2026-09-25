import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { RefreshCw, BarChart3, Eye, Users, Clock, TrendingUp } from 'lucide-react';
import {
  type HourlyTypeRow,
  type HourlyThreatRow,
  type NotableEvent,
} from '@/services/api/insightsService';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageContainer } from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';
import { useInsights } from '@/hooks/useInsights';

/* ─── Validated dark-mode palette (palette.md slots 1-4) ─── */
const SERIES = {
  person: '#3987e5',    // slot 1 blue — validated dark
  vehicle: '#d95926',   // slot 2 orange
  motion: '#199e70',    // slot 3 aqua
} as const;

const THREAT = {
  critical: '#d03b3b',  // status critical
  high: '#ec835a',      // status serious
  medium: '#fab219',    // status warning
  low: '#0ca30c',       // status good
} as const;

const THREAT_BG: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/25',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
};

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toNum = (v: unknown): number => {
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

function buildHourlyStacked(rows: HourlyTypeRow[], types: string[]) {
  return Array.from({ length: 24 }, (_, h) => {
    const entry: Record<string, number | string> = { hour: `${h}` };
    types.forEach((t) => { entry[t] = 0; });
    rows.forEach((r) => {
      if (toNum(r.hour) === h) entry[r.event_type] = toNum(r.count);
    });
    return entry;
  });
}

function buildThreatStacked(rows: HourlyThreatRow[]) {
  const levels = ['critical', 'high', 'medium', 'low'];
  return Array.from({ length: 24 }, (_, h) => {
    const entry: Record<string, number | string> = { hour: `${h}` };
    levels.forEach((l) => { entry[l] = 0; });
    rows.forEach((r) => {
      if (toNum(r.hour) === h) {
        const l = r.level ?? 'low';
        if (levels.includes(l)) entry[l] = toNum(r.count);
      }
    });
    return entry;
  });
}

/* ─── Small reusable bits ─── */
const Card = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <section className={cn('rounded-[0.5rem] border border-white/[0.08] bg-card p-4', className)}>
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
    {children}
  </section>
);

const HeroFigure = ({ value, label }: { value: React.ReactNode; label: string }) => (
  <div>
    <div className="text-[2.75rem] leading-none font-semibold text-foreground">
      {value}
    </div>
    <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
  </div>
);

const Kpi = ({ label, value, sub, icon: Icon }: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
    <div className="flex items-center gap-2 mb-1">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
    <div className="text-xl font-semibold text-foreground">{value}</div>
    {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
  </div>
);

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

const NotableRow = ({ e }: { e: NotableEvent }) => (
  <Link
    to={`/events?eventId=${e.id}`}
    className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
  >
    <span className={cn('inline-flex w-16 shrink-0 justify-center rounded-full border px-1.5 py-0.5 text-[11px] font-medium', THREAT_BG[e.threat_level ?? ''] ?? THREAT_BG.low)}>
      {e.threat_level ?? e.severity}
    </span>
    <span className="w-12 shrink-0 font-mono text-sm text-foreground">{fmtTime(e.timestamp)}</span>
    <span className="w-16 shrink-0 text-xs text-muted-foreground">{e.camera_id ?? '—'}</span>
    <span className="flex-1 truncate text-sm text-foreground/80">{e.event_type}</span>
    <span className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
      {e.persons_detected > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{e.persons_detected}</span>}
      {e.unknown_faces > 0 && <span className="inline-flex items-center gap-1 text-amber-400"><Eye className="h-3 w-3" />{e.unknown_faces}</span>}
    </span>
  </Link>
);

const tooltipStyle = { background: '#111113', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 };

export default function InsightsPage() {
  const [date, setDate] = useState(todayLocal());
  const { data, isLoading: loading, error, refetch } = useInsights(date);

  const types = useMemo(() => (data?.byType ?? []).map((t) => t.event_type), [data]);
  const hourlyTypeData = useMemo(() => buildHourlyStacked(data?.hourlyByType ?? [], types), [data, types]);
  const hourlyThreatData = useMemo(() => buildThreatStacked(data?.hourlyByThreat ?? []), [data]);

  // Severity distribution for doughnut
  const severityData = useMemo(() => {
    const map = new Map<string, number>();
    (data?.severityVsThreat ?? []).forEach((r) => {
      map.set(r.severity, (map.get(r.severity) ?? 0) + toNum(r.count));
    });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [data]);

  // Threat distribution for doughnut
  const threatData = useMemo(() => {
    const map = new Map<string, number>();
    (data?.severityVsThreat ?? []).forEach((r) => {
      const lvl = r.threat_level ?? 'unknown';
      map.set(lvl, (map.get(lvl) ?? 0) + toNum(r.count));
    });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [data]);

  // Object classes for pie
  const objectData = useMemo(() =>
    (data?.objectClasses ?? []).map((o) => ({
      name: o.obj_class,
      value: toNum(o.count),
      avgConf: o.avg_conf,
    })), [data]);

  // Camera comparison data for horizontal bar
  const cameraData = useMemo(() =>
    (data?.byCamera ?? []).map((c) => ({
      camera: c.camera_id,
      events: toNum(c.count),
      persons: toNum(c.persons),
    })), [data]);

  // Heatmap matrix
  const heatmap = useMemo(() => {
    const cameras = [...new Set((data?.cameraHourly ?? []).map((r) => r.camera_id))];
    const lookup = new Map<string, number>();
    (data?.cameraHourly ?? []).forEach((r) => { lookup.set(`${r.camera_id}|${r.hour}`, toNum(r.count)); });
    const max = Math.max(1, ...lookup.values());
    return { cameras, lookup, max };
  }, [data]);

  // Peak hour
  const peakHour = useMemo(() => {
    const sums = new Array(24).fill(0);
    (data?.hourlyByType ?? []).forEach((r) => { sums[toNum(r.hour)] += toNum(r.count); });
    const max = Math.max(...sums);
    const idx = sums.indexOf(max);
    return max > 0 ? { hour: `${idx}:00`, count: max } : null;
  }, [data]);

  if (loading && !data) return (
    <PageContainer aria-busy="true" className="space-y-6">
      <div className="h-14 animate-pulse rounded-[0.5rem] bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-white/[0.03]" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-[0.5rem] bg-white/[0.03]" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-[0.5rem] bg-white/[0.03]" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </PageContainer>
  );

  if (error || !data) return (
    <PageContainer>
      <EmptyState icon={BarChart3} title="Insights unavailable" description={error?.message ?? 'No data'} action={{ label: 'Retry', onClick: () => void refetch() }} />
    </PageContainer>
  );

  const t = data.totals;
  const total = toNum(t.total);
  const baseline = toNum(data.weekBaseline.avg_daily_events);
  const vsBaseline = baseline > 0 ? Math.round(((total - baseline) / baseline) * 100) : null;
  const uniqueTracksTotal = [...new Set((data.uniqueTracks ?? []).map((r) => r.camera_id))]
    .reduce((s, cam) => s + toNum((data.uniqueTracks ?? []).find((r) => r.camera_id === cam)?.unique_tracks), 0);
  const unknownFaces = toNum(t.unknown_faces);

  // Severity colors
  const SEVERITY_COLORS: Record<string, string> = { alert: '#d03b3b', detection: '#3987e5', info: '#898781' };
  const THREAT_DONUT_COLORS: Record<string, string> = { critical: '#d03b3b', high: '#ec835a', medium: '#fab219', low: '#0ca30c', unknown: '#898781' };

  return (
    <PageContainer className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Daily Insights</h1>
          <p className="text-sm text-muted-foreground">
            {data.date}
            {t.first_event && t.last_event
              ? ` · Active ${fmtTime(t.first_event)}–${fmtTime(t.last_event)}`
              : ' · No activity'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} max={todayLocal()} onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Select date"
            className="bg-card border border-white/[0.10] rounded-[0.5rem] px-3 py-1.5 text-sm text-foreground" />
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={loading}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Hero + KPI row ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <HeroFigure value={total.toLocaleString()} label="Events today" />
        <Kpi label="vs 7-day avg" value={vsBaseline === null ? '—' : `${vsBaseline > 0 ? '+' : ''}${vsBaseline}%`}
          sub={baseline > 0 ? `avg ${baseline.toLocaleString()}/day` : undefined} icon={TrendingUp} />
        <Kpi label="Unique tracks" value={uniqueTracksTotal.toLocaleString()} sub="across cameras" icon={Users} />
        <Kpi label="Unknown faces" value={unknownFaces.toLocaleString()} icon={Eye} />
        <Kpi label="Peak hour" value={peakHour ? peakHour.hour : '—'} sub={peakHour ? `${peakHour.count} events` : undefined} icon={Clock} />
        <Kpi label="Max per event" value={toNum(t.max_persons_per_event)} sub="persons detected" icon={Users} />
      </div>

      {/* ── Row 1: Event type pie + Severity + Threat ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Event type doughnut — part-to-whole, 3 slices, direct labels */}
        <Card title="Event type mix">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={objectData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}
                  paddingAngle={2} strokeWidth={0} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {objectData.map((_, i) => (
                    <Cell key={i} fill={[SERIES.person, SERIES.vehicle, SERIES.motion, '#9085e9', '#e66767'][i % 5]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(val: number, name: string) => [`${val.toLocaleString()} detections`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Severity doughnut — status colors */}
        <Card title="Severity">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}
                  paddingAngle={2} strokeWidth={0} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {severityData.map((entry) => (
                    <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#898781'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(val: number, name: string) => [`${val.toLocaleString()} events`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Threat level doughnut — status colors */}
        <Card title="Threat level">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={threatData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}
                  paddingAngle={2} strokeWidth={0} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {threatData.map((entry) => (
                    <Cell key={entry.name} fill={THREAT_DONUT_COLORS[entry.name] ?? '#898781'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(val: number, name: string) => [`${val.toLocaleString()} events`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ── Row 2: Hourly event type + Hourly threat (side by side) ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Events by hour (stacked by type)">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#898781' }} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: '#898781' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {types.map((tp) => (
                  <Bar key={tp} dataKey={tp} stackId="a" fill={SERIES[tp as keyof typeof SERIES] ?? '#898781'} radius={[0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Threat level by hour">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyThreatData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#898781' }} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: '#898781' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {(['critical', 'high', 'medium', 'low'] as const).map((l) => (
                  <Bar key={l} dataKey={l} stackId="a" fill={THREAT[l]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ── Row 3: Activity heatmap + Camera comparison ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Heatmap: hour × camera matrix */}
        {heatmap.cameras.length > 0 && (
          <Card title="Activity heatmap" className="lg:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-separate" style={{ borderSpacing: '2px' }}>
                <thead>
                  <tr>
                    <th className="w-14" />
                    {Array.from({ length: 24 }, (_, h) => (
                      <th key={h} className="text-center text-[9px] font-medium text-muted-foreground">{h % 3 === 0 ? `${h}` : ''}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.cameras.map((cam) => (
                    <tr key={cam}>
                      <td className="pr-1 text-right text-[10px] font-medium text-muted-foreground">{cam}</td>
                      {Array.from({ length: 24 }, (_, h) => {
                        const v = heatmap.lookup.get(`${cam}|${h}`) ?? 0;
                        const intensity = v / heatmap.max;
                        return (
                          <td key={h}>
                            <div className="h-4 w-full min-w-[14px]"
                              title={`${cam} ${h}:00 — ${v} events`}
                              style={{
                                background: v === 0 ? 'rgba(255,255,255,0.03)'
                                  : `rgba(57,135,229,${0.12 + intensity * 0.88})`,
                              }} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Camera comparison bar — horizontal bars */}
        <Card title="Camera breakdown">
          <div className="space-y-3">
            {cameraData.map((c) => {
              const maxEv = Math.max(...cameraData.map((x) => x.events));
              const tracks = data.uniqueTracks?.find((r) => r.camera_id === c.camera)?.unique_tracks ?? 0;
              return (
                <div key={c.camera}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm font-medium text-foreground">{c.camera}</span>
                    <span className="text-[11px] text-muted-foreground">{c.events.toLocaleString()} events · {toNum(tracks)} tracks</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-[#3987e5]" style={{ width: `${maxEv ? (c.events / maxEv) * 100 : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Row 4: Notable events ── */}
      <Card title="Notable events">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-muted-foreground">High/critical threat · alerts · unknown faces</span>
          <span className="ml-auto text-xs text-muted-foreground">{data.recentHighThreat.length}</span>
        </div>
        {data.recentHighThreat.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing flagged — no critical/high threats, alerts, or unknown faces.</p>
        ) : (
          <div className="space-y-1.5">
            {data.recentHighThreat.slice(0, 10).map((e) => <NotableRow key={e.id} e={e} />)}
          </div>
        )}
      </Card>

      {/* ── Row 5: Scene context + Bursts + Gaps ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Scene conditions">
          <div className="space-y-2">
            {(data.sceneContext ?? []).slice(0, 8).map((s, i) => (
              <div key={i} className="flex items-baseline justify-between border-b border-white/[0.06] py-1.5 text-sm last:border-0">
                <span className="text-foreground">{s.weather ?? '—'} · {s.tod ?? '—'}</span>
                <span className="text-muted-foreground tabular-nums">{toNum(s.count).toLocaleString()}</span>
              </div>
            ))}
            {data.sceneContext.length === 0 && <p className="text-sm text-muted-foreground">No scene data.</p>}
          </div>
        </Card>

        <Card title="Peak 5-min bursts">
          <div className="space-y-1.5">
            {[...data.bursts].sort((a, b) => toNum(b.count) - toNum(a.count)).slice(0, 8).map((b) => {
              const max = toNum(data.bursts[0]?.count ?? 1);
              return (
                <div key={b.bucket} className="flex items-center gap-2 text-sm">
                  <span className="w-10 font-mono text-xs text-foreground">{b.bucket}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-[#d95926]" style={{ width: `${max ? (toNum(b.count) / max) * 100 : 0}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{b.count}</span>
                </div>
              );
            })}
            {data.bursts.length === 0 && <p className="text-sm text-muted-foreground">No events this day.</p>}
          </div>
        </Card>

        <Card title="Quiet gaps (>15 min)">
          <div className="space-y-2">
            {data.gaps.slice(0, 8).map((g, i) => (
              <div key={i} className="flex items-baseline justify-between border-b border-white/[0.06] py-1.5 text-sm last:border-0">
                <span className="font-mono text-xs text-foreground">{g.from_time}</span>
                <span className="tabular-nums text-muted-foreground">{g.gap_minutes} min quiet</span>
              </div>
            ))}
            {data.gaps.length === 0 && <p className="text-sm text-muted-foreground">No gaps — continuous activity.</p>}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
