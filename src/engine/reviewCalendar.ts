import type { FactMemory } from '../types/math';
import { getDifficultFacts, getSlowestFacts } from './spacedRepetition';

export interface PlayerDiagnostics {
  totalMeasured: number;
  masteredCount: number;
  inProgressCount: number;
  difficultCount: number;
  accuracyPct: number;
  avgTimeSec: number | null;
  strongestFacts: FactMemory[];
  weakestFacts: FactMemory[];
  slowestFacts: FactMemory[];
  recommendedFocusIds: string[];
  recommendedSummary: string;
}

export interface ReviewCalendarDay {
  dateKey: string;
  label: string;
  shortDate: string;
  isToday: boolean;
  isTomorrow: boolean;
  facts: FactMemory[];
  count: number;
  difficultCount: number;
}

export interface ReviewCalendarData {
  dueNow: FactMemory[];
  days: ReviewCalendarDay[];
  totalScheduled7Days: number;
}

export interface ReviewReminderBanner {
  hasDue: boolean;
  urgentCount: number;
  tomorrowCount: number;
  title: string;
  message: string;
  focusFactIds: string[];
}

export function formatFactEquation(fact: Pick<FactMemory, 'op' | 'a' | 'b' | 'answer'>): string {
  return fact.op === 'mul'
    ? `${fact.a} × ${fact.b} = ${fact.answer}`
    : `${fact.a} ÷ ${fact.b} = ${fact.answer}`;
}

export function formatFactPrompt(fact: Pick<FactMemory, 'op' | 'a' | 'b'>): string {
  return fact.op === 'mul' ? `${fact.a} × ${fact.b}` : `${fact.a} ÷ ${fact.b}`;
}

function toLocalDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getPolishDayLabel(offset: number, date: Date): string {
  if (offset === 0) return 'Dziś';
  if (offset === 1) return 'Jutro';
  const shortDays = ['Ndz', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];
  return shortDays[date.getDay()] ?? '';
}

export function buildPlayerDiagnostics(
  memories: Record<string, FactMemory>
): PlayerDiagnostics {
  const measured = Object.values(memories).filter((m) => m.attempts > 0);
  const totalMeasured = measured.length;

  const masteredList = measured.filter(
    (m) => m.mastery === 'mistrzowskie' || m.mastery === 'opanowane'
  );
  const difficultList = measured.filter((m) => m.mastery === 'trudne');
  const inProgressCount = measured.filter((m) => m.mastery === 'w_trakcie').length;

  const totalAttempts = measured.reduce((sum, m) => sum + m.attempts, 0);
  const totalCorrect = measured.reduce((sum, m) => sum + m.correctCount, 0);
  const accuracyPct =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const avgTimeMs =
    totalMeasured > 0
      ? Math.round(measured.reduce((sum, m) => sum + m.avgTimeMs, 0) / totalMeasured)
      : 0;

  // Strongest: mastered/opanowane with zero or minimal errors & fastest response time
  const strongestFacts = [...measured]
    .filter((m) => m.wrongCount === 0 || m.mastery === 'mistrzowskie' || m.mastery === 'opanowane')
    .sort((a, b) => {
      const accA = a.correctCount / a.attempts;
      const accB = b.correctCount / b.attempts;
      if (accB !== accA) return accB - accA;
      return a.avgTimeMs - b.avgTimeMs;
    })
    .slice(0, 6);

  // Weakest: prioritize actual mistakes or 'trudne' classification
  const weakestFacts = getDifficultFacts(memories, 8).filter(
    (m) => m.wrongCount > 0 || m.mastery === 'trudne' || m.mastery === 'w_trakcie'
  );

  // Slowest: sorted strictly by longest average thinking time
  const slowestFacts = getSlowestFacts(memories, 6);

  const recommendedIds = Array.from(
    new Set([
      ...weakestFacts.slice(0, 5).map((f) => f.id),
      ...slowestFacts.slice(0, 4).map((f) => f.id),
    ])
  ).slice(0, 8);

  let recommendedSummary =
    'Rozegraj pierwszą serię treningową, aby system wyłapał działania wymagające utrwalenia.';
  if (totalMeasured > 0) {
    if (weakestFacts.length > 0) {
      const topLabels = weakestFacts
        .slice(0, 3)
        .map((f) => formatFactPrompt(f))
        .join(', ');
      recommendedSummary = `Warto teraz przećwiczyć: ${topLabels}.`;
    } else if (slowestFacts.length > 0 && slowestFacts[0].avgTimeMs > 3000) {
      recommendedSummary = `Świetna celność! Przyspiesz czas reakcji w działaniu ${formatFactPrompt(
        slowestFacts[0]
      )}.`;
    } else {
      recommendedSummary = 'Świetna forma! Utrwalaj materiał zgodnie z kalendarzem powtórek.';
    }
  }

  return {
    totalMeasured,
    masteredCount: masteredList.length,
    inProgressCount,
    difficultCount: difficultList.length,
    accuracyPct,
    avgTimeSec: avgTimeMs > 0 ? Number((avgTimeMs / 1000).toFixed(1)) : null,
    strongestFacts,
    weakestFacts,
    slowestFacts,
    recommendedFocusIds: recommendedIds,
    recommendedSummary,
  };
}

