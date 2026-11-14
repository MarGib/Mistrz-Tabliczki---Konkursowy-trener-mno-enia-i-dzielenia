/**
 * Wspólne reguły serii: jak zbudować zadania i kiedy seria jest zaliczona.
 */
import type { ActiveSeriesConfig, FactMemory, MathProblem, TaskAttempt } from '../types/math';
import { isMasterChallengePassed } from './masterChallenge';
import { selectAdaptiveSeries, toGapProblem, toStoryProblem } from './problemGenerator';

export function buildSeriesProblems(config: ActiveSeriesConfig, memories: Record<string, FactMemory>, rng: () => number = Math.random): MathProblem[] {
  const base = selectAdaptiveSeries({
    mode: config.mode,
    maxRange: config.maxRange,
    count: config.taskCount,
    memories,
    focusFactIds: config.focusFactIds,
    tables: config.tables,
    rng,
  });
  if (config.gap) return base.map((p) => toGapProblem(p, rng));
  if (config.story) return base.map((p) => toStoryProblem(p, rng));
  return base;
}

export function seriesPassed(config: ActiveSeriesConfig, attempts: Pick<TaskAttempt, 'isCorrect' | 'timeMs'>[]): boolean {
  if (config.free) return true;
  const n = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const acc = n > 0 ? Math.round((correct / n) * 100) : 0;
  if (config.passMinCorrect) {
    return correct >= config.passMinCorrect && acc >= (config.passAccuracyPct ?? 0);
  }
  if (config.masterLevel) {
    const avg = n > 0 ? attempts.reduce((s, a) => s + a.timeMs, 0) / n : 0;
    return isMasterChallengePassed(acc, avg, config.passAccuracyPct ?? 85, config.targetAvgTimeSec ?? 99);
  }
  if (n === 0) return false;
  return config.passAccuracyPct ? acc >= config.passAccuracyPct : true;
}

import type { SessionRecord } from '../types/math';

/** Zapis serii (wspólny dla zwykłej serii i gier). */
export function makeSession(config: ActiveSeriesConfig, attempts: TaskAttempt[]): SessionRecord {
  const totalTimeMs = attempts.reduce((s, a) => s + a.timeMs, 0);
  const correctTasks = attempts.filter((a) => a.isCorrect).length;
  const accuracyPct = attempts.length > 0 ? Math.round((correctTasks / attempts.length) * 100) : 0;
  return {
    id: `sess-${Date.now()}`,
    timestamp: Date.now(),
    mode: config.mode,
    seriesTitle: config.title,
    stageId: config.stageId,
    tournamentId: config.tournamentId,
    lessonId: config.lessonId,
    free: config.free,
    maxRange: config.maxRange,
    masterLevel: config.masterLevel,
    targetAvgTimeSec: config.targetAvgTimeSec,
    totalTasks: attempts.length,
    correctTasks,
    accuracyPct,
    totalTimeMs,
    avgTimeMs: attempts.length > 0 ? Math.round(totalTimeMs / attempts.length) : 0,
    pointsEarned: attempts.reduce((s, a) => s + a.pointsEarned, 0),
    passedThreshold: seriesPassed(config, attempts),
    thresholdPct: config.passAccuracyPct,
    attempts,
  };
}
