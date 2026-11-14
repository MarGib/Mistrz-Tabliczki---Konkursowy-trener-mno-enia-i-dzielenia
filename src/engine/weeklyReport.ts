/**
 * Raport tygodnia dla rodzica: co dziecko ćwiczyło, gdzie ma trudności i o ile się poprawiło.
 * Ostatnie 7 dni porównane z 7 dniami wcześniej. Liczone na urządzeniu z pełnej historii.
 */
import type { FactMemory } from '../types/math';
import type { SessionLite } from './history';
import { getDifficultFacts } from './spacedRepetition';
import { formatFactPrompt } from './reviewCalendar';

const DAY = 24 * 3600 * 1000;

export interface WeekStats {
  series: number;
  tasks: number;
  accuracyPct: number | null;
  avgSec: number | null;
  activeDays: number;
}

export interface WeeklyReport {
  from: number;
  to: number;
  week: WeekStats;
  prev: WeekStats;
  /** Zmiana tempa w % (ujemna = szybciej). null, gdy brak danych do porównania. */
  tempoChangePct: number | null;
  accuracyChange: number | null;
  dotsPassed: number;
  modulesPassed: number;
  /** Najczęściej ćwiczone tabliczki (liczby) w tym tygodniu. */
  topTables: number[];
  /** Działania sprawiające kłopot (ćwiczone w tym tygodniu). */
  hardest: string[];
  masteredTotal: number;
  factsTotal: number;
}

function stats(list: SessionLite[]): WeekStats {
  const tasks = list.reduce((s, x) => s + x.tasks, 0);
  const correct = list.reduce((s, x) => s + x.correct, 0);
  const timed = list.filter((x) => x.avgMs > 0 && x.tasks > 0);
  const timedTasks = timed.reduce((s, x) => s + x.tasks, 0);
  const avgMs = timedTasks > 0 ? timed.reduce((s, x) => s + x.avgMs * x.tasks, 0) / timedTasks : null;
  const days = new Set(list.map((x) => new Date(x.t).toDateString()));
  return {
    series: list.length,
    tasks,
    accuracyPct: tasks > 0 ? Math.round((correct / tasks) * 100) : null,
    avgSec: avgMs !== null ? Math.round(avgMs / 100) / 10 : null,
    activeDays: days.size,
  };
}

export function buildWeeklyReport(
  history: SessionLite[],
  memories: Record<string, FactMemory>,
  now = Date.now()
): WeeklyReport {
  const from = now - 7 * DAY;
  const week = history.filter((s) => s.t > from && s.t <= now);
  const prevList = history.filter((s) => s.t > from - 7 * DAY && s.t <= from);
  const w = stats(week);
  const p = stats(prevList);

  const seen = Object.values(memories).filter((m) => m.attempts > 0 && m.lastSeenAt > from);
  const tableCount = new Map<number, number>();
  for (const m of seen) {
    const nums = m.op === 'mul' ? [m.a, m.b] : [m.b];
    for (const n of new Set(nums)) if (n > 1) tableCount.set(n, (tableCount.get(n) ?? 0) + m.attempts);
  }
  const topTables = [...tableCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n]) => n);

  const weekIds = new Set(seen.map((m) => m.id));
  const hardest = getDifficultFacts(memories, 40)
    .filter((m) => weekIds.has(m.id) && (m.wrongCount > 0 || m.mastery === 'trudne'))
    .slice(0, 5)
    .map((m) => `${formatFactPrompt(m)} = ${m.answer}`);

  const all = Object.values(memories).filter((m) => m.attempts > 0);
  return {
    from,
    to: now,
    week: w,
    prev: p,
    tempoChangePct:
      w.avgSec !== null && p.avgSec !== null && p.avgSec > 0 ? Math.round(((w.avgSec - p.avgSec) / p.avgSec) * 100) : null,
    accuracyChange: w.accuracyPct !== null && p.accuracyPct !== null ? w.accuracyPct - p.accuracyPct : null,
    dotsPassed: week.filter((s) => s.kind === 'lesson' && s.passed).length,
    modulesPassed: week.filter((s) => s.kind === 'stage' && s.passed).length,
    topTables,
    hardest,
    masteredTotal: all.filter((m) => m.mastery === 'opanowane' || m.mastery === 'mistrzowskie').length,
    factsTotal: all.length,
  };
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
const dec = (n: number) => String(n).replace('.', ',');

/** Wersja tekstowa — do wysłania SMS-em / komunikatorem albo wklejenia. */
export function weeklyReportText(name: string, r: WeeklyReport): string {
  const lines = [`📊 ${name} — tydzień ${fmtDate(r.from)} – ${fmtDate(r.to)} (Mistrz Tabliczki)`];
  if (r.week.series === 0) {
    lines.push('W tym tygodniu nie było treningów. Wystarczy 5 minut dziennie!');
    return lines.join('\n');
  }
  lines.push(`• ${r.week.activeDays} ${r.week.activeDays === 1 ? 'dzień' : 'dni'} z treningiem, ${r.week.series} serii, ${r.week.tasks} zadań`);
  if (r.week.accuracyPct !== null) {
    const ch = r.accuracyChange !== null && r.accuracyChange !== 0 ? ` (${r.accuracyChange > 0 ? '+' : ''}${r.accuracyChange} pkt)` : '';
    lines.push(`• Poprawność: ${r.week.accuracyPct}%${ch}`);
  }
  if (r.week.avgSec !== null) {
    const ch =
      r.tempoChangePct !== null && r.tempoChangePct !== 0
        ? r.tempoChangePct < 0
          ? ` — o ${-r.tempoChangePct}% szybciej niż tydzień wcześniej 🚀`
          : ` — o ${r.tempoChangePct}% wolniej niż tydzień wcześniej`
        : '';
    lines.push(`• Tempo: ${dec(r.week.avgSec)} s na zadanie${ch}`);
  }
  if (r.dotsPassed + r.modulesPassed > 0) {
    lines.push(`• Ścieżka: ${r.dotsPassed} zaliczonych kropek${r.modulesPassed ? `, ${r.modulesPassed} ukończone moduły 🏆` : ''}`);
  }
  if (r.topTables.length) lines.push(`• Najwięcej ćwiczeń: tabliczka ${r.topTables.map((n) => `× ${n}`).join(', ')}`);
  if (r.hardest.length) lines.push(`• Do powtórki: ${r.hardest.join(', ')}`);
  lines.push(`• Opanowane działania: ${r.masteredTotal} z ${r.factsTotal} ćwiczonych`);
  return lines.join('\n');
}
