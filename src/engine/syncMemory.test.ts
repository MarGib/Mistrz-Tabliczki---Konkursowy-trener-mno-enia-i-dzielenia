import assert from 'node:assert/strict';
import test from 'node:test';
import { type KeyValueStorage, checkedRecently, forgetChecked, loadPushedFps, markChecked, savePushedFp } from './syncMemory';

function memStorage(): KeyValueStorage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

test('syncMemory: odciski konta i kart przetrwają ponowne uruchomienie i można je zapomnieć', () => {
  const s = memStorage();
  savePushedFp('acc', 'p1', 'fpA', s);
  savePushedFp('card', 'p1', 'cardA', s);
  savePushedFp('acc', 'p2', 'fpB', s);
  assert.deepEqual([...loadPushedFps('acc', s)], [['p1', 'fpA'], ['p2', 'fpB']]);
  assert.deepEqual([...loadPushedFps('card', s)], [['p1', 'cardA']]);
  savePushedFp('acc', 'p1', null, s);
  assert.equal(loadPushedFps('acc', s).has('p1'), false);
  assert.equal(loadPushedFps('card', s).get('p1'), 'cardA');
});

test('syncMemory: „sprawdzone niedawno” wygasa po czasie i po zapomnieniu', () => {
  const s = memStorage();
  const t0 = 1_000_000;
  assert.equal(checkedRecently('k', 60_000, t0, s), false);
  markChecked('k', t0, s);
  assert.equal(checkedRecently('k', 60_000, t0 + 59_000, s), true);
  assert.equal(checkedRecently('k', 60_000, t0 + 61_000, s), false);
  forgetChecked('k', s);
  assert.equal(checkedRecently('k', 60_000, t0 + 1, s), false);
});

test('syncMemory: uszkodzone dane w pamięci nie psują aplikacji', () => {
  const s = memStorage();
  s.setItem('mt_sync_fp', '{zepsute');
  s.setItem('mt_sync_checked', 'null');
  assert.equal(loadPushedFps('acc', s).size, 0);
  assert.equal(checkedRecently('k', 1000, 5000, s), false);
});
