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
  assert.equal(s.config.stageId, p.unlockedStageIds[0] ?? s.config.stageId);
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
