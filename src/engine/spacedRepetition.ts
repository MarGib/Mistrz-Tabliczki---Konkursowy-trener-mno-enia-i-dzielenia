import type {
  FactMemory,
  MasteryLevel,
  MathProblem,
  MedalTier,
  TournamentDef,
} from '../types/math';

export const FAST_THRESHOLD_MS = 2800;
export const STEADY_THRESHOLD_MS = 6000;

export function createInitialMemory(problem: MathProblem, now = Date.now()): FactMemory {
  return {
    id: problem.id,
    op: problem.op,
    a: problem.a,
    b: problem.b,
    answer: problem.answer,
    easiness: 2.5,
    intervalDays: 0,
    repetitions: 0,
    nextReviewAt: now,
    attempts: 0,
    correctCount: 0,
    wrongCount: 0,
    totalTimeMs: 0,
    avgTimeMs: 0,
    lastTimeMs: 0,
    lastSeenAt: 0,
    mastery: 'nowe',
  };
}

/**
 * Computes SM-2 quality score (0..5) from correctness, response speed, and hint usage.
 */
export function computeResponseQuality(
  isCorrect: boolean,
  timeMs: number,
  usedHint: boolean
): number {
  if (!isCorrect) {
    return 1;
  }
  if (usedHint) {
    return 3;
  }
  if (timeMs <= FAST_THRESHOLD_MS) {
    return 5;
  }
  if (timeMs <= STEADY_THRESHOLD_MS) {
    return 4;
  }
  return 3;
}

/**
 * Classifies mastery level so the user sees which facts are mastered ("na wyrywki") vs difficult/slow.
 */
export function classifyMastery(memory: {
  attempts: number;
  correctCount: number;
  wrongCount: number;
  repetitions: number;
  avgTimeMs: number;
  easiness: number;
}): MasteryLevel {
  if (memory.attempts === 0) return 'nowe';

  const errorRate = memory.wrongCount / memory.attempts;
  if (errorRate > 0.25 || (memory.wrongCount > 0 && memory.repetitions === 0)) {
    return 'trudne';
  }
  if (
    memory.repetitions >= 3 &&
    memory.avgTimeMs > 0 &&
    memory.avgTimeMs <= FAST_THRESHOLD_MS &&
    memory.easiness >= 2.35
  ) {
    return 'mistrzowskie';
  }
  if (memory.repetitions >= 2 && memory.avgTimeMs <= STEADY_THRESHOLD_MS) {
    return 'opanowane';
  }
  return 'w_trakcie';
}

/**
 * Updates a FactMemory record using an adapted SM-2 spaced repetition algorithm.
 * Difficult or slow facts receive shorter intervals and lower easiness so they resurface more often.
 */
export function updateFactMemory(
  existing: FactMemory | undefined,
  problem: MathProblem,
  isCorrect: boolean,
  timeMs: number,
  usedHint: boolean,
  now = Date.now()
): { updated: FactMemory; quality: number } {
  const base = existing ?? createInitialMemory(problem, now);
  const clampedTime = Math.max(250, Math.min(timeMs, 60000));
  const quality = computeResponseQuality(isCorrect, clampedTime, usedHint);

  let repetitions = base.repetitions;
  let intervalDays = base.intervalDays;

  if (quality < 3) {
    repetitions = 0;
    // Schedule quick review (within ~2 minutes for immediate session/day reinforcement)
    intervalDays = 0.0015;
  } else {
    if (repetitions === 0) {
      intervalDays = quality === 5 ? 1 : 0.25;
    } else if (repetitions === 1) {
      intervalDays = quality === 5 ? 4 : 1.5;
    } else {
      intervalDays = Number((base.intervalDays * base.easiness).toFixed(2));
    }
    repetitions += 1;
  }

  const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const easiness = Number(Math.max(1.3, Math.min(2.8, base.easiness + efDelta)).toFixed(2));

  const attempts = base.attempts + 1;
  const correctCount = base.correctCount + (isCorrect ? 1 : 0);
  const wrongCount = base.wrongCount + (isCorrect ? 0 : 1);
  const totalTimeMs = base.totalTimeMs + clampedTime;
  const avgTimeMs = Math.round(totalTimeMs / attempts);

  const nextReviewAt = now + Math.round(intervalDays * 24 * 60 * 60 * 1000);

  const mastery = classifyMastery({
    attempts,
    correctCount,
    wrongCount,
    repetitions,
    avgTimeMs,
    easiness,
  });

  return {
    quality,
    updated: {
      ...base,
      easiness,
      intervalDays,
      repetitions,
      nextReviewAt,
      attempts,
      correctCount,
      wrongCount,
      totalTimeMs,
      avgTimeMs,
      lastTimeMs: clampedTime,
      lastSeenAt: now,
      mastery,
    },
  };
}

