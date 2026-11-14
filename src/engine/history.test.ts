import assert from 'node:assert/strict';
import test from 'node:test';
import type { SessionRecord } from '../types/math';
import { groupByMonth, liteToRecord, mergeLite, monthKey, toLite } from './history';

const sess = (id: string, t: number, extra: Partial<SessionRecord> = {}): SessionRecord =>
  ({
    id,
    timestamp: t,
    mode: 'mul',
    seriesTitle: 'Test',
    totalTasks: 10,
    correctTasks: 9,
    accuracyPct: 90,
    totalTimeMs: 25_000,
    avgTimeMs: 2500,
    pointsEarned: 50,
    passedThreshold: true,
    attempts: [],
    ...extra,
  }) as SessionRecord;

test('historia: skrót serii, łączenie bez powtórek i podział na miesiące', () => {
  const a = toLite(sess('s1', Date.UTC(2026, 9, 31, 12), { lessonId: 's1-l2' }));
  const b = toLite(sess('s2', Date.UTC(2026, 10, 2, 12), { masterLevel: 3 }));
  assert.equal(a.kind, 'lesson');
  assert.equal(a.ref, 's1-l2');
  assert.equal(b.kind, 'master');
  assert.equal(b.lvl, 3);
  const merged = mergeLite([b, a], [a]);
  assert.deepEqual(merged.map((s) => s.id), ['s1', 's2']);
  assert.deepEqual([...groupByMonth(merged).keys()], [monthKey(a.t), monthKey(b.t)]);
  const back = liteToRecord(b);
  assert.equal(back.accuracyPct, 90);
  assert.equal(back.masterLevel, 3);
  // ten sam skrót z tej samej serii = identyczny obiekt (arrayUnion w bazie nie zdubluje)
  assert.deepEqual(toLite(sess('s1', Date.UTC(2026, 9, 31, 12), { lessonId: 's1-l2' })), a);
});
