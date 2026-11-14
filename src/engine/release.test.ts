import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASES, LATEST_RELEASE_ID } from '../data/changelog';
import { computeDbCapacity, computeHosting, computeOverview } from './adminStats';
import type { AdminAccountRow, DeviceRow } from './adminCloud';

test('Lista zmian: unikalne id, od najnowszego, każdy wpis ma punkty', () => {
  const ids = RELEASES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'id muszą być unikalne');
  assert.deepEqual([...ids].sort().reverse(), ids, 'najnowszy wpis na górze');
  assert.equal(LATEST_RELEASE_ID, ids[0]);
  for (const r of RELEASES) {
    assert.ok(r.items.length >= 1 && r.items.length <= 6, `${r.id}: 1–6 punktów`);
    assert.ok(r.title.length > 3);
  }
});

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 14, 12);
const acc = (login: string, sessionsAgoDays: number[]): AdminAccountRow => ({
  login,
  uid: login,
  profileId: login,
  name: login,
  xp: 0,
  sessions: sessionsAgoDays.length,
  lastActiveDate: '',
  updatedAtMs: 0,
  groups: [],
  recent: sessionsAgoDays.map((d) => ({ t: now - d * DAY, kind: 'stage', mode: 'mixed', tasks: 10, correct: 9, avgMs: 2000 })),
});
const dev = (id: string, installed: boolean, daysAgo: number): DeviceRow => ({
  id,
  platform: 'iPad',
  browser: 'Safari',
  installed,
  appVersion: 'v1',
  logins: [],
  unsent: false,
  dbPaused: false,
  firstSeenMs: 0,
  lastSeenMs: now - daysAgo * DAY,
});

test('Panel: przegląd liczy aktywnych, serie, poprawność i urządzenia', () => {
  const o = computeOverview([acc('a', [0.1, 2]), acc('b', [10]), acc('c', [])], [dev('1', true, 1), dev('2', false, 3), dev('3', true, 40)], [], now);
  assert.equal(o.accounts, 3);
  assert.equal(o.active1, 1);
  assert.equal(o.active7, 1);
  assert.equal(o.active30, 2);
  assert.equal(o.series7, 2);
  assert.equal(o.tasks7, 20);
  assert.equal(o.accuracy7, 90);
  assert.equal(o.devices30, 2);
  assert.equal(o.installed30, 1);
  assert.equal(o.perDay.length, 14);
});

test('Panel: ocena bazy i hostingu', () => {
  const low = computeDbCapacity([{ day: 'd', reads: 5000, writes: 1000, deletes: 0 }], 5);
  assert.equal(low.level, 'ok');
  assert.ok((low.devicesCapacity ?? 0) > 5);
  const high = computeDbCapacity([{ day: 'd', reads: 45000, writes: 1000, deletes: 0 }], 50);
  assert.equal(high.level, 'bad');
  const h = computeHosting({ appVersion: 'x', coreBytes: 3e6, totalBytes: 1e7 }, 10);
  assert.equal(h.level, 'ok');
  assert.ok(h.installsPerMonth > 10_000);
});

import { seriesInsight } from './seriesInsight';
import { chooseNextStep, stageStatus } from './nextStep';
import { createFreshProfile } from '../data/curriculum';

const att = (a: number, b: number, ok: boolean, ms: number) => ({
  problem: { id: `mul:${a}x${b}`, op: 'mul' as const, a, b, answer: a * b, display: `${a} × ${b}` },
  isCorrect: ok,
  timeMs: ms,
  usedHint: false,
});

test('Wniosek po serii: błędy, wolne działanie, szybka seria', () => {
  assert.equal(seriesInsight([att(7, 8, false, 3000), att(2, 3, true, 1000)]), 'Zapamiętaj: 7 × 8 = 56.');
  assert.match(seriesInsight([att(7, 8, true, 9000), att(2, 3, true, 1000), att(2, 4, true, 1000)]) ?? '', /Najdłużej trwało 7 × 8 = 56 \(9,0 s\)/);
  assert.match(seriesInsight([att(2, 3, true, 1500), att(2, 4, true, 1500)]) ?? '', /na pamięć/);
  assert.equal(seriesInsight([]), null);
});

test('Graj dalej: nowy gracz dostaje etap 1, po ścieżce — Wyzwanie Mistrza', () => {
  const p = createFreshProfile('Test', 'owl');
  const s = chooseNextStep(p);
  assert.equal(s.kind, 'stage');
  assert.equal(s.config.lessonId, 's1-l1', 'nowy gracz zaczyna od pierwszej kropki');
  const all = [...stageStatus(p).keys()];
  const done = { ...p, completedStageIds: all, unlockedStageIds: all };
  assert.equal(chooseNextStep(done).kind, 'master');
});