export function buildReviewCalendar(
  memories: Record<string, FactMemory>,
  now = Date.now()
): ReviewCalendarData {
  const measured = Object.values(memories).filter((m) => m.attempts > 0);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayStartMs = startOfToday.getTime();
  const todayEndMs = todayStartMs + 24 * 60 * 60 * 1000 - 1;

  const days: ReviewCalendarDay[] = [];
  const dayBuckets = new Map<string, FactMemory[]>();

  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(todayStartMs + offset * 24 * 60 * 60 * 1000);
    const key = toLocalDateKey(d.getTime());
    const shortDate = `${String(d.getDate()).padStart(2, '0')}.${String(
      d.getMonth() + 1
    ).padStart(2, '0')}`;
    dayBuckets.set(key, []);
    days.push({
      dateKey: key,
      label: getPolishDayLabel(offset, d),
      shortDate,
      isToday: offset === 0,
      isTomorrow: offset === 1,
      facts: [],
      count: 0,
      difficultCount: 0,
    });
  }

  const dueNow: FactMemory[] = [];
  const todayKey = days[0].dateKey;
  const horizonEndMs = todayStartMs + 7 * 24 * 60 * 60 * 1000;

  for (const mem of measured) {
    // Anything overdue, scheduled today, or marked 'trudne' belongs in Today's review bucket
    if (mem.nextReviewAt <= todayEndMs || mem.mastery === 'trudne') {
      dueNow.push(mem);
      dayBuckets.get(todayKey)?.push(mem);
    } else if (mem.nextReviewAt < horizonEndMs) {
      const targetKey = toLocalDateKey(mem.nextReviewAt);
      dayBuckets.get(targetKey)?.push(mem);
    }
  }

  dueNow.sort((a, b) => {
    if (a.mastery === 'trudne' && b.mastery !== 'trudne') return -1;
    if (b.mastery === 'trudne' && a.mastery !== 'trudne') return 1;
    return a.nextReviewAt - b.nextReviewAt;
  });

  let totalScheduled7Days = 0;
  for (const day of days) {
    const bucket = dayBuckets.get(day.dateKey) ?? [];
    bucket.sort((a, b) => b.avgTimeMs - a.avgTimeMs);
    day.facts = bucket;
    day.count = bucket.length;
    day.difficultCount = bucket.filter((f) => f.mastery === 'trudne').length;
    totalScheduled7Days += bucket.length;
  }

  return {
    dueNow,
    days,
    totalScheduled7Days,
  };
}

export function getReviewReminderBanner(
  memories: Record<string, FactMemory>,
  now = Date.now()
): ReviewReminderBanner | null {
  const measured = Object.values(memories).filter((m) => m.attempts > 0);
  if (measured.length === 0) return null;

  const calendar = buildReviewCalendar(memories, now);
  const dueCount = calendar.dueNow.length;
  const tomorrowCount = calendar.days[1]?.count ?? 0;

  if (dueCount > 0) {
    const sample = calendar.dueNow
      .slice(0, 3)
      .map((f) => formatFactPrompt(f))
      .join(', ');
    return {
      hasDue: true,
      urgentCount: dueCount,
      tomorrowCount,
      title:
        dueCount === 1
          ? 'Przypomnienie: 1 działanie do powtórki dzisiaj'
          : `Przypomnienie: ${dueCount} działań do powtórki dzisiaj`,
      message: `Algorytm powtórek zaplanował na dziś m.in.: ${sample}. Krótka seria utrwali je na stałe!`,
      focusFactIds: calendar.dueNow.slice(0, 10).map((f) => f.id),
    };
  }

  if (tomorrowCount > 0) {
    return {
      hasDue: false,
      urgentCount: 0,
      tomorrowCount,
      title: 'Dzisiejsze powtórki opanowane!',
      message: `Wszystko na dziś zaliczone. Na jutro zaplanowano ${tomorrowCount} działań w kalendarzu powtórek.`,
      focusFactIds: [],
    };
  }

  return null;
}
