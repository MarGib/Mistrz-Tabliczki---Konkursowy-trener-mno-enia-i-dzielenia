import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildUserSpeedTrendData } from '../engine/chartData';
import type { UserProfile } from '../types/math';

interface ProgressTrendChartProps {
  profiles: UserProfile[];
  activeProfileId: string;
  isDark?: boolean;
}

const USER_LINE_COLORS = [
  '#10B981', // Emerald
  '#3B82F6', // Cobalt Blue
  '#F59E0B', // Amber
  '#A855F7', // Violet
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#84CC16', // Lime
];

type ChartMetric = 'speed' | 'accuracy';

interface CustomTooltipPayloadItem {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
  payload?: Record<string, string | number | undefined>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string;
  metric: ChartMetric;
}

function CustomChartTooltip({ active, payload, label, metric }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: 'var(--th-surface)',
        borderColor: 'var(--th-border)',
        color: 'var(--th-text)',
      }}
      className="border rounded-xl shadow-md px-3.5 py-2.5 text-xs space-y-1.5"
    >
      <div className="font-display font-bold">{label}</div>
      {payload.map((entry) => {
        const keyStr = String(entry.dataKey ?? '');
        const profileId = keyStr.replace(/^(time|acc)_/, '');
        const title = entry.payload?.[`title_${profileId}`];
        const date = entry.payload?.[`date_${profileId}`];
        const acc = entry.payload?.[`acc_${profileId}`];
        const time = entry.payload?.[`time_${profileId}`];

        return (
          <div
            key={keyStr}
            className="pt-1 border-t border-[var(--th-border)] first:border-t-0 first:pt-0"
          >
            <div className="flex items-center justify-between gap-4 font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="font-mono font-bold tabular-nums">
                {metric === 'speed'
                  ? `${Number(entry.value ?? 0).toFixed(1).replace('.', ',')} s`
                  : `${entry.value}%`}
              </span>
            </div>
            {(title || date) && (
              <div className="text-[11px] text-[var(--th-text-muted)] mt-0.5 tabular-nums">
                {title ? `${title} · ` : ''}
                {date ?? ''}
                {metric === 'speed' && acc !== undefined ? ` · Skuteczność: ${acc}%` : ''}
                {metric === 'accuracy' && time !== undefined
                  ? ` · Czas: ${Number(time).toFixed(1).replace('.', ',')} s`
                  : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProgressTrendChart({
  profiles,
  activeProfileId,
  isDark = false,
}: ProgressTrendChartProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    profiles.map((p) => p.id)
  );
  const [metric, setMetric] = useState<ChartMetric>('speed');

  // Ensure active user and newly added family profiles stay available on the chart
  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = prev.filter((id) => profiles.some((p) => p.id === id));
      if (!valid.includes(activeProfileId)) {
        return [...valid, activeProfileId];
      }
      return valid.length > 0 ? valid : profiles.map((p) => p.id);
    });
  }, [activeProfileId, profiles]);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((item) => item !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const { data, summaries } = useMemo(
    () => buildUserSpeedTrendData(profiles, selectedIds, 12),
    [profiles, selectedIds]
  );

  const selectedProfiles = useMemo(
    () => profiles.filter((p) => selectedIds.includes(p.id)),
    [profiles, selectedIds]
  );

  const activeSummary =
    summaries.find((s) => s.profileId === activeProfileId) ?? summaries[0];

  const gridColor = isDark ? '#334155' : '#E2E8F0';
  const tickColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <div className="space-y-4" data-testid="recharts-progress-widget">
      {/* Controls Row: Metric Toggle & Per-User Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex items-center gap-1 p-1 bg-[var(--th-surface-muted)] rounded-xl border border-[var(--th-border)]"
          role="group"
          aria-label="Wybierz wskaźnik wykresu"
        >
          <button
            type="button"
            onClick={() => setMetric('speed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              metric === 'speed'
                ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-sm'
                : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
            }`}
          >
            Szybkość (s / zadanie)
          </button>
          <button
            type="button"
            onClick={() => setMetric('accuracy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              metric === 'accuracy'
                ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-sm'
                : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
            }`}
          >
            Skuteczność (%)
          </button>
        </div>

        {/* User Profile Selection (for family comparison) */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Użytkownicy na wykresie"
        >
          {profiles.map((p, idx) => {
            const isSelected = selectedIds.includes(p.id);
            const dotColor = USER_LINE_COLORS[idx % USER_LINE_COLORS.length];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleUser(p.id)}
                aria-pressed={isSelected}
                className={`min-h-[34px] px-3 py-1 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-[var(--th-surface)] border-[var(--th-primary)] text-[var(--th-text)] shadow-sm'
                    : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: isSelected ? dotColor : '#94A3B8' }}
                />
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Speed Delta Callout */}
      {metric === 'speed' && activeSummary && activeSummary.deltaSec !== null && (
        <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          <span className="text-[var(--th-text-muted)] font-medium">
            Tendencja szybkości ({activeSummary.name}):
          </span>
          <span className="font-bold tabular-nums text-[var(--th-text)]">
            {activeSummary.firstAvgSec?.toFixed(1).replace('.', ',')} s →{' '}
            {activeSummary.latestAvgSec?.toFixed(1).replace('.', ',')} s{' '}
            <span
              className={
                activeSummary.deltaSec <= 0 ? 'text-emerald-500' : 'text-amber-500'
              }
            >
              ({activeSummary.deltaSec <= 0 ? '' : '+'}
              {activeSummary.deltaSec.toFixed(1).replace('.', ',')} s)
            </span>
          </span>
        </div>
      )}

      {/* Recharts LineChart Container */}
      {data.length === 0 ? (
        <div className="py-12 text-center bg-[var(--th-surface-muted)] rounded-2xl border border-[var(--th-border)] text-sm text-[var(--th-text-muted)]">
          Wybrani użytkownicy nie mają jeszcze ukończonych serii do narysowania wykresu.
        </div>
      ) : (
        <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-3 sm:p-4">
          <div className="w-full h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 12, right: 16, left: -8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  domain={metric === 'accuracy' ? [0, 100] : [0, 'auto']}
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                  unit={metric === 'speed' ? ' s' : '%'}
                />
                <Tooltip content={<CustomChartTooltip metric={metric} />} />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: tickColor }}
                />

                {metric === 'speed' && (
                  <ReferenceLine
                    y={2.8}
                    stroke="#10B981"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Cel: 2,8 s (na wyrywki)',
                      position: 'insideTopRight',
                      fill: isDark ? '#34D399' : '#047857',
                      fontSize: 11,
                    }}
                  />
                )}

                {selectedProfiles.map((p) => {
                  const colorIdx = profiles.findIndex((item) => item.id === p.id);
                  const strokeColor =
                    USER_LINE_COLORS[(colorIdx >= 0 ? colorIdx : 0) % USER_LINE_COLORS.length];
                  const dataKey = metric === 'speed' ? `time_${p.id}` : `acc_${p.id}`;

                  return (
                    <Line
                      key={p.id}
                      type="monotone"
                      dataKey={dataKey}
                      name={p.name}
                      stroke={strokeColor}
                      strokeWidth={3}
                      animationDuration={300}
                      dot={{ r: 4.5, fill: strokeColor, stroke: '#FFFFFF', strokeWidth: 2 }}
                      activeDot={{ r: 6.5 }}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-[var(--th-text-muted)]">
            {metric === 'speed'
              ? 'Niższa linia oznacza szybsze odpowiedzi w kolejnych seriach.'
              : 'Wyższa linia oznacza większy odsetek poprawnych odpowiedzi.'}
          </p>
        </div>
      )}
    </div>
  );
}
