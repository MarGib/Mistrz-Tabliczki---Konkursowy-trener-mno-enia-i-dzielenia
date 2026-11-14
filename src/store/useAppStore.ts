import { onAuthStateChanged } from 'firebase/auth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_BADGES,
  DEFAULT_SETTINGS,
  LEVEL_STAGES,
  TOURNAMENTS,
  createFreshProfile,
} from '../data/curriculum';
import { DEFAULT_THEME_ID } from '../data/themes';
import {
  hashAccountPassword,
  hasAccountPassword,
  normalizeLogin,
  verifyAccountCredentials,
} from '../engine/accountSecurity';
import {
  type ArenaPlayerCard,
  arenaPlayerCardToUserProfile,
  doesProfileNeedCloudPush,
  mergeCompetitionProfiles,
  mergeNotifications,
  mergeProfiles,
  mergeSingleProfile,
  sanitizeFirestoreId,
} from '../engine/cloudMerge';
import {
  type CloudSessionMeta,
  deleteProfileFromCloud,
  ensureCloudGroupForUser,
  fetchArenaBoard,
  fetchGlobalSchoolDirectory,
  getSchoolArenaBoardId,
  joinCloudGroupByCode,
  pushActiveProfileSelectionToCloud,
  pushGlobalSchoolDirectory,
  pushGroupProfileIds,
  pushNotificationsFeedToCloud,
  pushProfileToCloud,
  signInWithGoogleCloud,
  signOutCloud,
  subscribeToArenaBoard,
  subscribeToGroupCloud,
  syncProfilesToArenaBoards,
} from '../engine/cloudSync';
import { generateSessionNotifications } from '../engine/familyNotifications';
import {
  type CirclePlayerCard,
  changeAccountPassword,
  createCircle,
  describeAccountError,
  getSignedInAccountUid,
  joinCircleByCode,
  leaveCircle,
  publishCircleCards,
  pushAccountProfile,
  registerOrSignInAccount,
  signInAccountAndFetch,
  signOutAccount,
  subscribeAccountProfile,
  subscribeCirclePlayers,
} from '../engine/accountCloud';
import {
  type SchoolDirectoryEntry,
  loadLocalSchoolDirectory,
  mergeSchoolDirectories,
  resolveCanonicalSchoolAndClass,
  saveLocalSchoolDirectory,
} from '../engine/schoolDirectory';
import { computeTournamentMedal, updateFactMemory } from '../engine/spacedRepetition';
import { createFreshProfile as createFreshProfileForCloud } from '../data/curriculum';
import { auth, formatFirebaseError } from '../firebase';
import type {
  AppSettings,
  AvatarSpec,
  CircleMembership,
  ColorTheme,
  FamilyNotification,
  SessionRecord,
  TaskAttempt,
  UserProfile,
} from '../types/math';

const STORAGE_KEY = 'mistrz_tabliczki_store_v3';

/** Przerywa operację, która nie odpowiada — dzięki temu UI nigdy nie wisi na „Łączenie…”. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}
const LEGACY_STORAGE_KEYS = [
  'mistrz_tabliczki_store_v2',
  'mistrz_tabliczki_store_v1',
  'mistrz_tabliczki_store',
];

export type CloudSyncStatus = 'offline' | 'connecting' | 'synced' | 'error';

/** Stan synchronizacji konta login + hasło (per profil). */
export interface AccountSyncState {
  state: 'local' | 'needs-password' | 'syncing' | 'synced' | 'error';
  message?: string;
}

function profileLogin(p: Pick<UserProfile, 'login' | 'name'>): string {
  return normalizeLogin(p.login || p.name);
}

function accountFingerprint(p: UserProfile): string {
  return [
    p.xp,
    p.sessions?.length ?? 0,
    p.name,
    p.avatarId,
    p.activeThemeId ?? '',
    p.streakDays,
    (p.customThemes ?? []).length,
    JSON.stringify(p.circles ?? []),
    JSON.stringify(p.settings ?? {}),
    JSON.stringify(p.customAvatarSpec ?? {}),
  ].join('|');
}

export interface StoreState {
  activeProfileId: string;
  profiles: UserProfile[];
  ownedProfileIds: string[];
  hasSelectedProfile: boolean;
  notifications: FamilyNotification[];
}

export const FALLBACK_GUEST_PROFILE: UserProfile = {
  id: 'guest-preview',
  name: 'Gość',
  avatarId: 'owl',
  xp: 0,
  streakDays: 0,
  lastActiveDate: '',
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

function normalizeStoredProfile(raw: UserProfile): UserProfile {
  const safeId = sanitizeFirestoreId(raw.id || 'user-1');
  return {
    ...raw,
    id: safeId,
    name: (raw.name || 'Mistrz').slice(0, 32),
    avatarId: raw.avatarId || 'owl',
    xp: Math.max(0, Number(raw.xp || 0)),
    streakDays: Math.max(0, Number(raw.streakDays || 0)),
    lastActiveDate: raw.lastActiveDate || '',
    unlockedStageIds:
      Array.isArray(raw.unlockedStageIds) && raw.unlockedStageIds.length > 0
        ? raw.unlockedStageIds
        : ['stage-1'],
    completedStageIds: Array.isArray(raw.completedStageIds)
      ? raw.completedStageIds
      : [],
    earnedBadges: Array.isArray(raw.earnedBadges) ? raw.earnedBadges : [],
    memories: raw.memories ?? {},
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    tournamentBests: raw.tournamentBests ?? {},
    settings: {
      ...DEFAULT_SETTINGS,
      ...(raw.settings ?? {}),
    },
    activeThemeId: raw.activeThemeId || DEFAULT_THEME_ID,
    customThemes: Array.isArray(raw.customThemes) ? raw.customThemes : [],
  };
}

export function parseInitialStoreState(raw: string | null): StoreState {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StoreState>;
      if (Array.isArray(parsed?.profiles) && parsed.profiles.length > 0) {
        const idMap = new Map<string, string>();
        const normalizedProfiles = parsed.profiles.map((p) => {
          const norm = normalizeStoredProfile(p);
          if (p.id) idMap.set(p.id, norm.id);
          return norm;
        });

        const remappedActive = parsed.activeProfileId
          ? idMap.get(parsed.activeProfileId) ?? parsed.activeProfileId
          : '';
        const validActive = normalizedProfiles.some((p) => p.id === remappedActive)
          ? remappedActive
          : normalizedProfiles[0].id;

        const owned = Array.isArray(parsed.ownedProfileIds)
          ? parsed.ownedProfileIds
              .map((id) => idMap.get(id) ?? id)
              .filter((id) => normalizedProfiles.some((p) => p.id === id))
          : normalizedProfiles.map((p) => p.id);

        return {
          activeProfileId: validActive,
          profiles: normalizedProfiles,
          ownedProfileIds: owned.length > 0 ? owned : [validActive],
          hasSelectedProfile: Boolean(parsed.hasSelectedProfile),
          notifications: Array.isArray(parsed.notifications)
            ? parsed.notifications
            : [],
        };
      }
    } catch {
      // Fallback to clean empty onboarding state
    }
  }
  return {
    activeProfileId: '',
    profiles: [],
    ownedProfileIds: [],
    hasSelectedProfile: false,
    notifications: [],
  };
}

