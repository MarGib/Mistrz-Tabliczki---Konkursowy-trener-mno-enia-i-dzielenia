import type {
  AppSettings,
  FactMemory,
  LevelStage,
  SessionRecord,
  TournamentDef,
  UserProfile,
} from '../types/math';
import { createProblem } from '../engine/problemGenerator';
import { updateFactMemory } from '../engine/spacedRepetition';
import { DEFAULT_THEME_ID } from './themes';

export const LEVEL_STAGES: LevelStage[] = [
  {
    id: 'stage-1',
    order: 1,
    title: 'Rozgrzewka Mistrza',
    subtitle: 'Podstawy mnożenia w zakresie 30',
    mode: 'mul',
    maxRange: 30,
    taskCount: 8,
    passAccuracyPct: 75,
    targetAvgTimeSec: 6,
    rewardXp: 60,
    badgeName: 'Pierwsza Iskra',
  },
  {
    id: 'stage-2',
    order: 2,
    title: 'Brązowa Tabliczka',
    subtitle: 'Mnożenie i dzielenie do 50',
    mode: 'mixed',
    maxRange: 50,
    taskCount: 10,
    passAccuracyPct: 80,
    targetAvgTimeSec: 5.5,
    rewardXp: 90,
    badgeName: 'Brązowy Rachmistrz',
  },
  {
    id: 'stage-3',
    order: 3,
    title: 'Srebrny Sprint Mnożenia',
    subtitle: 'Pełna tabliczka mnożenia do 100',
    mode: 'mul',
    maxRange: 100,
    taskCount: 12,
    passAccuracyPct: 80,
    targetAvgTimeSec: 4.5,
    rewardXp: 120,
    badgeName: 'Srebrny Mnożyciel',
  },
  {
    id: 'stage-4',
    order: 4,
    title: 'Twierdza Dzielenia',
    subtitle: 'Sprawne dzielenie w zakresie 100',
    mode: 'div',
    maxRange: 100,
    taskCount: 12,
    passAccuracyPct: 80,
    targetAvgTimeSec: 4.8,
    rewardXp: 140,
    badgeName: 'Pogromca Dzielenia',
  },
  {
    id: 'stage-5',
    order: 5,
    title: 'Złoty Finał 100',
    subtitle: 'Konkursowy mix mnożenia i dzielenia do 100',
    mode: 'mixed',
    maxRange: 100,
    taskCount: 15,
    passAccuracyPct: 85,
    targetAvgTimeSec: 4.0,
    rewardXp: 200,
    badgeName: 'Złoty Finalista',
  },
  {
    id: 'stage-6',
    order: 6,
    title: 'Diamentowy Olimp',
    subtitle: 'Błyskawiczna seria na wyrywki (próg 90%)',
    mode: 'mixed',
    maxRange: 100,
    taskCount: 20,
    passAccuracyPct: 90,
    targetAvgTimeSec: 3.0,
    rewardXp: 300,
    badgeName: 'Mistrz na Wyrywki',
  },
];