/**
 * Calculates points for a single problem attempt including speed bonus and combo multiplier.
 */
export function calculateTaskPoints(
  isCorrect: boolean,
  timeMs: number,
  usedHint: boolean,
  currentStreak: number
): number {
  if (!isCorrect) return 0;
  const base = 10;
  const speedBonus = !usedHint && timeMs <= FAST_THRESHOLD_MS ? 8 : timeMs <= STEADY_THRESHOLD_MS ? 4 : 0;
  const hintPenalty = usedHint ? -3 : 0;
  const streakBonus = Math.min(10, Math.floor(currentStreak / 2) * 2);
  return Math.max(5, base + speedBonus + hintPenalty + streakBonus);
}

/**
 * Computes difficulty score for sorting facts from hardest/slowest to easiest.
 */
export function getDifficultyScore(mem: FactMemory): number {
  if (mem.attempts === 0) return 0;
  const errorRatio = mem.wrongCount / mem.attempts;
  const timeWeight = Math.min(mem.avgTimeMs / 1000, 15) * 4;
  const efPenalty = (2.8 - mem.easiness) * 35;
  const masteryPenalty = mem.mastery === 'trudne' ? 50 : mem.mastery === 'w_trakcie' ? 20 : 0;
  return Math.round(errorRatio * 120 + timeWeight + efPenalty + masteryPenalty);
}

export function getDifficultFacts(
  memories: Record<string, FactMemory>,
  limit = 12
): FactMemory[] {
  return Object.values(memories)
    .filter((m) => m.attempts > 0)
    .sort((a, b) => getDifficultyScore(b) - getDifficultyScore(a))
    .slice(0, limit);
}

export function getSlowestFacts(
  memories: Record<string, FactMemory>,
  limit = 8
): FactMemory[] {
  return Object.values(memories)
    .filter((m) => m.attempts > 0)
    .sort((a, b) => b.avgTimeMs - a.avgTimeMs)
    .slice(0, limit);
}

export function getDueFactCount(
  memories: Record<string, FactMemory>,
  now = Date.now()
): number {
  return Object.values(memories).filter(
    (m) => m.attempts > 0 && (m.nextReviewAt <= now || m.mastery === 'trudne')
  ).length;
}

export function checkStagePass(
  correctTasks: number,
  totalTasks: number,
  passAccuracyPct: number
): { accuracyPct: number; passed: boolean } {
  const accuracyPct = totalTasks > 0 ? Math.round((correctTasks / totalTasks) * 100) : 0;
  return {
    accuracyPct,
    passed: accuracyPct >= passAccuracyPct,
  };
}

export function computeTournamentMedal(
  tournament: TournamentDef,
  accuracyPct: number,
  totalTimeSec: number
): MedalTier {
  if (accuracyPct < tournament.passAccuracyPct) return 'brak';
  if (accuracyPct === 100 && totalTimeSec <= tournament.goldTimeSec) return 'puchar';
  if (totalTimeSec <= tournament.goldTimeSec) return 'zloto';
  if (totalTimeSec <= tournament.silverTimeSec) return 'srebro';
  if (totalTimeSec <= tournament.bronzeTimeSec) return 'braz';
  return 'braz';
}

export function computeUserLevel(xp: number): {
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
} {
  const tiers = [
    { minXp: 0, title: 'Adept Rachunków' },
    { minXp: 150, title: 'Łowca Tabliczki' },
    { minXp: 400, title: 'Szybki Kalkulator' },
    { minXp: 800, title: 'Mistrz Działań' },
    { minXp: 1400, title: 'Finalista Konkursu' },
    { minXp: 2200, title: 'Arcymistrz Matematyki' },
    { minXp: 3500, title: 'Legenda Tabliczki' },
  ];

  let level = 1;
  let title = tiers[0].title;
  let currentFloor = 0;
  let nextTarget = tiers[1].minXp;

  for (let i = 0; i < tiers.length; i++) {
    if (xp >= tiers[i].minXp) {
      level = i + 1;
      title = tiers[i].title;
      currentFloor = tiers[i].minXp;
      nextTarget = tiers[i + 1] ? tiers[i + 1].minXp : tiers[i].minXp + 1000;
    }
  }

  const span = Math.max(1, nextTarget - currentFloor);
  const progressPct = Math.min(100, Math.round(((xp - currentFloor) / span) * 100));

  return {
    level,
    title,
    currentLevelXp: xp - currentFloor,
    nextLevelXp: span,
    progressPct,
  };
}
