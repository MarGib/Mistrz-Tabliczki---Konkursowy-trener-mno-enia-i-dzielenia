import { DEFAULT_SETTINGS } from '../data/curriculum';
import { DEFAULT_THEME_ID } from '../data/themes';
import type {
  FactMemory,
  FamilyNotification,
  SessionRecord,
  TournamentBest,
  UserProfile,
} from '../types/math';

export interface ArenaPlayerCard {
  profileId: string;
  name: string;
  schoolName?: string;
  className?: string;
  avatarId: string;
  customAvatarSpec?: UserProfile['customAvatarSpec'];
  xp: number;
  streakDays: number;
  solvedTasks: number;
  accuracyPct: number;
  avgTimeSec?: number;
  sessionsCount: number;
  tournamentBests: Record<string, TournamentBest>;
  updatedAtMs: number;
}

export function generateJoinCode(uid: string): string {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = (clean.slice(0, 4) + '7K2P').slice(0, 4);
  return `MT-${suffix}`;
}

export function sanitizeFirestoreId(raw: string, fallback = 'user-1'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

export function sanitizeProfileForFirestore(
  profile: UserProfile,
  groupId: string,
  uid: string
): Record<string, unknown> {
  const safeSettings = stripUndefinedDeep({
    ...DEFAULT_SETTINGS,
    ...(profile.settings ?? {}),
  });

  const raw: Record<string, unknown> = {
    id: sanitizeFirestoreId(profile.id),
    groupId: groupId.slice(0, 128),
    name: (profile.name.trim() || 'Mistrz').slice(0, 32),
    avatarId: (profile.avatarId || 'owl').slice(0, 32),
    xp: Math.max(0, Math.min(10_000_000, Math.round(profile.xp || 0))),
    streakDays: Math.max(0, Math.min(36_500, Math.round(profile.streakDays || 0))),
    lastActiveDate: (profile.lastActiveDate || '').slice(0, 16),
    unlockedStageIds:
      Array.isArray(profile.unlockedStageIds) && profile.unlockedStageIds.length > 0
        ? profile.unlockedStageIds.filter((s) => typeof s === 'string').slice(0, 20)
        : ['stage-1'],
    completedStageIds: Array.isArray(profile.completedStageIds)
      ? profile.completedStageIds.filter((s) => typeof s === 'string').slice(0, 20)
      : [],
    earnedBadges: Array.isArray(profile.earnedBadges)
      ? profile.earnedBadges.filter((s) => typeof s === 'string').slice(0, 30)
      : [],
    memories: stripUndefinedDeep(profile.memories ?? {}),
    sessions: stripUndefinedDeep(
      (Array.isArray(profile.sessions) ? profile.sessions : []).slice(-40)
    ),
    tournamentBests: stripUndefinedDeep(profile.tournamentBests ?? {}),
    settings: safeSettings,
    activeThemeId: (profile.activeThemeId || DEFAULT_THEME_ID).slice(0, 64),
    customThemes: stripUndefinedDeep(
      (Array.isArray(profile.customThemes) ? profile.customThemes : []).slice(0, 20)
    ),
    updatedByUid: uid.slice(0, 128),
  };

  if (profile.ownerUid && profile.ownerUid.trim().length > 0) {
    raw.ownerUid = sanitizeFirestoreId(profile.ownerUid.trim(), uid).slice(0, 128);
  }
  if (profile.schoolName && profile.schoolName.trim().length > 0) {
    raw.schoolName = profile.schoolName.trim().slice(0, 64);
  }
  if (profile.className && profile.className.trim().length > 0) {
    raw.className = profile.className.trim().slice(0, 24);
  }
  if (profile.login && profile.login.trim().length > 0) {
    raw.login = profile.login.trim().slice(0, 32);
  }
  if (profile.passwordHash && profile.passwordHash.trim().length > 0) {
    raw.passwordHash = profile.passwordHash.trim().slice(0, 64);
  }
  if (profile.customAvatarSpec) {
    raw.customAvatarSpec = stripUndefinedDeep(profile.customAvatarSpec);
  }

  return raw;
}

export function profileToArenaPlayerCard(
  profile: UserProfile,
  now = Date.now()
): ArenaPlayerCard {
  const sessions = Array.isArray(profile.sessions) ? profile.sessions : [];
  const memoriesList = Object.values(profile.memories ?? {}).filter(
    (m) => m.attempts > 0
  );

  const solvedFromSessions = sessions.reduce((s, r) => s + r.totalTasks, 0);
  const correctFromSessions = sessions.reduce((s, r) => s + r.correctTasks, 0);
  const solvedTasks =
    solvedFromSessions > 0
      ? solvedFromSessions
      : memoriesList.reduce((s, m) => s + m.attempts, 0);
  const correctTasks =
    solvedFromSessions > 0
      ? correctFromSessions
      : memoriesList.reduce((s, m) => s + m.correctCount, 0);

  const accuracyPct =
    solvedTasks > 0 ? Math.min(100, Math.round((correctTasks / solvedTasks) * 100)) : 0;

  let avgTimeSec: number | undefined;
  if (sessions.length > 0 && solvedFromSessions > 0) {
    const totalMs = sessions.reduce((s, r) => s + r.totalTimeMs, 0);
    avgTimeSec = Math.min(300, Number((totalMs / solvedFromSessions / 1000).toFixed(2)));
  } else if (memoriesList.length > 0) {
    const avgMs =
      memoriesList.reduce((s, m) => s + m.avgTimeMs, 0) / memoriesList.length;
    avgTimeSec = Math.min(300, Number((avgMs / 1000).toFixed(2)));
  }

  const card: ArenaPlayerCard = {
    profileId: sanitizeFirestoreId(profile.id),
    name: (profile.name.trim() || 'Mistrz').slice(0, 32),
    avatarId: (profile.avatarId || 'owl').slice(0, 32),
    xp: Math.max(0, Math.min(10_000_000, Math.round(profile.xp || 0))),
    streakDays: Math.max(0, Math.min(36_500, Math.round(profile.streakDays || 0))),
    solvedTasks: Math.max(0, Math.min(1_000_000, Math.round(solvedTasks))),
    accuracyPct: Math.max(0, Math.min(100, accuracyPct)),
    sessionsCount: Math.max(0, Math.min(100_000, sessions.length)),
    tournamentBests: stripUndefinedDeep(profile.tournamentBests ?? {}),
    updatedAtMs: Math.max(0, Math.round(now)),
  };

  if (profile.schoolName?.trim()) {
    card.schoolName = profile.schoolName.trim().slice(0, 64);
  }
  if (profile.className?.trim()) {
    card.className = profile.className.trim().slice(0, 24);
  }
  if (profile.customAvatarSpec) {
    card.customAvatarSpec = stripUndefinedDeep(profile.customAvatarSpec);
  }
  if (avgTimeSec !== undefined) {
    card.avgTimeSec = avgTimeSec;
  }

  return card;
}

export function arenaPlayerCardToUserProfile(card: ArenaPlayerCard): UserProfile {
  const synthSession: SessionRecord[] =
    card.solvedTasks > 0
      ? [
          {
            id: `arena-agg-${card.profileId}`,
            timestamp: card.updatedAtMs,
            mode: 'mixed',
            seriesTitle: 'Ranking online',
            totalTasks: card.solvedTasks,
            correctTasks: Math.round((card.solvedTasks * card.accuracyPct) / 100),
            accuracyPct: card.accuracyPct,
            totalTimeMs: Math.round(
              (card.avgTimeSec ?? 3.5) * 1000 * card.solvedTasks
            ),
            avgTimeMs: Math.round((card.avgTimeSec ?? 3.5) * 1000),
            pointsEarned: card.xp,
            passedThreshold: true,
            attempts: [],
          },
        ]
      : [];

  return {
    id: card.profileId,
    name: card.name,
    schoolName: card.schoolName,
    className: card.className,
    avatarId: card.avatarId,
    customAvatarSpec: card.customAvatarSpec,
    xp: card.xp,
    streakDays: card.streakDays,
    lastActiveDate: '',
    unlockedStageIds: ['stage-1'],
    completedStageIds: [],
    earnedBadges: [],
    memories: {},
    sessions: synthSession,
    tournamentBests: card.tournamentBests ?? {},
    settings: { ...DEFAULT_SETTINGS },
    activeThemeId: DEFAULT_THEME_ID,
    customThemes: [],
  };
}

export function mergeCompetitionProfiles(
  groupProfiles: UserProfile[],
  arenaPlayers: ArenaPlayerCard[]
): UserProfile[] {
  const byId = new Map<string, UserProfile>();
  for (const gp of groupProfiles) {
    byId.set(gp.id, gp);
  }
  for (const card of arenaPlayers) {
    const existing = byId.get(card.profileId);
    if (!existing) {
      byId.set(card.profileId, arenaPlayerCardToUserProfile(card));
    } else if (card.xp > existing.xp) {
      byId.set(card.profileId, {
        ...existing,
        xp: card.xp,
        schoolName: existing.schoolName ?? card.schoolName,
        className: existing.className ?? card.className,
      });
    }
  }
  return Array.from(byId.values());
}

function mergeMemories(
  localMem: Record<string, FactMemory>,
  cloudMem: Record<string, FactMemory>
): Record<string, FactMemory> {
  const merged: Record<string, FactMemory> = { ...localMem };
  for (const [id, c] of Object.entries(cloudMem)) {
    const l = merged[id];
    if (!l || c.attempts > l.attempts || c.lastSeenAt > l.lastSeenAt) {
      merged[id] = c;
    }
  }
  return merged;
}

function mergeTournamentBests(
  localBests: Record<string, TournamentBest>,
  cloudBests: Record<string, TournamentBest>
): Record<string, TournamentBest> {
  const merged: Record<string, TournamentBest> = { ...localBests };
  for (const [id, c] of Object.entries(cloudBests)) {
    const l = merged[id];
    if (
      !l ||
      c.bestAccuracyPct > l.bestAccuracyPct ||
      (c.bestAccuracyPct === l.bestAccuracyPct && c.bestTimeSec < l.bestTimeSec)
    ) {
      merged[id] = c;
    }
  }
  return merged;
}

function mergeSessions(
  localSessions: SessionRecord[],
  cloudSessions: SessionRecord[]
): SessionRecord[] {
  const byId = new Map<string, SessionRecord>();
  for (const s of localSessions) {
    byId.set(s.id, s);
  }
  for (const s of cloudSessions) {
    byId.set(s.id, s);
  }
  return Array.from(byId.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-40);
}

/** Suma grup z obu kopii (lokalna wygrywa w ustawieniach), bez grup opuszczonych. */
export function mergeCircleLists(
  local: UserProfile['circles'],
  cloud: UserProfile['circles'],
  leftLocal?: string[],
  leftCloud?: string[]
): NonNullable<UserProfile['circles']> {
  const left = new Set([...(leftLocal ?? []), ...(leftCloud ?? [])]);
  const byId = new Map<string, NonNullable<UserProfile['circles']>[number]>();
  for (const c of cloud ?? []) byId.set(c.id, c);
  for (const c of local ?? []) byId.set(c.id, c);
  return Array.from(byId.values()).filter((c) => !left.has(c.id));
}

export function mergeSingleProfile(
  local: UserProfile | undefined,
  cloud: UserProfile
): UserProfile {
  const merged = mergeSingleProfileInner(local, cloud);
  if (!local) return merged;
  // Pola konta login+hasło żyją lokalnie — nie pozwól, by starsza kopia z chmury je skasowała.
  return {
    ...merged,
    cloudUid: local.cloudUid ?? merged.cloudUid,
    circles: mergeCircleLists(local.circles, cloud.circles, local.leftCircleIds, cloud.leftCircleIds),
    leftCircleIds: Array.from(new Set([...(local.leftCircleIds ?? []), ...(cloud.leftCircleIds ?? [])])).slice(-50),
    login: local.login ?? merged.login,
    passwordHash: local.passwordHash ?? merged.passwordHash,
  };
}

function mergeSingleProfileInner(
  local: UserProfile | undefined,
  cloud: UserProfile
): UserProfile {
  if (!local) return cloud;

  // If local is untouched (0 XP, 0 sessions, no custom password, no school/class set locally), adopt cloud verbatim
  const localUntouched =
    local.xp === 0 &&
    local.sessions.length === 0 &&
    !local.passwordHash &&
    !local.schoolName &&
    local.earnedBadges.length === 0;
  if (localUntouched) {
    return cloud;
  }

  // If cloud is untouched while local already has real progress or password, keep local progress
  const cloudUntouched =
    cloud.xp === 0 &&
    cloud.sessions.length === 0 &&
    !cloud.passwordHash &&
    !cloud.schoolName &&
    cloud.earnedBadges.length === 0;
  if (cloudUntouched) {
    return {
      ...local,
      ownerUid: local.ownerUid ?? cloud.ownerUid,
    };
  }

  const mergedSessions = mergeSessions(local.sessions, cloud.sessions);
  const preferCloudMeta =
    cloud.sessions.length >= local.sessions.length && cloud.xp >= local.xp;

  const unlockedStageIds = Array.from(
    new Set([...local.unlockedStageIds, ...cloud.unlockedStageIds])
  ).slice(0, 20);
  const completedStageIds = Array.from(
    new Set([...local.completedStageIds, ...cloud.completedStageIds])
  ).slice(0, 20);
  const earnedBadges = Array.from(
    new Set([...local.earnedBadges, ...cloud.earnedBadges])
  ).slice(0, 30);

  const primary = preferCloudMeta ? cloud : local;
  const secondary = preferCloudMeta ? local : cloud;

  return {
    ...primary,
    ownerUid: primary.ownerUid ?? secondary.ownerUid,
    schoolName: primary.schoolName ?? secondary.schoolName,
    className: primary.className ?? secondary.className,
    login: primary.login ?? secondary.login,
    passwordHash: primary.passwordHash ?? secondary.passwordHash,
    xp: Math.max(local.xp, cloud.xp),
    streakDays: Math.max(local.streakDays, cloud.streakDays),
    lastActiveDate:
      local.lastActiveDate > cloud.lastActiveDate
        ? local.lastActiveDate
        : cloud.lastActiveDate,
    unlockedStageIds,
    completedStageIds,
    earnedBadges,
    memories: mergeMemories(local.memories, cloud.memories),
    sessions: mergedSessions,
    tournamentBests: mergeTournamentBests(local.tournamentBests, cloud.tournamentBests),
    customThemes:
      (primary.customThemes?.length ?? 0) >= (secondary.customThemes?.length ?? 0)
        ? primary.customThemes
        : secondary.customThemes,
  };
}

export function doesProfileNeedCloudPush(
  merged: UserProfile,
  cloud: UserProfile | undefined
): boolean {
  if (!cloud) return true;
  if (merged.xp > cloud.xp) return true;
  if (merged.sessions.length > cloud.sessions.length) return true;
  if (merged.passwordHash && merged.passwordHash !== cloud.passwordHash) return true;
  if (merged.login && !cloud.login) return true;
  if (merged.schoolName && !cloud.schoolName) return true;
  if (merged.className && !cloud.className) return true;
  if (merged.earnedBadges.length > cloud.earnedBadges.length) return true;
  if (Object.keys(merged.memories).length > Object.keys(cloud.memories).length) {
    return true;
  }
  return false;
}

export function mergeProfiles(
  localProfiles: UserProfile[],
  cloudProfiles: UserProfile[]
): UserProfile[] {
  const localById = new Map(localProfiles.map((p) => [p.id, p]));
  const result: UserProfile[] = [];
  const seenIds = new Set<string>();

  for (const cp of cloudProfiles) {
    seenIds.add(cp.id);
    result.push(mergeSingleProfile(localById.get(cp.id), cp));
  }
  for (const lp of localProfiles) {
    if (!seenIds.has(lp.id)) {
      result.push(lp);
    }
  }
  return result.slice(0, 50);
}

export function mergeNotifications(
  localList: FamilyNotification[],
  cloudList: FamilyNotification[]
): FamilyNotification[] {
  const byId = new Map<string, FamilyNotification>();
  for (const item of [...cloudList, ...localList]) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
    } else {
      byId.set(item.id, {
        ...existing,
        readByProfileIds: Array.from(
          new Set([...existing.readByProfileIds, ...item.readByProfileIds])
        ),
      });
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 40);
}