import { factFamily, selectAdaptiveSeries } from './problemGenerator';

test('Rodziny działań: 7×8 → 8×7, 56:7, 56:8', () => {
  assert.deepEqual(new Set(factFamily('mul:7x8')), new Set(['mul:8x7', 'div:56/7', 'div:56/8']));
  assert.deepEqual(new Set(factFamily('div:56/8')), new Set(['mul:7x8', 'mul:8x7', 'div:56/7']));
  assert.deepEqual(factFamily('mul:6x6'), ['div:36/6']);
  const series = selectAdaptiveSeries({ mode: 'mixed', maxRange: 100, count: 8, memories: {}, focusFactIds: ['mul:7x8'], rng: () => 0.5 });
  const ids = series.map((p) => p.id);
  for (const id of ['mul:7x8', 'mul:8x7', 'div:56/7', 'div:56/8']) assert.ok(ids.includes(id), `${id} w serii`);
  assert.equal(series.length, 8);
});

import { dailyGoalState } from './dailyGoal';
import { personalRecord } from './records';

test('Cel dnia: liczy serie od północy, 0 = wyłączony', () => {
  const now = new Date(2026, 10, 14, 18, 0).getTime();
  const today = new Date(2026, 10, 14, 9, 0).getTime();
  const yesterday = new Date(2026, 10, 13, 22, 0).getTime();
  const st = dailyGoalState([{ timestamp: today }, { timestamp: today + 1 }, { timestamp: yesterday }], 3, now);
  assert.deepEqual(st, { goal: 3, done: 2, complete: false, pct: 67 });
  assert.equal(dailyGoalState([], 0, now), null);
  assert.equal(dailyGoalState([], undefined, now)?.goal, 3);
});

test('Rekord osobisty: tempo i pierwsza seria bez błędu', () => {
  const s = (avg: number, acc: number, tasks = 10, maxRange = 100) => ({ avgTimeMs: avg, accuracyPct: acc, totalTasks: tasks, maxRange });
  assert.equal(personalRecord([s(3000, 95), s(2800, 90)], s(2500, 95))?.kind, 'tempo');
  assert.equal(personalRecord([s(3000, 95), s(2800, 90)], s(2900, 95)), null);
  assert.equal(personalRecord([s(3000, 95)], s(2000, 95)), null, 'za mało historii na rekord tempa');
  assert.equal(personalRecord([s(3000, 90)], s(3500, 100))?.kind, 'first-perfect');
  assert.equal(personalRecord([s(3000, 95), s(2800, 95)], s(1000, 95, 10, 500)), null, 'inny przedział');
});

import { fromMemoryCount } from './seriesInsight';
test('Z pamięci: poprawne, bez podpowiedzi, poniżej 3 s', () => {
  const a = (ok: boolean, ms: number, hint = false) => ({ isCorrect: ok, timeMs: ms, usedHint: hint });
  assert.equal(fromMemoryCount([a(true, 1000), a(true, 2999), a(true, 3000), a(false, 500), a(true, 800, true)]), 2);
});


import { allModules, lessonStars as starsFor, lessonToConfig, moduleView, nextDot } from './path';
import { LESSONS, lessonsForStage } from '../data/path';
import { LEVEL_STAGES } from '../data/curriculum';
import { seriesPassed, buildSeriesProblems } from './seriesRules';
import { nearMiss, distinctAnswers } from './games';
import { pl, toGapProblem, toStoryProblem, createProblem, inTables } from './problemGenerator';

test('Ścieżka: każdy moduł ma 2–4 kropki + test, id unikalne', () => {
  const ids = LESSONS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const st of LEVEL_STAGES) {
    const n = lessonsForStage(st.id).length;
    assert.ok(n >= 2 && n <= 4, `${st.id}: ${n} kropek`);
  }
});

test('Ścieżka: zaliczony etap = zaliczone kropki (nikt nie traci postępu)', () => {
  const p = { completedStageIds: ['stage-1', 'stage-2'], unlockedStageIds: ['stage-1'], completedLessonIds: [] };
  const m1 = moduleView(p, 'stage-1');
  assert.ok(m1.done && m1.lessons.every((l) => l.state === 'done'));
  const m3 = moduleView(p, 'stage-3');
  assert.ok(m3.open && !m3.done);
  assert.equal(m3.lessons[0].state, 'open');
  assert.equal(m3.lessons[1].state, 'locked');
  assert.equal(m3.testState, 'locked');
  assert.equal(nextDot(p)?.lesson?.id, 's3-l1');
  // Aga: wszystkie stare etapy zaliczone → Most do Ligi jako nowy moduł
  const aga = { completedStageIds: LEVEL_STAGES.filter((s) => s.id !== 'stage-bridge').map((s) => s.id), unlockedStageIds: ['stage-1'] };
  assert.equal(nextDot(aga)?.stageId, 'stage-bridge');
  assert.ok(allModules(aga).filter((m) => m.done).length === LEVEL_STAGES.length - 1);
});

