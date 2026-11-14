import assert from 'node:assert/strict';
import test from 'node:test';
import type { TaskAttempt } from '../types/math';
import { assessSeries, lockoutLeftMs, newAccountsGate, serverSeriesSuspicious, type IntegritySignals } from './integrity';

function attempts(times: number[], correct = true): TaskAttempt[] {
  return times.map((t, i) => ({
    problem: { id: `p${i}`, a: 3, b: 4, op: 'mul', answer: 12 } as unknown as TaskAttempt['problem'],
    userAnswer: 12,
    isCorrect: correct,
    timeMs: Math.max(300, t),
    usedHint: false,
    pointsEarned: 10,
    quality: 5,
  }));
}
const sig = (times: number[], extra: Partial<IntegritySignals> = {}): IntegritySignals => ({
  rawTimesMs: times,
  untrustedEvents: 0,
  webdriver: false,
  hiddenDuringTask: 0,
  correctAfterHidden: 0,
  ...extra,
});

test('zwykłe dziecko, nawet szybkie, nie jest zgłaszane', () => {
  const kid = [1800, 2400, 1200, 3100, 900, 1500, 2700, 1100, 4200, 1300, 950, 2000];
  assert.equal(assessSeries(attempts(kid), sig(kid)).level, 'ok');
  const fastKid = [800, 1100, 750, 1400, 900, 1250, 820, 1600, 980, 760, 1300, 870];
  assert.equal(assessSeries(attempts(fastKid), sig(fastKid)).level, 'ok');
});

test('odpowiedzi szybsze niż człowiek → do sprawdzenia', () => {
  const bot = Array.from({ length: 15 }, (_, i) => 120 + (i % 5) * 40);
  const v = assessSeries(attempts(bot), sig(bot));
  assert.equal(v.level, 'pending');
  assert.ok(v.reasons.includes('superhuman'));
});

test('skrypt w przeglądarce → do sprawdzenia', () => {
  const t = [2000, 2100, 1900];
  assert.equal(assessSeries(attempts(t), sig(t, { untrustedEvents: 5 })).level, 'pending');
  assert.equal(assessSeries(attempts(t), sig(t, { webdriver: true })).level, 'pending');
});

test('maszynowo równe tempo → obserwacja, z przełączaniem okna → do sprawdzenia', () => {
  const even = Array.from({ length: 12 }, (_, i) => 1000 + (i % 2) * 20);
  assert.equal(assessSeries(attempts(even), sig(even)).level, 'watch');
  assert.equal(assessSeries(attempts(even), sig(even, { correctAfterHidden: 4, hiddenDuringTask: 4 })).level, 'pending');
});

test('krótka seria i słaba poprawność nie są oceniane jako nadludzkie', () => {
  const fast = [200, 210, 190, 220];
  assert.equal(assessSeries(attempts(fast), sig(fast)).level, 'ok');
  const many = Array.from({ length: 12 }, () => 200);
  assert.equal(assessSeries(attempts(many, false), sig(many)).level, 'ok');
});

test('skan serwera, limit kont na urządzeniu i blokada zgadywania haseł', () => {
  assert.equal(serverSeriesSuspicious({ tasks: 20, correct: 20, avgMs: 310 }), true);
  assert.equal(serverSeriesSuspicious({ tasks: 20, correct: 20, avgMs: 900 }), false);
  const now = 10_000_000_000;
  assert.equal(newAccountsGate([now - 1000, now - 2000], now).allowed, true);
  assert.equal(newAccountsGate([now - 1000, now - 2000, now - 3000], now).allowed, false);
  assert.equal(newAccountsGate([now - 30 * 3600_000, now - 31 * 3600_000, now - 32 * 3600_000], now).allowed, true);
  const fails = [1, 2, 3, 4, 5].map((i) => now - i * 1000);
  assert.ok(lockoutLeftMs(fails, now) > 4 * 60_000);
  assert.equal(lockoutLeftMs(fails.slice(0, 4), now), 0);
});
