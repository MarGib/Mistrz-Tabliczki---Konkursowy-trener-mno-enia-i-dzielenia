/**
 * Ścieżka z kropkami: każdy moduł (etap) ma kilka krótkich kropek od najłatwiejszej do najtrudniejszej,
 * a ostatnią „kropką” jest test modułu (dotychczasowa seria etapu z LEVEL_STAGES).
 *
 * Zasada „bez molocha”: najwyżej 4 kropki + test w module, kropka trwa 2–3 minuty.
 * Identyfikatory kropek są stałe (np. „s1-l2”) — zmiana rodzaju kropki nie kasuje postępu.
 */
import type { LessonIntro, OperationMode } from '../types/math';

export type LessonKind = 'learn' | 'focus' | 'gap' | 'race' | 'truefalse' | 'pairs' | 'story' | 'hard';

export interface LessonDef {
  id: string;
  stageId: string;
  kind: LessonKind;
  title: string;
  mode: OperationMode;
  /** Tabliczki w kropce; brak = cały zakres. */
  tables?: number[];
  maxRange?: number;
  taskCount?: number;
  /** Próg poprawności (domyślnie 75%; „Poznaj” 70%). */
  passPct?: number;
  /** Wyścig / gra na czas. */
  timeLimitSec?: number;
  /** Wyścig: minimum poprawnych. */
  minCorrect?: number;
  /** Pary: liczba par. */
  pairs?: number;
  intro?: LessonIntro;
}

export const KIND_META: Record<LessonKind, { emoji: string; label: string }> = {
  learn: { emoji: '👀', label: 'Poznaj' },
  focus: { emoji: '🎯', label: 'Trening w punkt' },
  gap: { emoji: '❓', label: 'Luka' },
  race: { emoji: '⏱️', label: 'Wyścig z czasem' },
  truefalse: { emoji: '✅', label: 'Prawda czy fałsz' },
  pairs: { emoji: '🧩', label: 'Pary' },
  story: { emoji: '📖', label: 'Historyjka' },
  hard: { emoji: '🔥', label: 'Twoje najtrudniejsze' },
};

const L = (stageId: string, n: number, def: Omit<LessonDef, 'id' | 'stageId'>): LessonDef => ({
  id: `${stageId.replace('stage-', 's')}-l${n}`,
  stageId,
  ...def,
});

