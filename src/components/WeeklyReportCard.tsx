import { CalendarDays, Copy, History, Share2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { UserProfile } from '../types/math';
import { monthKey } from '../engine/history';
import { useFullHistory } from '../engine/useHistory';
import { buildWeeklyReport, weeklyReportText } from '../engine/weeklyReport';

const card = 'bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-4 sm:p-6';
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

function Change({ value, goodWhenNegative, unit }: { value: number | null; goodWhenNegative?: boolean; unit: string }) {
  if (value === null || value === 0) return null;
  const good = goodWhenNegative ? value < 0 : value > 0;
  return (
    <span className={`text-xs font-bold ${good ? 'text-emerald-600' : 'text-amber-600'}`}>
      {value > 0 ? '+' : ''}
      {value}
      {unit}
    </span>
  );
}

/** Raport tygodnia (dla rodzica) i cała historia gracza. */
export function WeeklyReportCard({ profile }: { profile: UserProfile }) {
  const history = useFullHistory(profile);
  const report = useMemo(() => buildWeeklyReport(history, profile.memories), [history, profile.memories]);
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => weeklyReportText(profile.name, report), [profile.name, report]);

  const months = useMemo(() => {
    const now = new Date();
    const out: { key: string; label: string; series: number; avgSec: number | null }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d.getTime());
      const list = history.filter((s) => monthKey(s.t) === key && s.avgMs > 0 && s.tasks > 0);
      const tasks = list.reduce((a, s) => a + s.tasks, 0);
      out.push({
        key,
        label: MONTHS[d.getMonth()],
        series: history.filter((s) => monthKey(s.t) === key).length,
        avgSec: tasks > 0 ? Math.round(list.reduce((a, s) => a + s.avgMs * s.tasks, 0) / tasks / 100) / 10 : null,
      });
    }
    return out;
  }, [history]);
  const maxSeries = Math.max(1, ...months.map((m) => m.series));
  const totalTasks = history.reduce((a, s) => a + s.tasks, 0);
  const since = history[0]?.t;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Raport tygodnia — ${profile.name}`, text });
        return;
      }
    } catch {
      // anulowano udostępnianie — kopiujemy
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // brak schowka
    }
  };

  const w = report.week;
  return (
    <section className={`${card} space-y-4`} data-testid="weekly-report" aria-labelledby="weekly-report-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--th-primary)] inline-flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" /> Raport tygodnia · dla rodzica
          </p>
          <h2 id="weekly-report-h" className="font-display text-xl font-extrabold">
            {profile.name}: ostatnie 7 dni
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void share()}
          className="min-h-[44px] px-4 rounded-2xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-bold text-sm inline-flex items-center gap-2 border-b-4 border-[var(--th-primary-dark)] cursor-pointer"
          data-testid="report-share"
        >
          {copied ? <Copy className="w-4 h-4" aria-hidden="true" /> : <Share2 className="w-4 h-4" aria-hidden="true" />}
          {copied ? 'Skopiowano' : 'Wyślij raport'}
        </button>
      </div>

      {w.series === 0 ? (
        <p className="text-sm text-[var(--th-text-muted)]">W ostatnich 7 dniach nie było treningów. Wystarczy 5 minut dziennie — przycisk „Graj dalej” sam wybierze, co ćwiczyć.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-2xl bg-[var(--th-surface-muted)] p-3">
              <p className="text-xs text-[var(--th-text-muted)]">Dni z treningiem</p>
              <p className="font-display text-2xl font-extrabold tabular-nums">{w.activeDays}/7</p>
            </div>
            <div className="rounded-2xl bg-[var(--th-surface-muted)] p-3">
              <p className="text-xs text-[var(--th-text-muted)]">Serie · zadania</p>
              <p className="font-display text-2xl font-extrabold tabular-nums">
                {w.series} · {w.tasks}
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--th-surface-muted)] p-3">
              <p className="text-xs text-[var(--th-text-muted)]">Poprawność</p>
              <p className="font-display text-2xl font-extrabold tabular-nums">
                {w.accuracyPct ?? '—'}% <Change value={report.accuracyChange} unit=" pkt" />
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--th-surface-muted)] p-3">
              <p className="text-xs text-[var(--th-text-muted)]">Tempo na zadanie</p>
              <p className="font-display text-2xl font-extrabold tabular-nums">
                {w.avgSec !== null ? `${String(w.avgSec).replace('.', ',')} s` : '—'}{' '}
                <Change value={report.tempoChangePct} goodWhenNegative unit="%" />
              </p>
            </div>
          </div>
          <ul className="text-sm space-y-1">
            {report.dotsPassed + report.modulesPassed > 0 && (
              <li>
                🗺️ Ścieżka: <b>{report.dotsPassed}</b> zaliczonych kropek
                {report.modulesPassed > 0 && (
                  <>
                    , <b>{report.modulesPassed}</b> ukończone moduły 🏆
                  </>
                )}
              </li>
            )}
            {report.topTables.length > 0 && <li>🎯 Najwięcej ćwiczeń: {report.topTables.map((n) => `× ${n}`).join(', ')}</li>}
            {report.hardest.length > 0 && (
              <li>
                🔥 Do powtórki: <b>{report.hardest.join(', ')}</b>
              </li>
            )}
            <li>
              ⭐ Opanowane działania: <b>{report.masteredTotal}</b> z {report.factsTotal} ćwiczonych
            </li>
            {report.prev.series > 0 && (
              <li className="text-[var(--th-text-muted)]">
                Tydzień wcześniej: {report.prev.series} serii, {report.prev.accuracyPct ?? '—'}%,{' '}
                {report.prev.avgSec !== null ? `${String(report.prev.avgSec).replace('.', ',')} s` : '—'} na zadanie
              </li>
            )}
          </ul>
        </>
      )}

      <div className="pt-3 border-t border-[var(--th-border)] space-y-2" data-testid="full-history">
        <p className="text-xs font-bold text-[var(--th-text-muted)] inline-flex items-center gap-1">
          <History className="w-3.5 h-3.5" aria-hidden="true" /> Cała historia: {history.length} serii, {totalTasks} zadań
          {since ? ` · od ${new Date(since).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
        </p>
        <div className="grid grid-cols-6 gap-2 items-end h-24" aria-label="Serie w ostatnich 6 miesiącach">
          {months.map((m) => (
            <div key={m.key} className="flex flex-col items-center gap-1 h-full justify-end">
              <span className="text-[10px] tabular-nums text-[var(--th-text-muted)]">{m.avgSec !== null ? `${String(m.avgSec).replace('.', ',')} s` : ''}</span>
              <div
                className="w-full rounded-t-lg bg-[var(--th-primary)] opacity-80"
                style={{ height: `${Math.max(4, (m.series / maxSeries) * 56)}px` }}
                title={`${m.series} serii`}
              />
              <span className="text-[11px] font-semibold">{m.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[var(--th-text-muted)]">Słupki: liczba serii w miesiącu. Nad słupkiem: średnie tempo na zadanie.</p>
      </div>
    </section>
  );
}