test('Ścieżka: po wszystkich kropkach otwiera się test', () => {
  const p = { completedStageIds: [], unlockedStageIds: ['stage-1'], completedLessonIds: lessonsForStage('stage-1').map((l) => l.id) };
  assert.equal(moduleView(p, 'stage-1').testState, 'open');
  assert.equal(nextDot(p)?.lesson, undefined);
  assert.equal(nextDot(p)?.stageId, 'stage-1');
});

test('Kropki: konfiguracja serii zgodna z rodzajem', () => {
  const byKind = (k: string) => LESSONS.find((l) => l.kind === k)!;
  assert.equal(lessonToConfig(byKind('gap')).gap, true);
  assert.equal(lessonToConfig(byKind('story')).story, true);
  assert.equal(lessonToConfig(byKind('truefalse')).game, 'truefalse');
  assert.equal(lessonToConfig(byKind('pairs')).game, 'pairs');
  const race = lessonToConfig(byKind('race'));
  assert.ok(race.timeLimitSec && race.passMinCorrect);
  assert.ok(lessonToConfig(byKind('learn')).intro);
});

test('Zaliczenie serii: wyścig, zwykła, wolny trening', () => {
  const a = (ok: boolean) => ({ isCorrect: ok, timeMs: 2000 });
  const race = { title: 'r', mode: 'mixed' as const, maxRange: 100, taskCount: 80, timeLimitSec: 60, passMinCorrect: 3, passAccuracyPct: 75 };
  assert.equal(seriesPassed(race, [a(true), a(true), a(true), a(false)]), true);
  assert.equal(seriesPassed(race, [a(true), a(true)]), false);
  assert.equal(seriesPassed({ title: 's', mode: 'mul', maxRange: 100, taskCount: 4, passAccuracyPct: 75 }, [a(true), a(true), a(false), a(false)]), false);
  assert.equal(seriesPassed({ title: 'f', mode: 'mul', maxRange: 100, taskCount: 4, free: true }, [a(false)]), true);
  assert.equal(starsFor({ accuracyPct: 100, avgTimeMs: 2000, correctTasks: 10, passedThreshold: true }), 3);
  assert.equal(starsFor({ accuracyPct: 80, avgTimeMs: 2000, correctTasks: 8, passedThreshold: true }), 1);
});

test('Zadania: filtr tabliczek, luka, historyjka, odmiana', () => {
  const series = buildSeriesProblems({ title: 't', mode: 'mul', maxRange: 100, taskCount: 10, tables: [7, 8] }, {});
  assert.ok(series.every((p) => inTables(p, [7, 8])), 'tylko × 7 i × 8');
  const g = toGapProblem(createProblem('mul', 6, 7), () => 0.1);
  assert.equal(g.display, '? × 7 = 42');
  assert.equal(g.answer, 6);
  const gd = toGapProblem(createProblem('div', 56, 8), () => 0.1);
  assert.equal(gd.display, '56 ÷ ? = 7');
  assert.equal(gd.answer, 8);
  const st = toStoryProblem(createProblem('mul', 4, 6), () => 0);
  assert.equal(st.story, 'Każde pudełko ma 6 kredek. Ile kredek jest w 4 pudełkach?');
  assert.equal(st.answer, 24);
  assert.equal(pl(2, 'kredkę', 'kredki', 'kredek'), 'kredki');
  assert.equal(pl(12, 'kredkę', 'kredki', 'kredek'), 'kredek');
  assert.equal(pl(22, 'kredkę', 'kredki', 'kredek'), 'kredki');
});

test('Gry: prawie dobry wynik i pary z różnymi wynikami', () => {
  const p = createProblem('mul', 7, 8);
  for (let i = 0; i < 20; i++) {
    const w = nearMiss(p);
    assert.ok(w !== 56 && w > 0);
  }
  const ps = [createProblem('mul', 2, 6), createProblem('mul', 3, 4), createProblem('mul', 4, 5)];
  assert.deepEqual(distinctAnswers(ps, 3).map((x) => x.answer), [12, 20]);
});
