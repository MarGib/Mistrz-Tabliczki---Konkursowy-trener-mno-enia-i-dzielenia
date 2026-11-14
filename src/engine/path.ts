/**
 * Logika ścieżki z kropkami: co jest zaliczone, co otwarte, ile gwiazdek, jaki następny krok.
 * Zaliczony etap (moduł) = wszystkie jego kropki uznane za zaliczone (nikt nie traci postępu).
 */
import { LEVEL_STAGES } from '../data/curriculum';
import { type LessonDef, findLesson, lessonsForStage } from '../data/path';
import type { ActiveSeriesConfig, FactMemory, SessionRecord, UserProfile } from '../types/math';
import { getDifficultFacts } from './spacedRepetition';

type PathProfile = Pick<UserProfile, 'completedStageIds' | 'unlockedStageIds' | 'completedLessonIds' | 'lessonStars'>;

export type DotState = 'done' | 'open' | 'locked';

export interface ModuleView {
  stageId: string;
  lessons: { def: LessonDef; state: DotState; stars: number }[];
  testState: DotState;
  /** Test zaliczony (moduł ukończony). */
  done: boolean;
  /** Moduł dostępny (poprzedni zaliczony albo odblokowany). */
  open: boolean;
  doneCount: number;
  total: number;
  stars: number;
  maxStars: number;
}

export function isLessonDone(p: PathProfile, lesson: LessonDef): boolean {
  return p.completedStageIds.includes(lesson.stageId) || (p.completedLessonIds ?? []).includes(lesson.id);
}

export function moduleView(p: PathProfile, stageId: string): ModuleView {
  const stage = LEVEL_STAGES.find((s) => s.id === stageId)!;
  const prev = LEVEL_STAGES.find((s) => s.order === stage.order - 1);
  const done = p.completedStageIds.includes(stageId);
  const open = done || p.unlockedStageIds.includes(stageId) || !prev || p.completedStageIds.includes(prev.id);
  const defs = lessonsForStage(stageId);
  let blocked = !open;
  const lessons = defs.map((def) => {
    const ld = isLessonDone(p, def);
    const state: DotState = ld ? 'done' : blocked ? 'locked' : 'open';
    if (!ld) blocked = true; // kolejne kropki czekają na tę
    return { def, state, stars: p.lessonStars?.[def.id] ?? (ld ? 1 : 0) };
  });
  const allLessonsDone = lessons.every((l) => l.state === 'done');
  const testState: DotState = done ? 'done' : open && allLessonsDone ? 'open' : 'locked';
  const doneCount = lessons.filter((l) => l.state === 'done').length + (done ? 1 : 0);
  return {
    stageId,
    lessons,
    testState,
    done,
    open,
    doneCount,
    total: lessons.length + 1,
    stars: lessons.reduce((s, l) => s + l.stars, 0),
    maxStars: lessons.length * 3,
  };
}

export function allModules(p: PathProfile): ModuleView[] {
  return [...LEVEL_STAGES].sort((a, b) => a.order - b.order).map((s) => moduleView(p, s.id));
}

/** Następna kropka do zrobienia (albo test modułu). */
export function nextDot(p: PathProfile): { stageId: string; lesson?: LessonDef } | null {
  for (const m of allModules(p)) {
    if (!m.open || m.done) continue;
    const l = m.lessons.find((x) => x.state === 'open');
    if (l) return { stageId: m.stageId, lesson: l.def };
    if (m.testState === 'open') return { stageId: m.stageId };
  }
  return null;
}

/** Konfiguracja serii dla kropki. Gry (prawda/fałsz, pary) używają tych samych pól. */
export function lessonToConfig(lesson: LessonDef, memories: Record<string, FactMemory> = {}): ActiveSeriesConfig {
  const maxRange = lesson.maxRange ?? 100;
  const base: ActiveSeriesConfig = {
    title: lesson.title,
    mode: lesson.mode,
    maxRange,
    taskCount: lesson.taskCount ?? 8,
    tables: lesson.tables,
    lessonId: lesson.id,
    passAccuracyPct: lesson.passPct ?? (lesson.kind === 'learn' ? 70 : 75),
    intro: lesson.intro,
  };
  switch (lesson.kind) {
    case 'gap':
      return { ...base, gap: true };
    case 'story':
      return { ...base, story: true };
    case 'race':
      return { ...base, taskCount: 80, timeLimitSec: lesson.timeLimitSec ?? 60, passMinCorrect: lesson.minCorrect ?? 12 };
    case 'truefalse':
      return { ...base, game: 'truefalse', taskCount: 60, timeLimitSec: lesson.timeLimitSec ?? 60, passAccuracyPct: 80, passMinCorrect: 10, intro: undefined };
    case 'pairs':
      return { ...base, game: 'pairs', taskCount: lesson.pairs ?? 6, timeLimitSec: lesson.timeLimitSec, passAccuracyPct: 60, intro: undefined };
    case 'hard': {
      const hard = getDifficultFacts(memories, 12).map((m) => m.id);
      return { ...base, focusFactIds: hard.length > 0 ? hard : undefined };
    }
    default:
      return base;
  }
}

/** Gwiazdki za kropkę: 1 = zaliczona, 2 = ≥ 90%, 3 = ≥ 90% i szybko (albo wyścig z dużym zapasem). */
export function lessonStars(session: Pick<SessionRecord, 'accuracyPct' | 'avgTimeMs' | 'correctTasks' | 'passedThreshold'>, cfg?: Pick<ActiveSeriesConfig, 'passMinCorrect' | 'timeLimitSec'>): number {
  if (!session.passedThreshold) return 0;
  if (cfg?.passMinCorrect && cfg.timeLimitSec) {
    const r = session.correctTasks / cfg.passMinCorrect;
    return r >= 1.5 && session.accuracyPct >= 90 ? 3 : r >= 1.25 ? 2 : 1;
  }
  if (session.accuracyPct >= 90 && session.avgTimeMs > 0 && session.avgTimeMs <= 4000) return 3;
  if (session.accuracyPct >= 90) return 2;
  return 1;
}

export function lessonFromSession(session: Pick<SessionRecord, 'lessonId'>): LessonDef | undefined {
  return session.lessonId ? findLesson(session.lessonId) : undefined;
}

/** Ile nowych kropek zaliczono dziś (do łagodnej podpowiedzi „na dziś super”). */
export function lessonsDoneToday(sessions: Pick<SessionRecord, 'timestamp' | 'lessonId' | 'passedThreshold'>[], now = Date.now()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const ids = new Set(sessions.filter((s) => s.lessonId && s.passedThreshold && s.timestamp >= start.getTime()).map((s) => s.lessonId));
  return ids.size;
}

export const SUGGESTED_LESSONS_PER_DAY = 3;