export const TOURNAMENTS: TournamentDef[] = [
  {
    id: 'tourney-blitz-100',
    title: 'Turniej Błyskawica 100',
    description: 'Klasyczny sprawdzian konkursowy: 12 zadań mieszanych z mnożenia i dzielenia do 100.',
    mode: 'mixed',
    maxRange: 100,
    taskCount: 12,
    passAccuracyPct: 80,
    bronzeTimeSec: 75,
    silverTimeSec: 48,
    goldTimeSec: 32,
    rewardXp: 180,
    simulatedPeers: [
      { name: 'Zosia K.', scorePct: 100, timeSec: 29, city: 'Kraków' },
      { name: 'Antek W.', scorePct: 92, timeSec: 36, city: 'Gdańsk' },
      { name: 'Hania M.', scorePct: 92, timeSec: 44, city: 'Wrocław' },
      { name: 'Filip P.', scorePct: 83, timeSec: 54, city: 'Poznań' },
    ],
  },
  {
    id: 'tourney-mul-cup',
    title: 'Puchar Mistrzów Mnożenia',
    description: '15 działań wyłącznie z mnożenia. Próg kwalifikacji to minimum 85% poprawnych odpowiedzi.',
    mode: 'mul',
    maxRange: 100,
    taskCount: 15,
    passAccuracyPct: 85,
    bronzeTimeSec: 85,
    silverTimeSec: 55,
    goldTimeSec: 38,
    rewardXp: 220,
    simulatedPeers: [
      { name: 'Kuba S.', scorePct: 100, timeSec: 34, city: 'Warszawa' },
      { name: 'Lena R.', scorePct: 93, timeSec: 42, city: 'Łódź' },
      { name: 'Olek T.', scorePct: 87, timeSec: 58, city: 'Katowice' },
    ],
  },
  {
    id: 'tourney-div-master',
    title: 'Wielki Turniej Dzielenia',
    description: '12 precyzyjnych zadań z dzielenia w pamięci. Liczy się pewność i szybkość!',
    mode: 'div',
    maxRange: 100,
    taskCount: 12,
    passAccuracyPct: 80,
    bronzeTimeSec: 78,
    silverTimeSec: 52,
    goldTimeSec: 35,
    rewardXp: 200,
    simulatedPeers: [
      { name: 'Mikołaj B.', scorePct: 100, timeSec: 33, city: 'Lublin' },
      { name: 'Nadia D.', scorePct: 92, timeSec: 46, city: 'Szczecin' },
      { name: 'Igor J.', scorePct: 83, timeSec: 60, city: 'Toruń' },
    ],
  },
  {
    id: 'tourney-grand-final',
    title: 'Wielki Finał Konkursowy',
    description: 'Najwyższe wyzwanie: 20 zadań na poziomie finału międzyszkolnego. Próg przejścia 90%.',
    mode: 'mixed',
    maxRange: 100,
    taskCount: 20,
    passAccuracyPct: 90,
    bronzeTimeSec: 115,
    silverTimeSec: 78,
    goldTimeSec: 52,
    rewardXp: 350,
    simulatedPeers: [
      { name: 'Ala Z.', scorePct: 100, timeSec: 48, city: 'Warszawa' },
      { name: 'Tymon G.', scorePct: 95, timeSec: 61, city: 'Kraków' },
      { name: 'Pola N.', scorePct: 90, timeSec: 79, city: 'Gdynia' },
    ],
  },
];

