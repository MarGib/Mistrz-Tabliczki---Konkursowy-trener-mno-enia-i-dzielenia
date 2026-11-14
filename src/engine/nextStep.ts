/**
 * „Graj dalej” — jeden przycisk, który sam wybiera najlepszy następny krok:
 *  1. powtórki zaplanowane na dziś (gdy są co najmniej 3) — utrwalenie ma pierwszeństwo,
 *  2. następny otwarty etap Ścieżki Mistrza,
 *  3. Wyzwanie Mistrza (gdy ścieżka ukończona).
 */
import { LEVEL_STAGES } from '../data/curriculum';
import type { ActiveSeriesConfig, LevelStage, UserProfile } from '../types/math';
import { buildMasterChallenge } from './masterChallenge';
import { buildReviewCalendar, formatFactPrompt } from './reviewCalendar';

export type StageState = 'done' | 'open' | 'locked';

export function stageStatus(profile: Pick<UserProfile, 'completedStageIds' | 'unlockedStageIds'>): Map<string, StageState> {
  const map = new Map<string, StageState>();
  for (const st of LEVEL_STAGES) {
    const prev = LEVEL_STAGES.find((s) => s.order === st.order - 1);
    const done = profile.completedStageIds.includes(st.id);
    const open = profile.unlockedStageIds.includes(st.id) || Boolean(prev && profile.completedStageIds.includes(prev.id));
    map.set(st.id, done ? 'done' : open ? 'open' : 'locked');
  }
  return map;
}

export function stageToConfig(stage: LevelStage): ActiveSeriesConfig {
  return {
    title: stage.title,
    mode: stage.mode,
    maxRange: stage.maxRange,
    taskCount: stage.taskCount,
    stageId: stage.id,
    passAccuracyPct: stage.passAccuracyPct,
    targetAvgTimeSec: stage.targetAvgTimeSec,
  };
}

export interface NextStep {
  kind: 'review' | 'stage' | 'master';
  label: string;
  detail: string;
  config: ActiveSeriesConfig;
}

export const MIN_DUE_FOR_REVIEW = 3;

export function chooseNextStep(profile: UserProfile, now = Date.now()): NextStep {
  const calendar = buildReviewCalendar(profile.memories, now);
  const due = calendar.dueNow;
  if (due.length >= MIN_DUE_FOR_REVIEW) {
    const ids = due.slice(0, 10).map((f) => f.id);
    const sample = due
      .slice(0, 3)
      .map((f) => formatFactPrompt(f))
      .join(', ');
    return {
      kind: 'review',
      label: 'Rozgrzewka: powtórki na dziś',
      detail: `${due.length} ${due.length >= 5 ? 'działań' : 'działania'} do utrwalenia, m.in. ${sample}`,
      config: {
        title: 'Rozgrzewka — powtórki na dziś',
        mode: 'mixed',
        maxRange: Math.max(100, profile.settings.maxRange),
        taskCount: Math.max(8, Math.min(12, ids.length + 2)),
        focusFactIds: ids,
      },
    };
  }
  const status = stageStatus(profile);
  const next = LEVEL_STAGES.find((s) => status.get(s.id) === 'open');
  if (next) {
    return {
      kind: 'stage',
      label: `Etap ${next.order}: ${next.title}`,
      detail: `${next.taskCount} zadań · zalicza ${next.passAccuracyPct}% poprawnych`,
      config: stageToConfig(next),
    };
  }
  const ch = buildMasterChallenge(profile);
  return {
    kind: 'master',
    label: `Wyzwanie Mistrza — poziom ${ch.level}`,
    detail: `${ch.taskCount} zadań · ${ch.modeLabel} do ${ch.maxRange} · cel ${ch.targetAvgTimeSec} s na zadanie`,
    config: ch.config,
  };
}
