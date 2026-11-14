/**
 * „Graj dalej” — jeden przycisk, który sam wybiera najlepszy następny krok:
 *  1. powtórki zaplanowane na dziś (gdy są co najmniej 3) — utrwalenie ma pierwszeństwo,
 *  2. następna kropka na ścieżce (albo test modułu),
 *  3. Wyzwanie Mistrza (gdy ścieżka ukończona).
 */
import { LEVEL_STAGES } from '../data/curriculum';
import type { ActiveSeriesConfig, LevelStage, UserProfile } from '../types/math';
import { buildMasterChallenge } from './masterChallenge';
import { buildReviewCalendar, formatFactPrompt } from './reviewCalendar';
import { KIND_META, lessonsForStage as LESSONS_FOR } from '../data/path';
import { lessonToConfig, nextDot } from './path';

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
    tables: stage.tables,
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
  const dot = nextDot(profile);
  if (dot) {
    const stage = LEVEL_STAGES.find((s) => s.id === dot.stageId)!;
    if (dot.lesson) {
      const meta = KIND_META[dot.lesson.kind];
      return {
        kind: 'stage',
        label: `${meta.emoji} ${dot.lesson.title}`,
        detail: `${stage.title} · ${meta.label}`,
        config: lessonToConfig(dot.lesson, profile.memories),
      };
    }
    return {
      kind: 'stage',
      label: `🏆 Test modułu: ${stage.title}`,
      detail: `${stage.taskCount} zadań · zalicza ${stage.passAccuracyPct}% poprawnych`,
      config: stageToConfig(stage),
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

/** Następny krok ŚCIEŻKI (bez powtórek i Wyzwania) — do przycisku „Dalej po ścieżce”. */
export interface PathStep {
  config: ActiveSeriesConfig;
  emoji: string;
  kindLabel: string;
  label: string;
  stageId: string;
  stageTitle: string;
  /** Numer kropki w module (1…) i liczba kropek z testem. */
  position: number;
  total: number;
  isTest: boolean;
}

export function nextPathStep(profile: UserProfile): PathStep | null {
  const dot = nextDot(profile);
  if (!dot) return null;
  const stage = LEVEL_STAGES.find((s) => s.id === dot.stageId)!;
  const lessons = LESSONS_FOR(stage.id);
  const total = lessons.length + 1;
  if (dot.lesson) {
    const meta = KIND_META[dot.lesson.kind];
    return {
      config: lessonToConfig(dot.lesson, profile.memories),
      emoji: meta.emoji,
      kindLabel: meta.label,
      label: dot.lesson.title,
      stageId: stage.id,
      stageTitle: stage.title,
      position: lessons.findIndex((l) => l.id === dot.lesson!.id) + 1,
      total,
      isTest: false,
    };
  }
  return {
    config: stageToConfig(stage),
    emoji: '🏆',
    kindLabel: 'Test modułu',
    label: `Test modułu: ${stage.title}`,
    stageId: stage.id,
    stageTitle: stage.title,
    position: total,
    total,
    isTest: true,
  };
}
