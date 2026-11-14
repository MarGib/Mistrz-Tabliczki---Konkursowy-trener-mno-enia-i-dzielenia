export type OperationType = 'mul' | 'div';
export type OperationMode = 'mul' | 'div' | 'mixed';

export type DeviceCategory = 'telefon' | 'tablet' | 'komputer';
export type ScreenOrientation = 'pionowy' | 'poziomy';

export interface DeviceProfile {
  category: DeviceCategory;
  orientation: ScreenOrientation;
  width: number;
  height: number;
  hasTouch: boolean;
  label: string;
}

export type MasteryLevel =
  | 'nowe'
  | 'trudne'
  | 'w_trakcie'
  | 'opanowane'
  | 'mistrzowskie';

export interface MathProblem {
  id: string; // e.g., "mul:7x8" or "div:56/8"
  op: OperationType;
  a: number;
  b: number;
  answer: number;
  display: string;
}

export interface FactMemory {
  id: string;
  op: OperationType;
  a: number;
  b: number;
  answer: number;
  easiness: number; // SM-2 EF (1.3 - 2.8)
  intervalDays: number;
  repetitions: number;
  nextReviewAt: number; // epoch ms
  attempts: number;
  correctCount: number;
  wrongCount: number;
  totalTimeMs: number;
  avgTimeMs: number;
  lastTimeMs: number;
  lastSeenAt: number;
  mastery: MasteryLevel;
}

export interface TaskAttempt {
  problem: MathProblem;
  userAnswer: number | null;
  isCorrect: boolean;
  timeMs: number;
  usedHint: boolean;
  pointsEarned: number;
  quality: number; // 0..5 SM-2 quality
}

export interface SessionRecord {
  id: string;
  timestamp: number;
  mode: OperationMode;
  seriesTitle: string;
  stageId?: string;
  tournamentId?: string;
  totalTasks: number;
  correctTasks: number;
  accuracyPct: number;
  totalTimeMs: number;
  avgTimeMs: number;
  pointsEarned: number;
  passedThreshold: boolean;
  thresholdPct?: number;
  attempts: TaskAttempt[];
}

export interface LevelStage {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  mode: OperationMode;
  maxRange: number;
  taskCount: number;
  passAccuracyPct: number;
  targetAvgTimeSec: number;
  rewardXp: number;
  badgeName: string;
}

export interface TournamentDef {
  id: string;
  title: string;
  description: string;
  mode: OperationMode;
  maxRange: number;
  taskCount: number;
  passAccuracyPct: number;
  bronzeTimeSec: number;
  silverTimeSec: number;
  goldTimeSec: number;
  rewardXp: number;
  simulatedPeers: { name: string; scorePct: number; timeSec: number; city: string }[];
}

export type MedalTier = 'brak' | 'braz' | 'srebro' | 'zloto' | 'puchar';

export interface TournamentBest {
  tournamentId: string;
  bestAccuracyPct: number;
  bestTimeSec: number;
  medal: MedalTier;
  attemptsCount: number;
  lastPlayedAt: number;
}

export interface AppSettings {
  maxRange: number; // 50 | 100 | 144 | 200 | 500 | 1000
  autoHintDelaySec: number; // e.g., 7
  showLiveTimer: boolean;
  soundEnabled: boolean;
  musicEnabled?: boolean;
  defaultSeriesLength: number; // 8 | 10 | 12 | 15
}

export interface ThemePaletteInput {
  canvas: string;
  surface: string;
  primary: string;
  accent: string;
  isDark: boolean;
}

export interface ThemeTokens extends ThemePaletteInput {
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  primaryHover: string;
  primaryDark: string;
  primaryFg: string;
  accentHover: string;
  accentDark: string;
  accentFg: string;
  softTint: string;
  softTintBorder: string;
  keyBg: string;
  keyHover: string;
  keyBorder: string;
  keyText: string;
}

export interface ColorTheme {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
  palette: ThemePaletteInput;
  tokens: ThemeTokens;
}