function loadInitialStore(): StoreState {
  if (typeof window !== 'undefined') {
    try {
      const currentRaw = window.localStorage.getItem(STORAGE_KEY);
      if (currentRaw) {
        const parsedCurrent = parseInitialStoreState(currentRaw);
        if (parsedCurrent.profiles.length > 0) {
          return parsedCurrent;
        }
      }
      // Migrate older local versions without losing local progress, sessions, or passwords
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacyRaw = window.localStorage.getItem(legacyKey);
        if (!legacyRaw) continue;
        const migrated = parseInitialStoreState(legacyRaw);
        if (migrated.profiles.length > 0) {
          return migrated;
        }
      }
      return parseInitialStoreState(currentRaw);
    } catch {
      // Ignore storage error
    }
  }
  return parseInitialStoreState(null);
}

export function useAppStore() {
  const [store, setStore] = useState<StoreState>(loadInitialStore);
  const storeRef = useRef<StoreState>(store);
  storeRef.current = store;

  const [cloudMeta, setCloudMeta] = useState<CloudSessionMeta | null>(null);
  const cloudMetaRef = useRef<CloudSessionMeta | null>(cloudMeta);
  cloudMetaRef.current = cloudMeta;

  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('offline');
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudSubVersion, setCloudSubVersion] = useState(0);
  const [remoteSchools, setRemoteSchools] = useState<SchoolDirectoryEntry[]>([]);
  const [arenaPlayers, setArenaPlayers] = useState<ArenaPlayerCard[]>([]);
  const [localDirectorySeed, setLocalDirectorySeed] = useState<SchoolDirectoryEntry[]>(
    loadLocalSchoolDirectory
  );
  const pushedFingerprintRef = useRef<Map<string, string>>(new Map());

  // ---- Konta login + hasło i grupy ----
  const [accountSync, setAccountSync] = useState<Record<string, AccountSyncState>>({});
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [circlePlayers, setCirclePlayers] = useState<CirclePlayerCard[]>([]);
  const [circleError, setCircleError] = useState<string | null>(null);
  void arenaPlayers;
  void mergeCompetitionProfiles;

  const linkAccountRef = useRef<(profileId: string, password: string) => Promise<void>>(
    async () => {}
  );
  const setSyncFor = useCallback((profileId: string, next: AccountSyncState) => {
    setAccountSync((prev) => ({ ...prev, [profileId]: next }));
  }, []);

  const activeProfileForCircles =
    store.profiles.find((p) => p.id === store.activeProfileId) ?? store.profiles[0];
  const activeCircles = activeProfileForCircles?.circles ?? [];
  const effectiveCircleId =
    selectedCircleId && activeCircles.some((c) => c.id === selectedCircleId)
      ? selectedCircleId
      : null;

  // Porównywanie: w wybranej grupie — jej członkowie; bez grupy — konta z tego urządzenia.
  const competitionProfiles = useMemo(() => {
    const own = store.profiles.filter((p) => store.ownedProfileIds.includes(p.id));
    if (!effectiveCircleId) return own.length > 0 ? own : store.profiles;
    const me = activeProfileForCircles;
    const meCircle = activeCircles.find((c) => c.id === effectiveCircleId);
    const others = circlePlayers
      .filter((c) => !me || c.profileId !== me.id)
      .map((c) => arenaPlayerCardToUserProfile(c));
    return me && meCircle?.share !== false ? [me, ...others] : others;
  }, [
    store.profiles,
    store.ownedProfileIds,
    effectiveCircleId,
    circlePlayers,
    activeProfileForCircles,
    activeCircles,
  ]);

  const schoolDirectory = useMemo(
    () => mergeSchoolDirectories([remoteSchools, localDirectorySeed], competitionProfiles),
    [remoteSchools, localDirectorySeed, competitionProfiles]
  );
  const schoolDirectoryRef = useRef<SchoolDirectoryEntry[]>(schoolDirectory);
  schoolDirectoryRef.current = schoolDirectory;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Ignore storage quota issues
    }
  }, [store]);

  useEffect(() => {
    saveLocalSchoolDirectory(schoolDirectory);
  }, [schoolDirectory]);

  // Fetch non-PII global school & class directory + global arena scoreboard on mount
  useEffect(() => {
    let active = true;
    void fetchGlobalSchoolDirectory().then((entries) => {
      if (active && entries.length > 0) {
        setRemoteSchools(entries);
      }
    });
    void fetchArenaBoard('global').then((players) => {
      if (active && players.length > 0) {
        setArenaPlayers(players);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Listen to Firebase Auth state & sync user workspace + non-PII school/class arena boards
  useEffect(() => {
    let unsubCloud: (() => void) | null = null;
    let unsubGlobalArena: (() => void) | null = null;
    let cancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }
      if (unsubGlobalArena) {
        unsubGlobalArena();
        unsubGlobalArena = null;
      }

      if (!user) {
        setCloudMeta(null);
        setCloudStatus('offline');
        return;
      }

      setCloudStatus('connecting');
      setCloudError(null);

      try {
        const snapshot = storeRef.current;
        const meta = await withTimeout(
          ensureCloudGroupForUser(user, snapshot.profiles, snapshot.activeProfileId),
          25000,
          'Baza nie odpowiada. Sprawdź internet i spróbuj połączyć ponownie.'
        );
        if (cancelled) return;

        setCloudMeta(meta);
        cloudMetaRef.current = meta;
        setCloudStatus('synced');

        if (schoolDirectoryRef.current.length > 0) {
          void pushGlobalSchoolDirectory(schoolDirectoryRef.current);
        }
        if (snapshot.profiles.length > 0) {
          void syncProfilesToArenaBoards(user.uid, snapshot.profiles);
        }

        unsubGlobalArena = subscribeToArenaBoard('global', (players) => {
          setArenaPlayers((prev) => {
            const byId = new Map(prev.map((p) => [p.profileId, p]));
            for (const p of players) {
              byId.set(p.profileId, p);
            }
            return Array.from(byId.values());
          });
        });

        unsubCloud = subscribeToGroupCloud({
          groupId: meta.groupId,
          onProfilesSnapshot: (cloudProfiles) => {
            const cloudById = new Map(cloudProfiles.map((p) => [p.id, p]));
            let mergedForSync: UserProfile[] = [];

            setStore((prev) => {
              const merged = mergeProfiles(prev.profiles, cloudProfiles);
              mergedForSync = merged;
              const ownedSet = new Set(prev.ownedProfileIds);
              for (const prof of merged) {
                if (prof.ownerUid === user.uid) {
                  ownedSet.add(prof.id);
                }
              }
              if (ownedSet.size === 0 && merged.length === 1) {
                ownedSet.add(merged[0].id);
              }
              const nextActive = merged.some((p) => p.id === prev.activeProfileId)
                ? prev.activeProfileId
                : Array.from(ownedSet)[0] ?? merged[0]?.id ?? '';

              return {
                ...prev,
                activeProfileId: nextActive,
                profiles: merged,
                ownedProfileIds: Array.from(ownedSet).filter((id) =>
                  merged.some((p) => p.id === id)
                ),
              };
            });

            // Push back any local progress, accounts, or local passwordHash not yet on cloud
            for (const prof of mergedForSync) {
              const cloudCopy = cloudById.get(prof.id);
              if (doesProfileNeedCloudPush(prof, cloudCopy)) {
                const fp = `${prof.xp}:${prof.sessions.length}:${prof.passwordHash ?? ''}:${prof.schoolName ?? ''}:${prof.className ?? ''}`;
                if (pushedFingerprintRef.current.get(prof.id) !== fp) {
                  pushedFingerprintRef.current.set(prof.id, fp);
                  void pushProfileToCloud(meta.groupId, user.uid, {
                    ...prof,
                    ownerUid: prof.ownerUid || user.uid,
                  }).catch(() => {});
                }
              }
            }

            if (mergedForSync.length > 0) {
              void syncProfilesToArenaBoards(user.uid, mergedForSync);
              const nextDir = mergeSchoolDirectories(
                [schoolDirectoryRef.current],
                mergedForSync
              );
              if (nextDir.length > 0) {
                void pushGlobalSchoolDirectory(nextDir);
              }
            }
          },
          onFeedSnapshot: (cloudNotifs) => {
            setStore((prev) => ({
              ...prev,
              notifications: mergeNotifications(prev.notifications, cloudNotifs),
            }));
          },
          onError: (err) => {
            setCloudStatus('error');
            setCloudError(formatFirebaseError(err));
          },
        });
      } catch (err) {
        if (cancelled) return;
        setCloudStatus('error');
        setCloudError(formatFirebaseError(err));
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubCloud) unsubCloud();
      if (unsubGlobalArena) unsubGlobalArena();
    };
  }, [cloudSubVersion]);

  const activeProfile = useMemo(
    () =>
      store.profiles.find((p) => p.id === store.activeProfileId) ??
      store.profiles[0] ??
      FALLBACK_GUEST_PROFILE,
    [store.profiles, store.activeProfileId]
  );

  // Subscribe to the active user's school-specific arena board so whole school & classes appear live
  useEffect(() => {
    const school = activeProfile.schoolName?.trim();
    if (!school || cloudStatus !== 'synced') return;
    const schoolBoardId = getSchoolArenaBoardId(school);
    const unsubSchoolBoard = subscribeToArenaBoard(schoolBoardId, (players) => {
      setArenaPlayers((prev) => {
        const byId = new Map(prev.map((p) => [p.profileId, p]));
        for (const p of players) {
          byId.set(p.profileId, p);
        }
        return Array.from(byId.values());
      });
    });
    return () => unsubSchoolBoard();
  }, [activeProfile.schoolName, cloudStatus]);

  // Only accounts belonging to THIS user/device appear on the Welcome Gate & Konto switcher
  const ownedProfiles = useMemo(
    () => store.profiles.filter((p) => store.ownedProfileIds.includes(p.id)),
    [store.profiles, store.ownedProfileIds]
  );

  const syncProfileIfConnected = useCallback((profile: UserProfile) => {
    const meta = cloudMetaRef.current;
    if (!meta) return;
    void pushProfileToCloud(meta.groupId, meta.uid, profile).catch(() => {});
    void syncProfilesToArenaBoards(meta.uid, [profile]);
  }, []);

  const updateActiveProfile = useCallback(
    (updater: (profile: UserProfile) => UserProfile) => {
      let updatedTarget: UserProfile | null = null;
      setStore((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) => {
          if (p.id !== prev.activeProfileId) return p;
          updatedTarget = updater(p);
          return updatedTarget;
        }),
      }));
      if (updatedTarget) {
        syncProfileIfConnected(updatedTarget);
      }
    },
    [syncProfileIfConnected]
  );

  const switchProfile = useCallback((profileId: string) => {
    setStore((prev) => {
      if (!prev.profiles.some((p) => p.id === profileId)) return prev;
      const nextOwned = prev.ownedProfileIds.includes(profileId)
        ? prev.ownedProfileIds
        : [...prev.ownedProfileIds, profileId];
      return {
        ...prev,
        activeProfileId: profileId,
        ownedProfileIds: nextOwned,
        hasSelectedProfile: true,
      };
    });
    const meta = cloudMetaRef.current;
    if (meta) {
      void pushActiveProfileSelectionToCloud(meta.uid, profileId).catch(() => {});
    }
  }, []);

  const loginWithCredentials = useCallback(
    (loginInput: string, passwordInput: string): { ok: boolean; error?: string } => {
      const normalized = normalizeLogin(loginInput);
      const target = storeRef.current.profiles.find(
        (p) => normalizeLogin(p.login || p.name) === normalized
      );
      if (!target) {
        return {
          ok: false,
          error: 'Nie znaleziono takiego konta na tym urządzeniu ani w grupie.',
        };
      }
      if (hasAccountPassword(target)) {
        if (!verifyAccountCredentials(target, passwordInput, loginInput)) {
          return {
            ok: false,
            error: 'Nieprawidłowy login lub hasło. Spróbuj ponownie.',
          };
        }
      } else if (
        !storeRef.current.ownedProfileIds.includes(target.id) &&
        target.ownerUid !== cloudMetaRef.current?.uid
      ) {
        return {
          ok: false,
          error: 'To konto nie ma ustawionego hasła i należy do innego gracza.',
        };
      }

      setStore((prev) => ({
        ...prev,
        activeProfileId: target.id,
        ownedProfileIds: prev.ownedProfileIds.includes(target.id)
          ? prev.ownedProfileIds
          : [...prev.ownedProfileIds, target.id],
        hasSelectedProfile: true,
      }));
      const meta = cloudMetaRef.current;
      if (meta) {
        void pushActiveProfileSelectionToCloud(meta.uid, target.id).catch(() => {});
      }
      return { ok: true };
    },
    []
  );

  const reopenProfilePicker = useCallback(() => {
    setStore((prev) => ({
      ...prev,
      hasSelectedProfile: false,
    }));
  }, []);

  const createProfile = useCallback(
    (
      name: string,
      avatarId: string,
      customAvatarSpec?: AvatarSpec,
      login?: string,
      password?: string,
      schoolName?: string,
      className?: string
    ) => {
      const meta = cloudMetaRef.current;
      const canonical = resolveCanonicalSchoolAndClass(
        schoolDirectoryRef.current,
        schoolName,
        className
      );
      const baseCreated = createFreshProfile(
        name,
        avatarId,
        Date.now(),
        customAvatarSpec,
        canonical.schoolName,
        canonical.className
      );
      const trimmedPwd = password?.trim() ?? '';
      const created: UserProfile = {
        ...baseCreated,
        ownerUid: meta?.uid,
        login: normalizeLogin(login || baseCreated.name),
        passwordHash: trimmedPwd
          ? hashAccountPassword(trimmedPwd, baseCreated.id)
          : undefined,
      };
      if (canonical.schoolName) {
        const updatedDir = mergeSchoolDirectories(
          [schoolDirectoryRef.current],
          [created]
        );
        setLocalDirectorySeed(updatedDir);
        if (meta) {
          void pushGlobalSchoolDirectory(updatedDir);
        }
      }
      setStore((prev) => {
        const nextProfiles = [...prev.profiles, created];
        if (meta) {
          void pushProfileToCloud(meta.groupId, meta.uid, created)
            .then(() =>
              pushGroupProfileIds(
                meta.groupId,
                nextProfiles.map((p) => p.id)
              )
            )
            .then(() => syncProfilesToArenaBoards(meta.uid, [created]))
            .catch(() => {});
        }
        return {
          ...prev,
          activeProfileId: created.id,
          profiles: nextProfiles,
          ownedProfileIds: [...prev.ownedProfileIds, created.id],
          hasSelectedProfile: true,
        };
      });
    },
    []
  );

  const deleteProfile = useCallback((profileId: string) => {
    setStore((prev) => {
      const nextOwned = prev.ownedProfileIds.filter((id) => id !== profileId);
      const remaining = prev.profiles.filter((p) => p.id !== profileId);
      const meta = cloudMetaRef.current;
      if (meta) {
        void deleteProfileFromCloud(
          meta.groupId,
          profileId,
          remaining.map((p) => p.id)
        ).catch(() => {});
      }
      const nextActive =
        prev.activeProfileId === profileId ? nextOwned[0] ?? '' : prev.activeProfileId;
      return {
        ...prev,
        activeProfileId: nextActive,
        profiles: remaining,
        ownedProfileIds: nextOwned,
        hasSelectedProfile: nextOwned.length > 0 && Boolean(nextActive),
      };
    });
  }, []);

  const updateProfileMeta = useCallback(
    (
      name: string,
      avatarId: string,
      customAvatarSpec?: AvatarSpec,
      schoolName?: string,
      className?: string
    ) => {
      const hasSchoolUpdate = schoolName !== undefined || className !== undefined;
      const canonical = hasSchoolUpdate
        ? resolveCanonicalSchoolAndClass(
            schoolDirectoryRef.current,
            schoolName,
            className
          )
        : null;

      if (canonical?.schoolName) {
        const updatedDir = mergeSchoolDirectories(
          [schoolDirectoryRef.current],
          [{ schoolName: canonical.schoolName, className: canonical.className }]
        );
        setLocalDirectorySeed(updatedDir);
        if (cloudMetaRef.current) {
          void pushGlobalSchoolDirectory(updatedDir);
        }
      }

      updateActiveProfile((p) => ({
        ...p,
        name: name.trim() || p.name,
        schoolName:
          schoolName !== undefined ? canonical?.schoolName : p.schoolName,
        className:
          className !== undefined ? canonical?.className : p.className,
        avatarId,
        customAvatarSpec:
          avatarId === 'custom'
            ? customAvatarSpec ?? p.customAvatarSpec
            : customAvatarSpec ?? p.customAvatarSpec,
      }));
    },
    [updateActiveProfile]
  );

  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      updateActiveProfile((p) => ({
        ...p,
        settings: { ...p.settings, ...partial },
      }));
    },
    [updateActiveProfile]
  );

  const recordCompletedSession = useCallback(
    (session: SessionRecord, attempts: TaskAttempt[]) => {
      setStore((prev) => {
        const activeBefore = prev.profiles.find(
          (p) => p.id === prev.activeProfileId
        );
        if (!activeBefore) return prev;

        const now = Date.now();
        const nextMemories = { ...activeBefore.memories };
        let improvedHardFact = false;

        for (const attempt of attempts) {
          const prevMem = nextMemories[attempt.problem.id];
          if (prevMem?.mastery === 'trudne' && attempt.isCorrect) {
            improvedHardFact = true;
          }
          const { updated } = updateFactMemory(
            prevMem,
            attempt.problem,
            attempt.isCorrect,
            attempt.timeMs,
            attempt.usedHint,
            now
          );
          nextMemories[attempt.problem.id] = updated;
        }

        const todayStr = new Date(now).toISOString().slice(0, 10);
        const streakDays =
          activeBefore.lastActiveDate === todayStr
            ? Math.max(1, activeBefore.streakDays)
            : activeBefore.streakDays + 1;

        let bonusXp = 0;
        const unlockedStageIds = new Set(activeBefore.unlockedStageIds);
        const completedStageIds = new Set(activeBefore.completedStageIds);
        const earnedBadges = new Set(activeBefore.earnedBadges);
        const newBadges: string[] = [];

        const addBadge = (badge: string) => {
          if (!earnedBadges.has(badge)) {
            earnedBadges.add(badge);
            newBadges.push(badge);
          }
        };

        if (session.stageId && session.passedThreshold) {
          const stage = LEVEL_STAGES.find((s) => s.id === session.stageId);
          if (stage) {
            if (!completedStageIds.has(stage.id)) {
              bonusXp += stage.rewardXp;
            }
            completedStageIds.add(stage.id);
            addBadge(stage.badgeName);
            const nextStage = LEVEL_STAGES.find((s) => s.order === stage.order + 1);
            if (nextStage) {
              unlockedStageIds.add(nextStage.id);
            }
          }
        }

        const nextTournamentBests = { ...activeBefore.tournamentBests };
        if (session.tournamentId) {
          const tourney = TOURNAMENTS.find((t) => t.id === session.tournamentId);
          if (tourney) {
            const totalTimeSec = Math.max(1, Math.round(session.totalTimeMs / 1000));
            const medal = computeTournamentMedal(
              tourney,
              session.accuracyPct,
              totalTimeSec
            );
            const prevBest = nextTournamentBests[tourney.id];
            const isBetter =
              !prevBest ||
              session.accuracyPct > prevBest.bestAccuracyPct ||
              (session.accuracyPct === prevBest.bestAccuracyPct &&
                totalTimeSec < prevBest.bestTimeSec);

            nextTournamentBests[tourney.id] = {
              tournamentId: tourney.id,
              bestAccuracyPct: isBetter
                ? session.accuracyPct
                : prevBest.bestAccuracyPct,
              bestTimeSec: isBetter ? totalTimeSec : prevBest.bestTimeSec,
              medal: medal !== 'brak' ? medal : prevBest?.medal ?? 'brak',
              attemptsCount: (prevBest?.attemptsCount ?? 0) + 1,
              lastPlayedAt: now,
            };

            if (medal !== 'brak') {
              addBadge('Medalistka Turnieju');
              if (!prevBest || prevBest.medal === 'brak') {
                bonusXp += tourney.rewardXp;
              }
            }
          }
        }

        if (improvedHardFact && ALL_BADGES.some((b) => b.id === 'Pogromca Trudnych')) {
          addBadge('Pogromca Trudnych');
        }

        const activeAfter: UserProfile = {
          ...activeBefore,
          xp: activeBefore.xp + session.pointsEarned + bonusXp,
          streakDays,
          lastActiveDate: todayStr,
          unlockedStageIds: Array.from(unlockedStageIds),
          completedStageIds: Array.from(completedStageIds),
          earnedBadges: Array.from(earnedBadges),
          memories: nextMemories,
          sessions: [...activeBefore.sessions, session].slice(-40),
          tournamentBests: nextTournamentBests,
        };

        const otherProfiles = prev.profiles.filter((p) => p.id !== activeBefore.id);
        const freshAlerts = generateSessionNotifications({
          actorBefore: activeBefore,
          actorAfter: activeAfter,
          otherProfiles,
          session,
          newBadges,
          now,
        });

        const nextNotifications = [...freshAlerts, ...(prev.notifications ?? [])].slice(
          0,
          40
        );

        const meta = cloudMetaRef.current;
        if (meta) {
          void pushProfileToCloud(meta.groupId, meta.uid, activeAfter).catch(() => {});
          void syncProfilesToArenaBoards(meta.uid, [activeAfter]);
          if (freshAlerts.length > 0) {
            void pushNotificationsFeedToCloud(
              meta.groupId,
              meta.uid,
              nextNotifications
            ).catch(() => {});
          }
        }

        return {
          ...prev,
          profiles: prev.profiles.map((p) =>
            p.id === activeBefore.id ? activeAfter : p
          ),
          notifications: nextNotifications,
        };
      });
    },
    []
  );

  const setActiveTheme = useCallback(
    (themeId: string) => {
      updateActiveProfile((p) => ({
        ...p,
        activeThemeId: themeId,
      }));
    },
    [updateActiveProfile]
  );

  const saveCustomTheme = useCallback(
    (theme: ColorTheme) => {
      updateActiveProfile((p) => {
        const existing = p.customThemes ?? [];
        const updated = existing.some((t) => t.id === theme.id)
          ? existing.map((t) => (t.id === theme.id ? theme : t))
          : [...existing, theme];
        return {
          ...p,
          customThemes: updated,
          activeThemeId: theme.id,
        };
      });
    },
    [updateActiveProfile]
  );

  const deleteCustomTheme = useCallback(
    (themeId: string) => {
      updateActiveProfile((p) => {
        const remaining = (p.customThemes ?? []).filter((t) => t.id !== themeId);
        return {
          ...p,
          customThemes: remaining,
          activeThemeId:
            p.activeThemeId === themeId ? DEFAULT_THEME_ID : p.activeThemeId,
        };
      });
    },
    [updateActiveProfile]
  );

  const setProfileCredentials = useCallback(
    (profileId: string, login: string, password: string) => {
      let updatedTarget: UserProfile | null = null;
      setStore((prev) => ({
        ...prev,
        activeProfileId: profileId,
        ownedProfileIds: prev.ownedProfileIds.includes(profileId)
          ? prev.ownedProfileIds
          : [...prev.ownedProfileIds, profileId],
        hasSelectedProfile: true,
        profiles: prev.profiles.map((p) => {
          if (p.id !== profileId) return p;
          const normalized = normalizeLogin(login || p.name);
          const trimmedPwd = password.trim();
          updatedTarget = {
            ...p,
            login: normalized,
            passwordHash: trimmedPwd
              ? hashAccountPassword(trimmedPwd, p.id)
              : p.passwordHash,
          };
          return updatedTarget;
        }),
      }));
      if (updatedTarget) {
        syncProfileIfConnected(updatedTarget);
      }
      const trimmed = password.trim();
      if (trimmed.length >= 4) {
        const target = storeRef.current.profiles.find((p) => p.id === profileId);
        const signedIn =
          target?.cloudUid && accountSyncRef.current[profileId]?.state === 'synced';
        if (target && signedIn && !verifyAccountCredentials(target, trimmed)) {
          void changeAccountPassword(profileLogin(target), trimmed).catch(() => {});
        } else {
          window.setTimeout(() => void linkAccountRef.current(profileId, trimmed), 0);
        }
      }
    },
    [syncProfileIfConnected]
  );

  const clearProfilePassword = useCallback(
    (profileId: string) => {
      let updatedTarget: UserProfile | null = null;
      setStore((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) => {
          if (p.id !== profileId) return p;
          updatedTarget = { ...p, passwordHash: undefined };
          return updatedTarget;
        }),
      }));
      if (updatedTarget) {
        syncProfileIfConnected(updatedTarget);
      }
    },
    [syncProfileIfConnected]
  );

  const markNotificationRead = useCallback((notificationId: string) => {
    setStore((prev) => {
      const next = (prev.notifications ?? []).map((n) =>
        n.id === notificationId && !n.readByProfileIds.includes(prev.activeProfileId)
          ? { ...n, readByProfileIds: [...n.readByProfileIds, prev.activeProfileId] }
          : n
      );
      const meta = cloudMetaRef.current;
      if (meta) {
        void pushNotificationsFeedToCloud(meta.groupId, meta.uid, next).catch(() => {});
      }
      return {
        ...prev,
        notifications: next,
      };
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setStore((prev) => {
      const next = (prev.notifications ?? []).map((n) =>
        n.readByProfileIds.includes(prev.activeProfileId)
          ? n
          : { ...n, readByProfileIds: [...n.readByProfileIds, prev.activeProfileId] }
      );
      const meta = cloudMetaRef.current;
      if (meta) {
        void pushNotificationsFeedToCloud(meta.groupId, meta.uid, next).catch(() => {});
      }
      return {
        ...prev,
        notifications: next,
      };
    });
  }, []);

  const connectGoogleCloud = useCallback(async () => {
    setCloudError(null);
    setCloudStatus('connecting');
    try {
      await withTimeout(
        signInWithGoogleCloud(),
        180000,
        'Logowanie Google nie zostało dokończone. Spróbuj ponownie.'
      );
    } catch (err) {
      setCloudStatus('error');
      setCloudError(formatFirebaseError(err));
    }
  }, []);

  const disconnectGoogleCloud = useCallback(async () => {
    await signOutCloud();
    setCloudMeta(null);
    setCloudStatus('offline');
    setCloudError(null);
  }, []);

  const joinGroupCode = useCallback(
    async (rawCode: string): Promise<{ ok: boolean; error?: string }> => {
      const user = auth.currentUser;
      if (!user) {
        return {
          ok: false,
          error: 'Najpierw zaloguj się przez Google, aby dołączyć do grupy kodem.',
        };
      }
      try {
        const snapshot = storeRef.current;
        const { meta, existingProfileIds } = await joinCloudGroupByCode(
          user,
          rawCode,
          snapshot.activeProfileId || snapshot.ownedProfileIds[0] || ''
        );

        // Push local owned profiles into the joined group so classmates/schools see them in Stats
        const ownedList = snapshot.profiles.filter((p) =>
          snapshot.ownedProfileIds.includes(p.id)
        );
        for (const prof of ownedList) {
          const tagged = { ...prof, ownerUid: user.uid };
          await pushProfileToCloud(meta.groupId, meta.uid, tagged);
        }
        if (ownedList.length > 0) {
          const allIds = Array.from(
            new Set([...existingProfileIds, ...ownedList.map((p) => p.id)])
          );
          await pushGroupProfileIds(meta.groupId, allIds).catch(() => {});
          void syncProfilesToArenaBoards(meta.uid, ownedList);
        }

        setCloudMeta(meta);
        cloudMetaRef.current = meta;
        setCloudStatus('synced');
        setCloudSubVersion((v) => v + 1);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: formatFirebaseError(err),
        };
      }
    },
    []
  );


  /* ===================== Konta login + hasło (Firebase) ===================== */
  const accountSyncRef = useRef(accountSync);
  accountSyncRef.current = accountSync;
  const pendingPasswordsRef = useRef<Map<string, string>>(new Map());
  const pushedAccountFpRef = useRef<Map<string, string>>(new Map());

  const mergeCloudIntoLocal = useCallback(
    (local: UserProfile | undefined, cloud: UserProfile, uid: string): UserProfile => {
      const base = local ? mergeSingleProfile(local, { ...cloud, id: local.id }) : cloud;
      return {
        ...base,
        id: local?.id ?? cloud.id,
        login: local?.login ?? cloud.login,
        passwordHash: local?.passwordHash ?? cloud.passwordHash,
        cloudUid: uid,
        circles: cloud.circles ?? local?.circles ?? [],
      };
    },
    []
  );

  const linkAccount = useCallback(
    async (profileId: string, password: string) => {
      const p = storeRef.current.profiles.find((x) => x.id === profileId);
      if (!p || !password) return;
      const login = profileLogin(p);
      setSyncFor(profileId, { state: 'syncing' });
      try {
        if (p.cloudUid) {
          const uid = await getSignedInAccountUid(login);
          if (uid === p.cloudUid) {
            setSyncFor(profileId, { state: 'synced' });
            return;
          }
        }
        const res = await withTimeout(
          registerOrSignInAccount(p, password),
          20000,
          'Baza nie odpowiada. Spróbuj ponownie za chwilę.'
        );
        setStore((prev) => ({
          ...prev,
          profiles: prev.profiles.map((x) =>
            x.id !== profileId
              ? x
              : res.cloudProfile
              ? mergeCloudIntoLocal(x, res.cloudProfile, res.uid)
              : { ...x, cloudUid: res.uid }
          ),
        }));
        pendingPasswordsRef.current.delete(profileId);
        setSyncFor(profileId, { state: 'synced' });
      } catch (err) {
        const code = (err as { code?: string })?.code ?? '';
        if (code === 'auth/network-request-failed') {
          pendingPasswordsRef.current.set(profileId, password);
        }
        setSyncFor(profileId, { state: 'error', message: describeAccountError(err) });
      }
    },
    [mergeCloudIntoLocal, setSyncFor]
  );

  linkAccountRef.current = linkAccount;

  // Ponów synchronizację kont po powrocie internetu.
  useEffect(() => {
    const onOnline = () => {
      for (const [id, pwd] of pendingPasswordsRef.current.entries()) {
        void linkAccount(id, pwd);
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [linkAccount]);

  // Po odświeżeniu strony: które konta mają zapamiętaną sesję w chmurze?
  const ownedCloudKey = store.profiles
    .filter((p) => store.ownedProfileIds.includes(p.id))
    .map((p) => `${p.id}:${p.cloudUid ?? ''}:${p.passwordHash ? 1 : 0}`)
    .join(',');
  useEffect(() => {
    let cancelled = false;
    const snapshot = storeRef.current;
    for (const p of snapshot.profiles) {
      if (!snapshot.ownedProfileIds.includes(p.id)) continue;
      const current = accountSyncRef.current[p.id]?.state;
      if (current === 'synced' || current === 'syncing') continue;
      if (!p.cloudUid) {
        setSyncFor(p.id, {
          state: p.passwordHash ? 'needs-password' : 'local',
          message: p.passwordHash
            ? 'Wpisz hasło jeszcze raz, aby włączyć synchronizację.'
            : 'Ustaw hasło, aby zapisywać wyniki w chmurze i dołączać do grup.',
        });
        continue;
      }
      void getSignedInAccountUid(profileLogin(p)).then((uid) => {
        if (cancelled) return;
        setSyncFor(
          p.id,
          uid === p.cloudUid
            ? { state: 'synced' }
            : { state: 'needs-password', message: 'Wpisz hasło, aby wznowić synchronizację.' }
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, [ownedCloudKey, setSyncFor]);

  // Wysyłanie zmian (wyniki, ustawienia, grupy) do chmury z małym opóźnieniem.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const p of store.profiles) {
        if (!p.cloudUid || !store.ownedProfileIds.includes(p.id)) continue;
        if (accountSync[p.id]?.state !== 'synced') continue;
        const fp = accountFingerprint(p);
        if (pushedAccountFpRef.current.get(p.id) === fp) continue;
        pushedAccountFpRef.current.set(p.id, fp);
        void pushAccountProfile(p).catch(() => pushedAccountFpRef.current.delete(p.id));
        void publishCircleCards(p).catch(() => {});
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [store.profiles, store.ownedProfileIds, accountSync]);

  // Na żywo: zmiany tego samego konta z innego urządzenia.
  const activeSynced =
    Boolean(activeProfile.cloudUid) && accountSync[activeProfile.id]?.state === 'synced';
  const activeLoginKey = profileLogin(activeProfile);
  useEffect(() => {
    if (!activeSynced) return;
    const activeId = activeProfile.id;
    const uid = activeProfile.cloudUid as string;
    return subscribeAccountProfile(activeLoginKey, (cloudProf) => {
      setStore((prev) => ({
        ...prev,
        profiles: prev.profiles.map((x) =>
          x.id === activeId ? mergeCloudIntoLocal(x, cloudProf, uid) : x
        ),
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSynced, activeProfile.id, activeLoginKey, mergeCloudIntoLocal]);

  const createAccountWithCloud = useCallback(
    async (
      name: string,
      avatarId: string,
      password: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const trimmedName = name.trim();
      const pwd = password.trim();
      if (!trimmedName) return { ok: false, error: 'Podaj nazwę gracza.' };
      if (pwd.length < 4) {
        return { ok: false, error: 'Hasło lub PIN musi mieć co najmniej 4 znaki.' };
      }
      const login = normalizeLogin(trimmedName);
      if (storeRef.current.profiles.some((p) => profileLogin(p) === login)) {
        return { ok: false, error: 'Konto o takim loginie już jest na tym urządzeniu. Zaloguj się w „Mam już konto”.' };
      }
      const base = createFreshProfileForCloud(trimmedName, avatarId, Date.now());
      const created: UserProfile = {
        ...base,
        login,
        passwordHash: hashAccountPassword(pwd, base.id),
        circles: [],
      };

      let finalProfile: UserProfile = created;
      let syncState: AccountSyncState = { state: 'synced' };
      try {
        const res = await withTimeout(
          registerOrSignInAccount(created, pwd),
          20000,
          'Baza nie odpowiada.'
        );
        finalProfile = res.cloudProfile
          ? {
              ...res.cloudProfile,
              login,
              passwordHash: hashAccountPassword(pwd, res.cloudProfile.id),
              cloudUid: res.uid,
            }
          : { ...created, cloudUid: res.uid };
      } catch (err) {
        const code = (err as { code?: string })?.code ?? '';
        if (code === 'login-taken' || code === 'auth/email-already-in-use') {
          return { ok: false, error: describeAccountError(err) };
        }
        // Brak internetu: konto działa lokalnie i zsynchronizuje się później.
        pendingPasswordsRef.current.set(created.id, pwd);
        syncState = {
          state: 'error',
          message: 'Brak połączenia — konto zsynchronizuje się, gdy wróci internet.',
        };
      }

      setStore((prev) => ({
        ...prev,
        activeProfileId: finalProfile.id,
        profiles: [...prev.profiles.filter((p) => p.id !== finalProfile.id), finalProfile],
        ownedProfileIds: prev.ownedProfileIds.includes(finalProfile.id)
          ? prev.ownedProfileIds
          : [...prev.ownedProfileIds, finalProfile.id],
        hasSelectedProfile: true,
      }));
      setSyncFor(finalProfile.id, syncState);
      return { ok: true };
    },
    [setSyncFor]
  );

  /** „Mam już konto”: login + hasło — najpierw to urządzenie, potem chmura. */
  const loginToCloudAccount = useCallback(
    async (loginInput: string, passwordInput: string): Promise<{ ok: boolean; error?: string }> => {
      const login = normalizeLogin(loginInput);
      const pwd = passwordInput.trim();
      if (!loginInput.trim()) return { ok: false, error: 'Wpisz swój login.' };

      const local = storeRef.current.profiles.find((p) => profileLogin(p) === login);
      if (local && hasAccountPassword(local) && verifyAccountCredentials(local, pwd, loginInput)) {
        setStore((prev) => ({
          ...prev,
          activeProfileId: local.id,
          ownedProfileIds: prev.ownedProfileIds.includes(local.id)
            ? prev.ownedProfileIds
            : [...prev.ownedProfileIds, local.id],
          hasSelectedProfile: true,
        }));
        void linkAccount(local.id, pwd);
        return { ok: true };
      }
      if (!pwd) return { ok: false, error: 'Wpisz hasło lub PIN.' };

      try {
        const res = await withTimeout(
          signInAccountAndFetch(login, pwd),
          20000,
          'Baza nie odpowiada. Sprawdź internet.'
        );
        const cloud = res.profile;
        setStore((prev) => {
          const existing = prev.profiles.find((p) => p.id === cloud.id);
          const merged: UserProfile = {
            ...(existing ? mergeCloudIntoLocal(existing, cloud, res.uid) : cloud),
            login,
            passwordHash: hashAccountPassword(pwd, cloud.id),
            cloudUid: res.uid,
          };
          return {
            ...prev,
            activeProfileId: merged.id,
            profiles: [...prev.profiles.filter((p) => p.id !== merged.id), merged],
            ownedProfileIds: prev.ownedProfileIds.includes(merged.id)
              ? prev.ownedProfileIds
              : [...prev.ownedProfileIds, merged.id],
            hasSelectedProfile: true,
          };
        });
        setSyncFor(cloud.id, { state: 'synced' });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: describeAccountError(err) };
      }
    },
    [linkAccount, mergeCloudIntoLocal, setSyncFor]
  );

  /** Wyloguj konto z tego urządzenia. Konto w chmurze zostaje — można zalogować się ponownie. */
  const logoutAccount = useCallback(
    async (profileId: string) => {
      const p = storeRef.current.profiles.find((x) => x.id === profileId);
      if (!p) return;
      if (p.cloudUid) {
        // Wyślij ostatnie zmiany przed wylogowaniem.
        await pushAccountProfile(p).catch(() => {});
        await signOutAccount(profileLogin(p)).catch(() => {});
      }
      setStore((prev) => {
        const remaining = p.cloudUid ? prev.profiles.filter((x) => x.id !== profileId) : prev.profiles;
        const owned = prev.ownedProfileIds.filter((id) => id !== profileId);
        return {
          ...prev,
          profiles: remaining,
          ownedProfileIds: p.cloudUid ? owned : prev.ownedProfileIds,
          activeProfileId: owned[0] ?? '',
          hasSelectedProfile: false,
        };
      });
      setAccountSync((prev) => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
      setSelectedCircleId(null);
    },
    []
  );

  /* ============================== Grupy ============================== */
  const updateProfileCircles = useCallback(
    (profileId: string, updater: (list: CircleMembership[]) => CircleMembership[]) => {
      setStore((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === profileId ? { ...p, circles: updater(p.circles ?? []) } : p
        ),
      }));
    },
    []
  );

  const requireSyncedActive = useCallback((): UserProfile | string => {
    const snap = storeRef.current;
    const p = snap.profiles.find((x) => x.id === snap.activeProfileId);
    if (!p) return 'Najpierw wybierz konto.';
    if (!p.cloudUid || accountSyncRef.current[p.id]?.state !== 'synced') {
      return 'Grupy działają dla kont z hasłem zsynchronizowanych w chmurze. Ustaw lub wpisz hasło w zakładce Konto.';
    }
    return p;
  }, []);

  const createGroup = useCallback(
    async (name: string): Promise<{ ok: boolean; error?: string }> => {
      const p = requireSyncedActive();
      if (typeof p === 'string') return { ok: false, error: p };
      try {
        const m = await withTimeout(createCircle(profileLogin(p), name), 20000, 'Baza nie odpowiada.');
        updateProfileCircles(p.id, (list) => [...list.filter((c) => c.id !== m.id), m]);
        setSelectedCircleId(m.id);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: describeAccountError(err) };
      }
    },
    [requireSyncedActive, updateProfileCircles]
  );

  const joinGroup = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string }> => {
      const p = requireSyncedActive();
      if (typeof p === 'string') return { ok: false, error: p };
      try {
        const m = await withTimeout(joinCircleByCode(profileLogin(p), code), 20000, 'Baza nie odpowiada.');
        updateProfileCircles(p.id, (list) => [...list.filter((c) => c.id !== m.id), m]);
        setSelectedCircleId(m.id);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: describeAccountError(err) };
      }
    },
    [requireSyncedActive, updateProfileCircles]
  );

  const leaveGroup = useCallback(
    async (circleId: string): Promise<{ ok: boolean; error?: string }> => {
      const p = requireSyncedActive();
      if (typeof p === 'string') return { ok: false, error: p };
      try {
        await leaveCircle(profileLogin(p), circleId);
      } catch (err) {
        return { ok: false, error: describeAccountError(err) };
      }
      updateProfileCircles(p.id, (list) => list.filter((c) => c.id !== circleId));
      setSelectedCircleId((cur) => (cur === circleId ? null : cur));
      return { ok: true };
    },
    [requireSyncedActive, updateProfileCircles]
  );

  const setGroupShare = useCallback(
    (circleId: string, share: boolean) => {
      const snap = storeRef.current;
      updateProfileCircles(snap.activeProfileId, (list) =>
        list.map((c) => (c.id === circleId ? { ...c, share } : c))
      );
    },
    [updateProfileCircles]
  );

  // Wyniki członków wszystkich grup aktywnego konta + powiadomienia o wyprzedzeniu.
  const [playersByCircle, setPlayersByCircle] = useState<Record<string, CirclePlayerCard[]>>({});
  const circlesKey = activeCircles.map((c) => c.id).join(',');
  useEffect(() => {
    setPlayersByCircle({});
    setCircleError(null);
    if (!activeSynced || activeCircles.length === 0) return;
    const meId = activeProfile.id;
    const unsubs = activeCircles.map((circle) => {
      const prevXp = new Map<string, number>();
      let first = true;
      return subscribeCirclePlayers(
        activeLoginKey,
        circle.id,
        (players) => {
          setPlayersByCircle((prev) => ({ ...prev, [circle.id]: players }));
          const me = storeRef.current.profiles.find((x) => x.id === meId);
          if (!first && me) {
            const fresh: FamilyNotification[] = [];
            for (const pl of players) {
              if (pl.profileId === me.id) continue;
              const before = prevXp.get(pl.uid);
              if (before !== undefined && before <= me.xp && pl.xp > me.xp) {
                fresh.push({
                  id: `ovt-${circle.id}-${pl.uid}-${Date.now()}`,
                  createdAt: Date.now(),
                  type: 'xp_overtake',
                  actorProfileId: pl.profileId,
                  actorName: pl.name,
                  targetProfileId: me.id,
                  title: `${pl.name} wyprzedza Cię w grupie „${circle.name}”!`,
                  message: `${pl.name} ma ${pl.xp} XP, a Ty ${me.xp} XP. Jedna seria i możesz odzyskać miejsce!`,
                  readByProfileIds: [],
                });
              }
            }
            if (fresh.length > 0) {
              setStore((prev) => ({
                ...prev,
                notifications: [...fresh, ...(prev.notifications ?? [])].slice(0, 80),
              }));
            }
          }
          first = false;
          for (const pl of players) prevXp.set(pl.uid, pl.xp);
        },
        (err) => setCircleError(describeAccountError(err))
      );
    });
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSynced, activeProfile.id, activeLoginKey, circlesKey]);

  useEffect(() => {
    setCirclePlayers(effectiveCircleId ? playersByCircle[effectiveCircleId] ?? [] : []);
  }, [effectiveCircleId, playersByCircle]);

  const resetLocalData = useCallback(() => {
    setStore({
      activeProfileId: '',
      profiles: [],
      ownedProfileIds: [],
      hasSelectedProfile: false,
      notifications: [],
    });
  }, []);

  return {
    profiles: store.profiles,
    competitionProfiles,
    ownedProfiles,
    activeProfile,
    hasSelectedProfile: store.hasSelectedProfile,
    notifications: store.notifications ?? [],
    schoolDirectory,
    cloudMeta,
    cloudStatus,
    cloudError,
    switchProfile,
    loginWithCredentials,
    reopenProfilePicker,
    createProfile,
    deleteProfile,
    updateProfileMeta,
    setProfileCredentials,
    clearProfilePassword,
    markNotificationRead,
    markAllNotificationsRead,
    updateSettings,
    recordCompletedSession,
    setActiveTheme,
    saveCustomTheme,
    deleteCustomTheme,
    connectGoogleCloud,
    disconnectGoogleCloud,
    joinGroupCode,
    resetLocalData,
    accountSync,
    logoutAccount,
    loginToCloudAccount,
    createAccountWithCloud,
    selectedCircleId: effectiveCircleId,
    setSelectedCircleId,
    circles: activeCircles,
    circleError,
    createGroup,
    joinGroup,
    leaveGroup,
    setGroupShare,
  };
}