export const ALL_BADGES: { id: string; title: string; desc: string }[] = [
  { id: 'Pierwsza Iskra', title: 'Pierwsza Iskra', desc: 'Ukończ pierwszy etap Ścieżki Mistrza.' },
  { id: 'Brązowy Rachmistrz', title: 'Brązowy Rachmistrz', desc: 'Zdobądź próg przejścia w etapie Brązowa Tabliczka.' },
  { id: 'Srebrny Mnożyciel', title: 'Srebrny Mnożyciel', desc: 'Opanuj tabliczkę mnożenia do 100 na 80%+.' },
  { id: 'Pogromca Dzielenia', title: 'Pogromca Dzielenia', desc: 'Ukończ Twierdzę Dzielenia w zakresie 100.' },
  { id: 'Złoty Finalista', title: 'Złoty Finalista', desc: 'Przejdź Złoty Finał 100 z wynikiem minimum 85%.' },
  { id: 'Mistrz na Wyrywki', title: 'Mistrz na Wyrywki', desc: 'Zdobądź Diamentowy Olimp przy 90% skuteczności.' },
  { id: 'Medalistka Turnieju', title: 'Medal Turniejowy', desc: 'Zdobądź medal w dowolnym turnieju konkursowym.' },
  { id: 'Pogromca Trudnych', title: 'Pogromca Trudnych', desc: 'Popraw trudne działanie w powtórce SuperMemo.' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  maxRange: 100,
  autoHintDelaySec: 7,
  showLiveTimer: true,
  soundEnabled: true,
  musicEnabled: true,
  defaultSeriesLength: 10,
};

function buildDemoSeedMemories(now: number): Record<string, FactMemory> {
  const memories: Record<string, FactMemory> = {};

  const addHistory = (
    op: 'mul' | 'div',
    a: number,
    b: number,
    runs: { ok: boolean; ms: number; hint?: boolean }[]
  ) => {
    const prob = createProblem(op, a, b);
    let mem: FactMemory | undefined = memories[prob.id];
    runs.forEach((r, idx) => {
      mem = updateFactMemory(
        mem,
        prob,
        r.ok,
        r.ms,
        Boolean(r.hint),
        now - (runs.length - idx) * 86_400_000
      ).updated;
    });
    if (mem) memories[prob.id] = mem;
  };

  // Mastered fast facts ("Na wyrywki")
  addHistory('mul', 2, 5, [{ ok: true, ms: 1600 }, { ok: true, ms: 1400 }, { ok: true, ms: 1350 }]);
  addHistory('mul', 3, 4, [{ ok: true, ms: 1900 }, { ok: true, ms: 1700 }, { ok: true, ms: 1500 }]);
  addHistory('mul', 4, 5, [{ ok: true, ms: 2100 }, { ok: true, ms: 1850 }, { ok: true, ms: 1650 }]);
  addHistory('mul', 5, 6, [{ ok: true, ms: 2300 }, { ok: true, ms: 2050 }, { ok: true, ms: 1900 }]);
  addHistory('div', 20, 4, [{ ok: true, ms: 2200 }, { ok: true, ms: 1950 }, { ok: true, ms: 1750 }]);
  addHistory('div', 30, 5, [{ ok: true, ms: 2400 }, { ok: true, ms: 2100 }, { ok: true, ms: 1800 }]);
  addHistory('mul', 3, 7, [{ ok: true, ms: 2500 }, { ok: true, ms: 2200 }, { ok: true, ms: 2000 }]);
  addHistory('mul', 9, 5, [{ ok: true, ms: 2700 }, { ok: true, ms: 2400 }, { ok: true, ms: 2150 }]);

  // Steady / in progress
  addHistory('mul', 6, 4, [{ ok: true, ms: 3800 }, { ok: true, ms: 3200 }]);
  addHistory('div', 42, 6, [{ ok: true, ms: 4600 }, { ok: true, ms: 3900 }]);
  addHistory('mul', 8, 4, [{ ok: true, ms: 4100 }, { ok: true, ms: 3500 }]);
  addHistory('div', 45, 9, [{ ok: true, ms: 4900 }, { ok: true, ms: 3800 }]);

  // Difficult / Slow facts (for SuperMemo & Analytics demonstration)
  addHistory('mul', 7, 8, [
    { ok: false, ms: 8600 },
    { ok: true, ms: 7200, hint: true },
    { ok: false, ms: 6900 },
  ]);
  addHistory('mul', 6, 7, [
    { ok: false, ms: 7800 },
    { ok: true, ms: 6400 },
  ]);
  addHistory('div', 56, 7, [
    { ok: false, ms: 9100 },
    { ok: true, ms: 6800, hint: true },
  ]);
  addHistory('div', 72, 8, [
    { ok: false, ms: 8400 },
    { ok: true, ms: 6100 },
  ]);
  addHistory('mul', 8, 9, [
    { ok: true, ms: 6500 },
    { ok: false, ms: 7100 },
  ]);

  return memories;
}

function buildDemoSessions(now: number): SessionRecord[] {
  const day = 86_400_000;
  return [
    {
      id: 'seed-s1',
      timestamp: now - 5 * day,
      mode: 'mul',
      seriesTitle: 'Rozgrzewka Mistrza',
      stageId: 'stage-1',
      totalTasks: 8,
      correctTasks: 6,
      accuracyPct: 75,
      totalTimeMs: 49600,
      avgTimeMs: 6200,
      pointsEarned: 82,
      passedThreshold: true,
      thresholdPct: 75,
      attempts: [],
    },
    {
      id: 'seed-s2',
      timestamp: now - 4 * day,
      mode: 'mixed',
      seriesTitle: 'Brązowa Tabliczka',
      stageId: 'stage-2',
      totalTasks: 10,
      correctTasks: 8,
      accuracyPct: 80,
      totalTimeMs: 53000,
      avgTimeMs: 5300,
      pointsEarned: 118,
      passedThreshold: true,
      thresholdPct: 80,
      attempts: [],
    },
    {
      id: 'seed-s3',
      timestamp: now - 3 * day,
      mode: 'mul',
      seriesTitle: 'Trening: Mnożenie do 100',
      totalTasks: 10,
      correctTasks: 8,
      accuracyPct: 80,
      totalTimeMs: 46000,
      avgTimeMs: 4600,
      pointsEarned: 126,
      passedThreshold: true,
      attempts: [],
    },
    {
      id: 'seed-s4',
      timestamp: now - 2 * day,
      mode: 'div',
      seriesTitle: 'Trening: Dzielenie do 100',
      totalTasks: 10,
      correctTasks: 9,
      accuracyPct: 90,
      totalTimeMs: 39000,
      avgTimeMs: 3900,
      pointsEarned: 148,
      passedThreshold: true,
      attempts: [],
    },
    {
      id: 'seed-s5',
      timestamp: now - 1 * day,
      mode: 'mixed',
      seriesTitle: 'Turniej Błyskawica 100',
      tournamentId: 'tourney-blitz-100',
      totalTasks: 12,
      correctTasks: 11,
      accuracyPct: 92,
      totalTimeMs: 43200,
      avgTimeMs: 3600,
      pointsEarned: 215,
      passedThreshold: true,
      thresholdPct: 80,
      attempts: [],
    },
  ];
}

export function createDemoProfile(now = Date.now()): UserProfile {
  const todayStr = new Date(now).toISOString().slice(0, 10);
  return {
    id: 'profile-ola',
    name: 'Ola',
    avatarId: 'owl',
    xp: 689,
    streakDays: 5,
    lastActiveDate: todayStr,
    unlockedStageIds: ['stage-1', 'stage-2', 'stage-3', 'stage-4'],
    completedStageIds: ['stage-1', 'stage-2'],
    earnedBadges: ['Pierwsza Iskra', 'Brązowy Rachmistrz', 'Medalistka Turnieju'],
    memories: buildDemoSeedMemories(now),
    sessions: buildDemoSessions(now),
    tournamentBests: {
      'tourney-blitz-100': {
        tournamentId: 'tourney-blitz-100',
        bestAccuracyPct: 92,
        bestTimeSec: 43,
        medal: 'srebro',
        attemptsCount: 1,
        lastPlayedAt: now - 86_400_000,
      },
    },
    settings: { ...DEFAULT_SETTINGS },
    activeThemeId: DEFAULT_THEME_ID,
    customThemes: [],
  };
}

function buildFamilyMemberSessions(
  idPrefix: string,
  now: number,
  series: { title: string; avgMs: number; acc: number; mode: 'mul' | 'div' | 'mixed'; tasks: number }[]
): SessionRecord[] {
  const day = 86_400_000;
  return series.map((item, idx) => {
    const correctTasks = Math.round((item.tasks * item.acc) / 100);
    return {
      id: `${idPrefix}-s${idx + 1}`,
      timestamp: now - (series.length - idx) * day,
      mode: item.mode,
      seriesTitle: item.title,
      totalTasks: item.tasks,
      correctTasks,
      accuracyPct: item.acc,
      totalTimeMs: item.avgMs * item.tasks,
      avgTimeMs: item.avgMs,
      pointsEarned: correctTasks * 14,
      passedThreshold: item.acc >= 75,
      attempts: [],
    };
  });
}

function buildMemberMemories(
  now: number,
  facts: { op: 'mul' | 'div'; a: number; b: number; ok: boolean; ms: number }[]
): Record<string, FactMemory> {
  const memories: Record<string, FactMemory> = {};
  for (const f of facts) {
    const prob = createProblem(f.op, f.a, f.b);
    let mem = updateFactMemory(undefined, prob, f.ok, f.ms, false, now - 172_800_000).updated;
    mem = updateFactMemory(mem, prob, f.ok, Math.max(1200, f.ms - 400), false, now - 86_400_000).updated;
    if (f.ok) {
      mem = updateFactMemory(mem, prob, true, Math.max(1100, f.ms - 650), false, now).updated;
    }
    memories[prob.id] = mem;
  }
  return memories;
}

export const STARTER_FAMILY_TEMPLATES = ['Ola', 'Mama', 'Tata', 'Natalka'] as const;

export function createFamilySeedProfiles(now = Date.now()): UserProfile[] {
  const todayStr = new Date(now).toISOString().slice(0, 10);
  const ola = createDemoProfile(now);

  const mama: UserProfile = {
    id: 'profile-mama',
    name: 'Mama',
    avatarId: 'av-03', // Fioletowy Kotek
    xp: 520,
    streakDays: 4,
    lastActiveDate: todayStr,
    unlockedStageIds: ['stage-1', 'stage-2', 'stage-3'],
    completedStageIds: ['stage-1', 'stage-2'],
    earnedBadges: ['Pierwsza Iskra', 'Brązowy Rachmistrz'],
    memories: buildMemberMemories(now, [
      { op: 'mul', a: 6, b: 8, ok: true, ms: 2600 },
      { op: 'mul', a: 7, b: 9, ok: true, ms: 2900 },
      { op: 'div', a: 54, b: 6, ok: true, ms: 3100 },
      { op: 'div', a: 63, b: 7, ok: true, ms: 3300 },
      { op: 'mul', a: 8, b: 8, ok: true, ms: 2200 },
      { op: 'mul', a: 7, b: 8, ok: false, ms: 5400 },
    ]),
    sessions: buildFamilyMemberSessions('mama', now, [
      { title: 'Rozgrzewka Mistrza', avgMs: 4100, acc: 88, mode: 'mul', tasks: 8 },
      { title: 'Brązowa Tabliczka', avgMs: 3600, acc: 90, mode: 'mixed', tasks: 10 },
      { title: 'Trening: Dzielenie do 100', avgMs: 3200, acc: 90, mode: 'div', tasks: 10 },
      { title: 'Turniej Błyskawica 100', avgMs: 2900, acc: 92, mode: 'mixed', tasks: 12 },
    ]),
    tournamentBests: {
      'tourney-blitz-100': {
        tournamentId: 'tourney-blitz-100',
        bestAccuracyPct: 92,
        bestTimeSec: 35,
        medal: 'srebro',
        attemptsCount: 1,
        lastPlayedAt: now - 86_400_000,
      },
    },
    settings: { ...DEFAULT_SETTINGS },
    activeThemeId: DEFAULT_THEME_ID,
    customThemes: [],
  };

  const tata: UserProfile = {
    id: 'profile-tata',
    name: 'Tata',
    avatarId: 'av-31', // Mistrz Bulls
    xp: 610,
    streakDays: 3,
    lastActiveDate: todayStr,
    unlockedStageIds: ['stage-1', 'stage-2', 'stage-3', 'stage-4'],
    completedStageIds: ['stage-1', 'stage-2', 'stage-3'],
    earnedBadges: ['Pierwsza Iskra', 'Brązowy Rachmistrz', 'Srebrny Mnożyciel'],
    memories: buildMemberMemories(now, [
      { op: 'mul', a: 9, b: 8, ok: true, ms: 2100 },
      { op: 'mul', a: 7, b: 7, ok: true, ms: 2000 },
      { op: 'div', a: 81, b: 9, ok: true, ms: 2400 },
      { op: 'div', a: 56, b: 8, ok: true, ms: 2500 },
      { op: 'mul', a: 6, b: 9, ok: true, ms: 2300 },
      { op: 'div', a: 72, b: 8, ok: false, ms: 5800 },
    ]),
    sessions: buildFamilyMemberSessions('tata', now, [
      { title: 'Rozgrzewka Mistrza', avgMs: 3900, acc: 88, mode: 'mul', tasks: 8 },
      { title: 'Srebrny Sprint Mnożenia', avgMs: 3100, acc: 92, mode: 'mul', tasks: 12 },
      { title: 'Trening: Mieszany do 100', avgMs: 2700, acc: 90, mode: 'mixed', tasks: 10 },
      { title: 'Turniej Błyskawica 100', avgMs: 2500, acc: 100, mode: 'mixed', tasks: 12 },
    ]),
    tournamentBests: {
      'tourney-blitz-100': {
        tournamentId: 'tourney-blitz-100',
        bestAccuracyPct: 100,
        bestTimeSec: 30,
        medal: 'puchar',
        attemptsCount: 2,
        lastPlayedAt: now - 43_200_000,
      },
    },
    settings: { ...DEFAULT_SETTINGS },
    activeThemeId: DEFAULT_THEME_ID,
    customThemes: [],
  };

  const natalka: UserProfile = {
    id: 'profile-natalka',
    name: 'Natalka',
    avatarId: 'av-44', // Tęczowy Jednorożec
    xp: 315,
    streakDays: 3,
    lastActiveDate: todayStr,
    unlockedStageIds: ['stage-1', 'stage-2'],
    completedStageIds: ['stage-1'],
    earnedBadges: ['Pierwsza Iskra'],
    memories: buildMemberMemories(now, [
      { op: 'mul', a: 2, b: 6, ok: true, ms: 2600 },
      { op: 'mul', a: 3, b: 5, ok: true, ms: 2900 },
      { op: 'div', a: 18, b: 3, ok: true, ms: 3400 },
      { op: 'mul', a: 6, b: 7, ok: false, ms: 7200 },
    ]),
    sessions: buildFamilyMemberSessions('natalka', now, [
      { title: 'Rozgrzewka Mistrza', avgMs: 5800, acc: 75, mode: 'mul', tasks: 8 },
      { title: 'Trening: Mnożenie do 100', avgMs: 4900, acc: 80, mode: 'mul', tasks: 10 },
      { title: 'Brązowa Tabliczka', avgMs: 4200, acc: 80, mode: 'mixed', tasks: 10 },
    ]),
    tournamentBests: {},
    settings: { ...DEFAULT_SETTINGS },
    activeThemeId: DEFAULT_THEME_ID,
    customThemes: [],
  };

  return [ola, mama, tata, natalka];
}

export function createFreshProfile(
  name: string,
  avatarId: UserProfile['avatarId'] = 'av-20',
  now = Date.now(),
  customAvatarSpec?: UserProfile['customAvatarSpec']
): UserProfile {
  return {
    id: `profile-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'Mistrz',
    avatarId,
    customAvatarSpec,
    xp: 0,
    streakDays: 1,
    lastActiveDate: new Date(now).toISOString().slice(0, 10),
    unlockedStageIds: ['stage-1'],
    completedStageIds: [],
    earnedBadges: [],
    memories: {},
    sessions: [],
    tournamentBests: {},
    settings: { ...DEFAULT_SETTINGS },
    activeThemeId: DEFAULT_THEME_ID,
    customThemes: [],
  };
}
