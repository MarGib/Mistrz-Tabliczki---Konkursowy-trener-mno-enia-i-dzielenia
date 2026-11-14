/**
 * Wyzwanie Mistrza — poziomy bez końca, dobierane do statystyk gracza.
 *
 * Każdy poziom ustala zakres liczb, liczbę zadań, próg celności i limit średniego czasu.
 * Limit czasu wynika z dotychczasowego tempa gracza w podobnym zakresie (trochę ambitniej),
 * więc szybki gracz dostaje trudniejsze wyzwanie niż początkujący. Zaliczenie = awans o poziom.
 */
import type { ActiveSeriesConfig, OperationMode, UserProfile } from '../types/math';

const RANGES = [100, 100, 144, 144, 200, 200, 300, 300, 500, 500, 1000];
const MODES: OperationMode[] = ['mixed', 'mul', 'div'];

/** Bazowy „rozsądny” czas na zadanie dla zakresu (gdy brak danych gracza). */
function baseSecForRange(range: number): number {
  if (range <= 100) return 4;
  if (range <= 144) return 4.8;
  if (range <= 200) return 6;
  if (range <= 300) return 7;
  if (range <= 500) return 8;
  return 9;
}

export interface MasterChallenge {
  level: number;
  config: ActiveSeriesConfig;
  maxRange: number;
  taskCount: number;
  passAccuracyPct: number;
  targetAvgTimeSec: number;
  rewardXp: number;
  modeLabel: string;
}

/** Średni czas na zadanie z ostatnich serii w zbliżonym zakresie (s) — lub null. */
function recentTempo(profile: UserProfile, range: number): number | null {
  const near = (profile.sessions ?? [])
    .filter((s) => s.totalTasks > 0 && s.avgTimeMs > 0)
    .filter((s) => {
      const r = s.maxRange ?? 100;
      return range <= 100 ? r <= 100 : r > 100 && r <= range * 2;
    })
    .slice(-6);
  if (near.length < 2) return null;
  return near.reduce((sum, s) => sum + s.avgTimeMs, 0) / near.length / 1000;
}

export function buildMasterChallenge(profile: UserProfile): MasterChallenge {
  const level = Math.max(1, (profile.masterLevel ?? 0) + 1);
  const idx = level - 1;
  const maxRange = RANGES[Math.min(idx, RANGES.length - 1)];
  const mode = MODES[idx % MODES.length];
  const taskCount = Math.min(30, 12 + Math.floor(idx * 1.5));
  const passAccuracyPct = Math.min(96, 85 + Math.floor(idx / 2));

  // Limit czasu: tempo gracza − 5% (min. 1,6 s), ale nie łagodniej niż bazowy limit dla zakresu;
  // od poziomu 12 w górę limit ściska się dodatkowo o 3% na poziom.
  const base = baseSecForRange(maxRange);
  const tempo = recentTempo(profile, maxRange);
  let target = tempo ? Math.min(base, tempo * 0.95) : base;
  if (idx >= RANGES.length) target *= Math.pow(0.97, idx - RANGES.length + 1);
  const targetAvgTimeSec = Math.max(1.6, Math.round(target * 10) / 10);

  const rewardXp = 150 + idx * 40;
  const modeLabel = mode === 'mul' ? 'Mnożenie' : mode === 'div' ? 'Dzielenie' : 'Mnożenie i dzielenie';

  return {
    level,
    maxRange,
    taskCount,
    passAccuracyPct,
    targetAvgTimeSec,
    rewardXp,
    modeLabel,
    config: {
      title: `Wyzwanie Mistrza — poziom ${level}`,
      mode,
      maxRange,
      taskCount,
      passAccuracyPct,
      targetAvgTimeSec,
      masterLevel: level,
    },
  };
}

/** Czy seria Wyzwania Mistrza została zaliczona (celność i średni czas). */
export function isMasterChallengePassed(
  accuracyPct: number,
  avgTimeMs: number,
  passAccuracyPct: number,
  targetAvgTimeSec: number
): boolean {
  return accuracyPct >= passAccuracyPct && avgTimeMs / 1000 <= targetAvgTimeSec + 0.05;
}
