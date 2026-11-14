import { DEFAULT_THEME_ID } from '../data/themes';
import type {
  FactMemory,
  FamilyNotification,
  SessionRecord,
  TournamentBest,
  UserProfile,
} from '../types/math';

export function generateJoinCode(uid: string): string {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = (clean.slice(0, 4) + '7K2P').slice(0, 4);
  return `MT-${suffix}`;
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
  const raw: Record<string, unknown> = {
    id: profile.id.slice(0, 64),
    groupId: groupId.slice(0, 128),
    name: (profile.name.trim() || 'Mistrz').slice(0, 32),
    avatarId: (profile.avatarId || 'owl').slice(0, 32),
    xp: Math.max(0, Math.min(10_000_000, Math.round(profile.xp))),
    streakDays: Math.max(0, Math.min(36_500, Math.round(profile.streakDays))),
    lastActiveDate: (profile.lastActiveDate || '').slice(0, 16),
    unlockedStageIds: (profile.unlockedStageIds ?? ['stage-1']).slice(0, 20),
    completedStageIds: (profile.completedStageIds ?? []).slice(0, 20),
    earnedBadges: (profile.earnedBadges ?? []).slice(0, 30),
    memories: stripUndefinedDeep(profile.memories ?? {}),
    sessions: stripUndefinedDeep((profile.sessions ?? []).slice(-40)),
    tournamentBests: stripUndefinedDeep(profile.tournamentBests ?? {}),
    settings: stripUndefinedDeep(profile.settings),
    activeThemeId: (profile.activeThemeId || DEFAULT_THEME_ID).slice(0, 64),
    customThemes: stripUndefinedDeep((profile.customThemes ?? []).slice(0, 20)),
    updatedByUid: uid.slice(0, 128),
  };

  if (profile.ownerUid && profile.ownerUid.trim().length > 0) {
    raw.ownerUid = profile.ownerUid.trim().slice(0, 128);
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

export function mergeSingleProfile(
  local: UserProfile | undefined,
  cloud: UserProfile
): UserProfile {
  if (!local) return cloud;

  // If local is untouched (0 XP, 0 sessions, no custom password set locally), adopt cloud verbatim
  const localUntouched =
    local.xp === 0 &&
    local.sessions.length === 0 &&
    !local.passwordHash &&
    local.earnedBadges.length === 0;
  if (localUntouched) {
    return cloud;
  }

  // If cloud is untouched while local already has real progress, keep local progress
  const cloudUntouched =
    cloud.xp === 0 &&
    cloud.sessions.length === 0 &&
    !cloud.passwordHash &&
    cloud.earnedBadges.length === 0;
  if (cloudUntouched) {
    return local;
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