export type AvatarCharacter =
  | 'owl'
  | 'fox'
  | 'cat'
  | 'dog'
  | 'panda'
  | 'bear'
  | 'dragon'
  | 'unicorn'
  | 'lion'
  | 'rabbit'
  | 'frog'
  | 'penguin'
  | 'robot'
  | 'alien'
  | 'astronaut'
  | 'rocket'
  | 'wizard'
  | 'knight';

export type AvatarAccessory =
  | 'none'
  | 'glasses'
  | 'crown'
  | 'headphones'
  | 'cap'
  | 'halo';

export type AvatarProp =
  | 'star'
  | 'trophy'
  | 'lightning'
  | 'heart'
  | 'calculator'
  | 'planet';

export interface AvatarSpec {
  character: AvatarCharacter;
  bgColor: string;
  bodyColor: string;
  accessory: AvatarAccessory;
  prop: AvatarProp;
  prompt?: string;
}

export interface AvatarPreset {
  id: string;
  name: string;
  category: 'Zwierzęta' | 'Kosmos i Roboty' | 'Mistrzowie i Sport' | 'Fantazja';
  spec: AvatarSpec;
}

export interface UserProfile {
  id: string;
  /** Tylko dla graczy z grupy: ostatnie serie odtworzone z karty wyników (do wykresu tendencji). */
  trendSessions?: SessionRecord[];
  ownerUid?: string;
  name: string;
  schoolName?: string;
  className?: string;
  login?: string;
  passwordHash?: string;
  avatarId: string;
  customAvatarSpec?: AvatarSpec;
  xp: number;
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
  unlockedStageIds: string[];
  completedStageIds: string[];
  earnedBadges: string[];
  memories: Record<string, FactMemory>;
  sessions: SessionRecord[];
  tournamentBests: Record<string, TournamentBest>;
  settings: AppSettings;
  activeThemeId?: string;
  customThemes?: ColorTheme[];
  /** Grupy (rodzina, znajomi…), do których należy konto, i czy pokazuje w nich swoje wyniki. */
  circles?: CircleMembership[];
  /** Grupy opuszczone przez gracza — żeby starsza kopia z chmury ich nie przywróciła. */
  leftCircleIds?: string[];
  /** uid konta Firebase (login + hasło) — obecny, gdy konto jest zsynchronizowane w chmurze. */
  cloudUid?: string;
}

export interface CircleMembership {
  id: string;
  name: string;
  code: string;
  share: boolean;
  owner?: boolean;
}

export type FamilyNotificationType =
  | 'xp_overtake'
  | 'speed_record'
  | 'tournament_record'
  | 'badge_earned';

export interface FamilyNotification {
  id: string;
  createdAt: number;
  type: FamilyNotificationType;
  actorProfileId: string;
  actorName: string;
  targetProfileId?: string;
  title: string;
  message: string;
  readByProfileIds: string[];
}

export interface VisualHintData {
  strategyTitle: string;
  mnemonic: string;
  decompositionText: string;
  visualType: 'array_split' | 'division_groups';
  rows: number;
  cols: number;
  splitRow?: number; // for multiplication anchor (e.g. 5 rows + remaining rows)
  groupCount?: number; // for division
  groupSize?: number;
  highlightNote: string;
  /** Kolorowe części rozkładu do szybkiego spojrzenia, np. [5 × 8 = 40] + [2 × 8 = 16]. */
  parts?: VisualHintPart[];
  /** Jak połączyć części: dodać, odjąć, albo wziąć połowę jedynej części. */
  joiner?: '+' | '−' | 'half';
  /** Bardzo krótka wskazówka (max ~40 znaków) pod rozkładem. */
  shortTip?: string;
  /** Dzielenie: liczenie wielokrotnościami dzielnika od wygodnej „kotwicy”. */
  division?: {
    divisor: number;
    dividend: number;
    anchorK: number;
    anchorValue: number;
    multiples: number[];
  };
}

export interface VisualHintPart {
  label: string;
  value: number;
  tone: 'blue' | 'amber';
}

export interface ActiveSeriesConfig {
  title: string;
  mode: OperationMode;
  maxRange: number;
  taskCount: number;
  stageId?: string;
  tournamentId?: string;
  passAccuracyPct?: number;
  focusFactIds?: string[];
  targetAvgTimeSec?: number;
}
