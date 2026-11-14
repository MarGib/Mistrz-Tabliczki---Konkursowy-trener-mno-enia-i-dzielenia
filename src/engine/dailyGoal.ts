/**
 * Cel dnia (ustawia rodzic w Koncie): ile serii dziennie. 0 = wyłączony.
 * Dzień liczony wg czasu urządzenia, od północy.
 */
import type { SessionRecord } from '../types/math';

export const DEFAULT_DAILY_GOAL = 3;

export function seriesToday(sessions: Pick<SessionRecord, 'timestamp'>[], now = Date.now()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const from = start.getTime();
  return sessions.filter((s) => s.timestamp >= from && s.timestamp <= now).length;
}

export interface DailyGoalState {
  goal: number;
  done: number;
  complete: boolean;
  pct: number;
}

export function dailyGoalState(sessions: Pick<SessionRecord, 'timestamp'>[], goal: number | undefined, now = Date.now()): DailyGoalState | null {
  const g = goal ?? DEFAULT_DAILY_GOAL;
  if (!g) return null;
  const done = seriesToday(sessions, now);
  return { goal: g, done, complete: done >= g, pct: Math.min(100, Math.round((done / g) * 100)) };
}
