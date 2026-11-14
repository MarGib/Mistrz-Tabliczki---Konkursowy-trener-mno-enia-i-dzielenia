import assert from 'node:assert/strict';
import test from 'node:test';
import type { SessionLite } from './history';
import { buildWeeklyReport, weeklyReportText } from './weeklyReport';

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 14, 18);
const s = (id: string, daysAgo: number, avgMs: number, correct = 9, extra: Partial<SessionLite> = {}): SessionLite => ({
  id, t: now - daysAgo * DAY, title: 'x', mode: 'mul', kind: 'free', tasks: 10, correct, avgMs, pts: 10, passed: true, ...extra,
});

test('raport tygodnia: porównanie z poprzednim tygodniem i tekst do wysłania', () => {
  const hist = [
    s('a', 10, 4000, 7), s('b', 9, 4000, 7),
    s('c', 1, 3000), s('d', 2, 3000, 9, { kind: 'lesson' }), s('e', 2, 3000, 10, { kind: 'stage' }),
  ];
  const mem = {
    'mul-7-8': { id: 'mul-7-8', op: 'mul', a: 7, b: 8, answer: 56, attempts: 6, correctCount: 3, wrongCount: 3, avgTimeMs: 5000, lastSeenAt: now - DAY, mastery: 'trudne' },
    'mul-2-3': { id: 'mul-2-3', op: 'mul', a: 2, b: 3, answer: 6, attempts: 4, correctCount: 4, wrongCount: 0, avgTimeMs: 1500, lastSeenAt: now - DAY, mastery: 'opanowane' },
  } as never;
  const r = buildWeeklyReport(hist, mem, now);
  assert.equal(r.week.series, 3);
  assert.equal(r.week.activeDays, 2);
  assert.equal(r.prev.series, 2);
  assert.equal(r.tempoChangePct, -25);
  assert.equal(r.accuracyChange, 23);
  assert.equal(r.dotsPassed, 1);
  assert.equal(r.modulesPassed, 1);
  assert.deepEqual(r.hardest, ['7 × 8 = 56']);
  assert.equal(r.masteredTotal, 1);
  const txt = weeklyReportText('Ola', r);
  assert.match(txt, /o 25% szybciej/);
  assert.match(txt, /7 × 8 = 56/);
  assert.match(weeklyReportText('Ola', buildWeeklyReport([], {}, now)), /nie było treningów/);
});