export const LESSONS: LessonDef[] = [
  // ── Moduł 1: × 2 i × 10 ──
  L('stage-1', 1, {
    kind: 'learn',
    title: 'Poznaj × 2 i × 10',
    mode: 'mul',
    tables: [2, 10],
    taskCount: 6,
    passPct: 70,
    intro: {
      title: '× 2 i × 10 — dwa najprostsze triki',
      text: 'Mnożenie przez 2 to podwajanie: dodajesz liczbę do niej samej. Mnożenie przez 10 to dopisanie zera na końcu.',
      examples: ['2 × 7 = 7 + 7 = 14', '2 × 9 = 9 + 9 = 18', '10 × 6 = 60', '10 × 8 = 80'],
    },
  }),
  L('stage-1', 2, { kind: 'focus', title: 'Trening × 2 i × 10', mode: 'mul', tables: [2, 10], taskCount: 8 }),
  L('stage-1', 3, { kind: 'pairs', title: 'Pary × 2 i × 10', mode: 'mul', tables: [2, 10], pairs: 5 }),
  L('stage-1', 4, { kind: 'gap', title: 'Luka: × 2 i × 10', mode: 'mul', tables: [2, 10], taskCount: 8 }),

  // ── Moduł 2: × 5 i × 3, dzielenie przez 2, 5, 10 ──
  L('stage-2', 1, {
    kind: 'learn',
    title: 'Poznaj × 5 i × 3',
    mode: 'mul',
    tables: [3, 5],
    taskCount: 6,
    passPct: 70,
    intro: {
      title: '× 5 to połowa z × 10, a × 3 to trzy razy to samo',
      text: 'Żeby pomnożyć przez 5, pomnóż przez 10 i podziel na pół. Żeby pomnożyć przez 3, dodaj liczbę trzy razy (albo: podwój i dodaj jeszcze raz).',
      examples: ['5 × 8 = 80 : 2 = 40', '5 × 7 = 70 : 2 = 35', '3 × 6 = 6 + 6 + 6 = 18', '3 × 9 = 18 + 9 = 27'],
    },
  }),
  L('stage-2', 2, { kind: 'focus', title: 'Trening × 3 i × 5', mode: 'mul', tables: [3, 5], taskCount: 8 }),
  L('stage-2', 3, {
    kind: 'gap',
    title: 'Dzielenie przez 2, 5 i 10',
    mode: 'div',
    tables: [2, 5, 10],
    taskCount: 8,
    intro: {
      title: 'Dzielenie to mnożenie od tyłu',
      text: '40 : 5 pyta: ile razy 5 mieści się w 40? Szukasz liczby, która razy 5 daje 40.',
      examples: ['40 : 5 = 8, bo 8 × 5 = 40', '18 : 2 = 9, bo 9 × 2 = 18', '70 : 10 = 7, bo 7 × 10 = 70'],
    },
  }),
  L('stage-2', 4, { kind: 'truefalse', title: 'Prawda czy fałsz?', mode: 'mixed', tables: [2, 3, 5, 10], timeLimitSec: 60 }),

  // ── Moduł 3: × 4, × 6, × 9 ──
  L('stage-3', 1, {
    kind: 'learn',
    title: 'Poznaj × 4 i × 9',
    mode: 'mul',
    tables: [4, 9],
    taskCount: 6,
    passPct: 70,
    intro: {
      title: '× 4 to podwójne podwojenie, × 9 to „dziesięć minus raz”',
      text: 'Przez 4 mnożysz, podwajając dwa razy. Przez 9: pomnóż przez 10 i odejmij jeden raz tę liczbę. Suma cyfr wyniku × 9 zawsze daje 9!',
      examples: ['4 × 7 = 14 → 28', '4 × 8 = 16 → 32', '9 × 6 = 60 − 6 = 54', '9 × 8 = 80 − 8 = 72 (7 + 2 = 9)'],
    },
  }),
  L('stage-3', 2, { kind: 'focus', title: 'Trening × 4 i × 6', mode: 'mul', tables: [4, 6], taskCount: 8 }),
  L('stage-3', 3, { kind: 'focus', title: 'Trening × 9', mode: 'mul', tables: [9], taskCount: 8 }),
  L('stage-3', 4, {
    kind: 'race',
    title: 'Wyścig: 60 sekund',
    mode: 'mul',
    tables: [2, 3, 4, 5, 6, 9, 10],
    timeLimitSec: 60,
    minCorrect: 12,
  }),

  // ── Moduł 4: × 7 i × 8, całe dzielenie ──
  L('stage-4', 1, {
    kind: 'learn',
    title: 'Poznaj × 7 i × 8',
    mode: 'mul',
    tables: [7, 8],
    taskCount: 6,
    passPct: 70,
    intro: {
      title: 'Najtrudniejsze rozbijamy na łatwe',
      text: '7 × 8 to 5 × 8 i jeszcze 2 × 8. A rymowanka „5, 6, 7, 8” podpowiada: 56 = 7 × 8.',
      examples: ['7 × 8 = 40 + 16 = 56', '7 × 6 = 35 + 7 = 42', '8 × 8 = 40 + 24 = 64', '8 × 6 = 48'],
    },
  }),
  L('stage-4', 2, { kind: 'focus', title: 'Trening × 7 i × 8', mode: 'mul', tables: [7, 8], taskCount: 8 }),
  L('stage-4', 3, { kind: 'pairs', title: 'Pary: dzielenie', mode: 'div', pairs: 6 }),
  L('stage-4', 4, { kind: 'gap', title: 'Luka: dzielenie', mode: 'div', taskCount: 8 }),

  // ── Moduł 5: cała tabliczka razem ──
  L('stage-5', 1, { kind: 'story', title: 'Historyjki', mode: 'mixed', taskCount: 4 }),
  L('stage-5', 2, { kind: 'truefalse', title: 'Prawda czy fałsz: mix', mode: 'mixed', timeLimitSec: 60 }),
  L('stage-5', 3, { kind: 'gap', title: 'Luka: mix', mode: 'mixed', taskCount: 8 }),
  L('stage-5', 4, { kind: 'race', title: 'Wyścig: 60 sekund', mode: 'mixed', timeLimitSec: 60, minCorrect: 14 }),

  // ── Moduł 6: na wyrywki ──
  L('stage-6', 1, { kind: 'hard', title: 'Twoje najtrudniejsze', mode: 'mixed', taskCount: 10 }),
  L('stage-6', 2, { kind: 'race', title: 'Wyścig: 60 sekund', mode: 'mixed', timeLimitSec: 60, minCorrect: 18 }),
  L('stage-6', 3, { kind: 'pairs', title: 'Pary na czas', mode: 'mixed', pairs: 6, timeLimitSec: 60 }),

  // ── Most do Ligi: × 11, × 12, mnożenie dwucyfrowe ──
  L('stage-bridge', 1, {
    kind: 'learn',
    title: 'Poznaj × 11 i × 12',
    mode: 'mul',
    tables: [11, 12],
    maxRange: 144,
    taskCount: 6,
    passPct: 70,
    intro: {
      title: '× 11 i × 12 bez wkuwania',
      text: 'Przez 11: dziesięć razy i jeszcze raz (do 9 × 11 cyfra się powtarza: 11, 22, 33…). Przez 12: dziesięć razy i dwa razy.',
      examples: ['11 × 7 = 70 + 7 = 77', '11 × 12 = 120 + 12 = 132', '12 × 6 = 60 + 12 = 72', '12 × 8 = 80 + 16 = 96'],
    },
  }),
  L('stage-bridge', 2, { kind: 'focus', title: 'Trening × 11 i × 12', mode: 'mul', tables: [11, 12], maxRange: 144, taskCount: 8 }),
  L('stage-bridge', 3, {
    kind: 'learn',
    title: 'Poznaj mnożenie dwucyfrowe',
    mode: 'mul',
    tables: [13, 14, 15, 16, 17, 18, 19],
    maxRange: 200,
    taskCount: 6,
    passPct: 70,
    intro: {
      title: 'Rozbij na dziesiątki i jedności',
      text: 'Liczbę dwucyfrową rozbij na dziesiątki i resztę, pomnóż osobno i dodaj. Wyobraź sobie prostokąt pocięty na dwie części.',
      examples: ['14 × 7 = 10 × 7 + 4 × 7 = 70 + 28 = 98', '16 × 6 = 60 + 36 = 96', '18 × 5 = 50 + 40 = 90'],
    },
  }),
  L('stage-bridge', 4, { kind: 'gap', title: 'Luka: dwucyfrowe', mode: 'mul', tables: [13, 14, 15, 16, 17, 18, 19], maxRange: 200, taskCount: 8 }),

  // ── Liga Mistrzów: po 2 kropki przed testem ──
  L('stage-7', 1, { kind: 'focus', title: 'Trening do 144', mode: 'mixed', maxRange: 144, tables: [11, 12], taskCount: 10 }),
  L('stage-7', 2, { kind: 'race', title: 'Wyścig do 144', mode: 'mixed', maxRange: 144, timeLimitSec: 60, minCorrect: 12 }),
  L('stage-8', 1, { kind: 'gap', title: 'Rozbijanie dwucyfrowych', mode: 'mul', maxRange: 200, tables: [13, 14, 15, 16, 17, 18, 19], taskCount: 8 }),
  L('stage-8', 2, { kind: 'focus', title: 'Trening do 200', mode: 'mul', maxRange: 200, taskCount: 10 }),
  L('stage-9', 1, {
    kind: 'learn',
    title: 'Poznaj dzielenie ponad 100',
    mode: 'div',
    maxRange: 200,
    taskCount: 6,
    passPct: 70,
    intro: {
      title: 'Odejmij to, co znasz',
      text: 'Przy 126 : 7 zacznij od 70 : 7 = 10. Zostaje 56, a 56 : 7 = 8. Razem 10 + 8 = 18.',
      examples: ['126 : 7 = 10 + 8 = 18', '144 : 12 = 12', '156 : 12 = 10 + 3 = 13'],
    },
  }),
  L('stage-9', 2, { kind: 'pairs', title: 'Pary: dzielenie do 200', mode: 'div', maxRange: 200, pairs: 5 }),
  L('stage-10', 1, { kind: 'truefalse', title: 'Prawda czy fałsz do 200', mode: 'mixed', maxRange: 200, timeLimitSec: 60 }),
  L('stage-10', 2, { kind: 'story', title: 'Historyjki do 200', mode: 'mixed', maxRange: 200, taskCount: 4 }),
  L('stage-11', 1, { kind: 'focus', title: 'Trening do 500', mode: 'mixed', maxRange: 500, taskCount: 10 }),
  L('stage-11', 2, { kind: 'race', title: 'Wyścig do 500', mode: 'mixed', maxRange: 500, timeLimitSec: 60, minCorrect: 8 }),
  L('stage-12', 1, { kind: 'gap', title: 'Luka do 1000', mode: 'mixed', maxRange: 1000, taskCount: 8 }),
  L('stage-12', 2, { kind: 'focus', title: 'Trening do 1000', mode: 'mixed', maxRange: 1000, taskCount: 10 }),
  L('stage-13', 1, { kind: 'hard', title: 'Twoje najtrudniejsze', mode: 'mixed', maxRange: 1000, taskCount: 12 }),
  L('stage-13', 2, { kind: 'race', title: 'Wyścig do 1000', mode: 'mixed', maxRange: 1000, timeLimitSec: 60, minCorrect: 8 }),
];

export function lessonsForStage(stageId: string): LessonDef[] {
  return LESSONS.filter((l) => l.stageId === stageId);
}

export function findLesson(id: string): LessonDef | undefined {
  return LESSONS.find((l) => l.id === id);
}
