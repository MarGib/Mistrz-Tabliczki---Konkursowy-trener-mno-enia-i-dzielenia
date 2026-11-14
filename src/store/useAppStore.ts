import { reloadIfNewVersion } from '../autoUpdate';
import { deviceHeartbeat } from '../engine/telemetry';
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
  LEGACY_GOOGLE_SYNC_ENABLED,
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
  ensureAccount,
  ensureCircleMembership,
  logLoginEvent,
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
  /** waiting = chwilowy problem (sieć, baza) — aplikacja ponawia sama, nic nie trzeba robić. */
  state: 'local' | 'needs-password' | 'syncing' | 'synced' | 'waiting' | 'error';
  message?: string;
  /** Kiedy nastąpi kolejna automatyczna próba (ms). */
  retryAt?: number;
  /** Wyniki zapisane na urządzeniu jeszcze nie dotarły do bazy. */
  unsent?: boolean;
}

/** Ogólny problem z bazą, widoczny dla wszystkich (np. wyczerpany dzienny limit darmowej bazy). */
export interface DbIssue {
  kind: 'quota';
  until: number;
}

const DB_PAUSE_KEY = 'mt_db_pause_until';
const DB_PAUSE_LEVEL_KEY = 'mt_db_pause_level';

function readLs(key: string): number {
  try {
    return Number(window.localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function isQuotaError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code ?? '');
  return code === 'resource-exhausted' || code === 'auth/quota-exceeded' || code === 'auth/too-many-requests';
}

/** Ponawianie: 5 s, 15 s, 30 s, 1 min, 2 min, potem co 5 min. */
const RETRY_STEPS_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000];

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

type LinkResult = 'synced' | 'needs-password' | 'error' | 'skip';

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

  const joinGroupRef = useRef<(code: string) => Promise<{ ok: boolean; error?: string }>>(
    async () => ({ ok: false })
  );
  const loginToCloudAccountRef = useRef<
    (login: string, password: string, opts?: { cloudOnly?: boolean }) => Promise<{ ok: boolean; error?: string }>
  >(async () => ({ ok: false }));
  const linkAccountRef = useRef<(profileId: string, password?: string) => Promise<LinkResult>>(
    async () => 'skip'
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
    // Stara baza (AI Studio) — tylko gdy dawna synchronizacja Google jest włączona.
    if (!LEGACY_GOOGLE_SYNC_ENABLED) return;
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
    if (!LEGACY_GOOGLE_SYNC_ENABLED) return;
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
    if (!LEGACY_GOOGLE_SYNC_ENABLED || !school || cloudStatus !== 'synced') return;
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

        let masterLevel = activeBefore.masterLevel ?? 0;
        if (session.masterLevel && session.passedThreshold && session.masterLevel > masterLevel) {
          masterLevel = session.masterLevel;
          bonusXp += 150 + (session.masterLevel - 1) * 40;
          if (masterLevel >= 5) addBadge('Wyzwanie Mistrza');
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
          masterLevel,
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
        if (target && signedIn && target.passwordHash) {
          void changeAccountPassword(profileLogin(target), target.passwordHash).catch(() => {});
        } else {
          window.setTimeout(async () => {
            const linked = await linkAccountRef.current(profileId, trimmed);
            if (linked !== 'needs-password') return;
            // Konto w chmurze założono na innym urządzeniu (inny identyfikator profilu) —
            // zaloguj zwykłą drogą: login + hasło, i połącz wyniki z tego urządzenia.
            const res = await loginToCloudAccountRef.current(normalizeLogin(login || target?.name || ""), trimmed, {
              cloudOnly: true,
            });
            if (!res.ok) {
              setSyncFor(profileId, { state: 'needs-password', message: res.error ?? 'Nieprawidłowe hasło.' });
            }
          }, 0);
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
      // Kody nowych grup (G-…) obsługuje mechanizm grup, nie dawny workspace Google.
      const cleaned = rawCode.trim().toUpperCase();
      if (cleaned.startsWith('G')) {
        return joinGroupRef.current(cleaned);
      }
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
  const linkFailuresRef = useRef<Map<string, number>>(new Map());
  // Bezpiecznik bazy: przy wyczerpanym limicie wszystkie zapisy z tego urządzenia czekają
  // (15 → 30 → 60 min), zamiast co chwilę obciążać darmową bazę. Stan przetrwa odświeżenie.
  const dbPauseUntilRef = useRef<number>(readLs(DB_PAUSE_KEY));
  const [dbIssue, setDbIssue] = useState<DbIssue | null>(() =>
    readLs(DB_PAUSE_KEY) > Date.now() ? { kind: 'quota', until: readLs(DB_PAUSE_KEY) } : null
  );
  const noteDbError = useCallback((err: unknown) => {
    if (!isQuotaError(err)) return;
    const level = readLs(DB_PAUSE_LEVEL_KEY) + 1;
    const minutes = Math.min(60, 15 * 2 ** (level - 1)) * (0.85 + Math.random() * 0.3);
    const until = Date.now() + Math.round(minutes * 60_000);
    dbPauseUntilRef.current = until;
    try {
      window.localStorage.setItem(DB_PAUSE_KEY, String(until));
      window.localStorage.setItem(DB_PAUSE_LEVEL_KEY, String(level));
    } catch {
      // ignore
    }
    setDbIssue({ kind: 'quota', until });
  }, []);
  const noteDbOk = useCallback(() => {
    if (!dbPauseUntilRef.current && readLs(DB_PAUSE_LEVEL_KEY) === 0) return;
    dbPauseUntilRef.current = 0;
    try {
      window.localStorage.removeItem(DB_PAUSE_KEY);
      window.localStorage.removeItem(DB_PAUSE_LEVEL_KEY);
    } catch {
      // ignore
    }
    setDbIssue(null);
  }, []);
  const dbPaused = () => dbPauseUntilRef.current > Date.now();
  const linkRetryTimersRef = useRef<Map<string, number>>(new Map());
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
        circles: local ? base.circles ?? [] : cloud.circles ?? [],
      };
    },
    []
  );

  const cardFpRef = useRef<Map<string, string>>(new Map());
  const [pushTick, setPushTick] = useState(0);
  const circlesEnsuredRef = useRef<Set<string>>(new Set());
  const ensureCircles = useCallback(async (profileId: string) => {
    if (circlesEnsuredRef.current.has(profileId)) return;
    const p = storeRef.current.profiles.find((x) => x.id === profileId);
    if (!p || !(p.circles ?? []).length) return;
    circlesEnsuredRef.current.add(profileId);
    const login = profileLogin(p);
    for (const c of p.circles ?? []) {
      try {
        const upd = await ensureCircleMembership(login, c);
        if (upd) {
          setStore((prev) => ({
            ...prev,
            profiles: prev.profiles.map((x) =>
              x.id !== profileId
                ? x
                : { ...x, circles: (x.circles ?? []).map((cc) => (cc.id === upd.id ? { ...cc, owner: true } : cc)) }
            ),
          }));
        }
      } catch {
        circlesEnsuredRef.current.delete(profileId);
      }
    }
    // Wymuś publikację kart wyników w nowej bazie.
    cardFpRef.current.delete(profileId);
    setPushTick((t) => t + 1);
  }, []);

  /**
   * Łączy konto z bazą. Hasło nie jest potrzebne — wystarczy skrót hasła zapisany w profilu,
   * dzięki czemu przejście na nową bazę odbywa się po cichu, bez udziału dziecka.
   */
  const linkAccount = useCallback(
    async (profileId: string, _password?: string): Promise<LinkResult> => {
      void _password;
      const p = storeRef.current.profiles.find((x) => x.id === profileId);
      if (!p || !p.passwordHash) return 'skip';
      if (p.cloudOptOut) {
        setSyncFor(profileId, { state: 'local' });
        return 'skip';
      }
      if (dbPaused()) {
        const wait = dbPauseUntilRef.current - Date.now() + 1000;
        window.clearTimeout(linkRetryTimersRef.current.get(profileId));
        linkRetryTimersRef.current.set(profileId, window.setTimeout(() => void linkAccountRef.current(profileId), wait));
        pendingPasswordsRef.current.set(profileId, '');
        return 'error';
      }
      const login = profileLogin(p);
      setSyncFor(profileId, { state: 'syncing' });
      try {
        if (p.cloudUid) {
          const uid = await getSignedInAccountUid(login);
          if (uid === p.cloudUid) {
            pendingPasswordsRef.current.delete(profileId);
            setSyncFor(profileId, { state: 'synced' });
            void ensureCircles(profileId);
            return 'synced';
          }
        }
        const res = await withTimeout(
          ensureAccount(p),
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
        linkFailuresRef.current.delete(profileId);
        noteDbOk();
        setSyncFor(profileId, { state: 'synced' });
        void ensureCircles(profileId);
        return 'synced';
      } catch (err) {
        const code = (err as { code?: string })?.code ?? '';
        if (code === 'login-taken') {
          setSyncFor(profileId, {
            state: 'needs-password',
            message: 'Wpisz hasło, aby wznowić synchronizację.',
          });
          return 'needs-password';
        }
        pendingPasswordsRef.current.set(profileId, '');
        noteDbError(err);
        const n = linkFailuresRef.current.get(profileId) ?? 0;
        linkFailuresRef.current.set(profileId, n + 1);
        // Losowe rozrzucenie ponowień (±25%), by przy wielu użytkownikach nie uderzali w bazę jednocześnie.
        const delay = Math.round(RETRY_STEPS_MS[Math.min(n, RETRY_STEPS_MS.length - 1)] * (0.75 + Math.random() * 0.5));
        window.clearTimeout(linkRetryTimersRef.current.get(profileId));
        linkRetryTimersRef.current.set(
          profileId,
          window.setTimeout(() => void linkAccountRef.current(profileId), delay)
        );
        setSyncFor(profileId, {
          state: 'waiting',
          message: `${describeAccountError(err)} Ponowię automatycznie.`,
          retryAt: Date.now() + delay,
        });
        return 'error';
      }
    },
    [mergeCloudIntoLocal, setSyncFor, ensureCircles, noteDbError, noteDbOk]
  );

  linkAccountRef.current = linkAccount;

  /** Włącza/wyłącza synchronizację z chmurą dla konta (wyłączona = wszystko działa tylko na tym urządzeniu). */
  const setCloudSync = useCallback(
    (profileId: string, enabled: boolean) => {
      setStore((prev) => ({
        ...prev,
        profiles: prev.profiles.map((x) => (x.id === profileId ? { ...x, cloudOptOut: enabled ? undefined : true } : x)),
      }));
      if (enabled) {
        window.setTimeout(() => void linkAccountRef.current(profileId), 50);
      } else {
        window.clearTimeout(linkRetryTimersRef.current.get(profileId));
        pendingPasswordsRef.current.delete(profileId);
        setSyncFor(profileId, { state: 'local' });
      }
    },
    [setSyncFor]
  );

  // Zgłoszenie urządzenia dla panelu administratora (najwyżej raz na 12 h, po chwili od startu).
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const t = window.setTimeout(() => {
      const owned = storeRef.current.profiles.filter((p) => storeRef.current.ownedProfileIds.includes(p.id));
      deviceHeartbeat({
        logins: owned.map((p) => profileLogin(p)),
        unsent: Object.values(accountSyncRef.current).some((s) => s?.unsent || s?.state === 'waiting'),
        dbPaused: dbPauseUntilRef.current > Date.now(),
      });
    }, 8000);
    return () => window.clearTimeout(t);
  }, [store.ownedProfileIds]);

  /** „Spróbuj teraz”: natychmiastowa ponowna próba połączenia i wysyłki. */
  const retrySync = useCallback((profileId: string) => {
    dbPauseUntilRef.current = 0; // jedna próba „na żądanie”, nawet w czasie przerwy
    linkFailuresRef.current.delete(profileId);
    pushFailuresRef.current.delete(profileId);
    pushedAccountFpRef.current.delete(profileId);
    window.clearTimeout(linkRetryTimersRef.current.get(profileId));
    void linkAccountRef.current(profileId).then(() => setPushTick((t) => t + 1));
  }, []);

  // Ponów synchronizację kont po powrocie internetu.
  useEffect(() => {
    const onOnline = () => {
      linkFailuresRef.current.clear();
      for (const [id, pwd] of pendingPasswordsRef.current.entries()) {
        void linkAccount(id, pwd);
      }
      setPushTick((t) => t + 1);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') onOnline();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
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
      if (!p.passwordHash) {
        setSyncFor(p.id, {
          state: 'local',
          message: 'Ustaw hasło, aby zapisywać wyniki w chmurze i dołączać do grup.',
        });
        continue;
      }
      // Po cichu: wznów sesję albo przenieś konto do nowej bazy.
      if (!cancelled) void linkAccountRef.current(p.id);
    }
    return () => {
      cancelled = true;
    };
  }, [ownedCloudKey, setSyncFor]);

  // Wysyłanie zmian (wyniki, ustawienia, grupy) do chmury — oszczędnie:
  //  * najwyżej jeden zapis konta na 5 s (kolejne zmiany są łączone),
  //  * karta wyników w grupach tylko, gdy zmieniły się wyniki lub widoczność,
  //  * bezpiecznik: >20 zapisów jednego konta w 10 min = wstrzymanie (ochrona dziennego limitu bazy).
  const lastPushAtRef = useRef<Map<string, number>>(new Map());
  const pushFailuresRef = useRef<Map<string, number>>(new Map());
  const pushLogRef = useRef<Map<string, number[]>>(new Map());
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = Date.now();
      let retryIn = 0;
      for (const p of store.profiles) {
        if (!p.cloudUid || !store.ownedProfileIds.includes(p.id)) continue;
        if (accountSync[p.id]?.state !== 'synced') continue;
        const fp = accountFingerprint(p);
        if (pushedAccountFpRef.current.get(p.id) === fp) continue;
        // Odstęp między zapisami: zwykle 5 s; gdy ktoś gra bardzo dużo serii pod rząd
        // (>20 zapisów w 10 min) — zwalniamy do 1 zapisu na minutę, ale NIGDY nie wstrzymujemy.
        // Zmiany i tak się łączą, więc nic nie ginie.
        if (dbPauseUntilRef.current > now) {
          retryIn = Math.max(retryIn, dbPauseUntilRef.current - now + 1000);
          continue;
        }
        const log = (pushLogRef.current.get(p.id) ?? []).filter((t) => now - t < 10 * 60_000);
        const minGap = log.length >= 20 ? 60_000 : 5000;
        const last = lastPushAtRef.current.get(p.id) ?? 0;
        if (now - last < minGap) {
          retryIn = Math.max(retryIn, minGap - (now - last));
          continue;
        }
        log.push(now);
        pushLogRef.current.set(p.id, log);
        lastPushAtRef.current.set(p.id, now);
        pushedAccountFpRef.current.set(p.id, fp);
        {
          const pid = p.id;
          // Zapis trafia od razu do trwałej kolejki na urządzeniu; jeśli baza nie potwierdzi go w 12 s,
          // pokazujemy spokojną informację — wyśle się sam, gdy wróci połączenie.
          const slowTimer = window.setTimeout(() => {
            setSyncFor(pid, {
              state: 'synced',
              unsent: true,
              message: 'Wyniki są bezpieczne na tym urządzeniu i wyślą się same, gdy wróci internet.',
            });
          }, 12_000);
          void pushAccountProfile(p)
            .then(() => {
              window.clearTimeout(slowTimer);
              pushFailuresRef.current.delete(pid);
              noteDbOk();
              if (accountSyncRef.current[pid]?.unsent) setSyncFor(pid, { state: 'synced' });
            })
            .catch((err) => {
              window.clearTimeout(slowTimer);
              pushedAccountFpRef.current.delete(pid);
              noteDbError(err);
              const n = pushFailuresRef.current.get(pid) ?? 0;
              pushFailuresRef.current.set(pid, n + 1);
              const delay = Math.round(RETRY_STEPS_MS[Math.min(n, RETRY_STEPS_MS.length - 1)] * (0.75 + Math.random() * 0.5));
              setSyncFor(pid, {
                state: 'synced',
                unsent: true,
                message: `${describeAccountError(err)} Ponowię wysyłanie automatycznie.`,
                retryAt: Date.now() + delay,
              });
              window.setTimeout(() => setPushTick((t) => t + 1), delay);
            });
        }
        const cardFp = [
          p.xp,
          p.sessions?.length ?? 0,
          p.streakDays,
          p.name,
          p.avatarId,
          (p.circles ?? []).map((c) => `${c.id}:${c.share ? 1 : 0}`).join(','),
        ].join('|');
        if (cardFpRef.current.get(p.id) !== cardFp) {
          cardFpRef.current.set(p.id, cardFp);
          void publishCircleCards(p).catch((err) => {
            cardFpRef.current.delete(p.id);
            noteDbError(err);
          });
        }
      }
      if (retryIn > 0) window.setTimeout(() => setPushTick((t) => t + 1), retryIn + 50);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [store.profiles, store.ownedProfileIds, accountSync, pushTick, setSyncFor, noteDbError, noteDbOk]);

  // Ponawianie kont, których nie udało się połączyć (brak sieci / limit bazy) — co 2 min.
  useEffect(() => {
    const id = window.setInterval(() => {
      for (const [pid, pwd] of pendingPasswordsRef.current.entries()) {
        void linkAccountRef.current(pid, pwd);
      }
    }, 120_000);
    return () => window.clearInterval(id);
  }, []);

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
      password: string,
      localOnly = false
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
        ...(localOnly ? { cloudOptOut: true } : {}),
      };

      let finalProfile: UserProfile = created;
      let syncState: AccountSyncState = { state: 'synced' };
      try {
        if (localOnly) throw Object.assign(new Error('local-only'), { code: 'local-only' });
        // Krótko czekamy na bazę (by wykryć zajęty login); gdy nie odpowiada — konto działa lokalnie od razu.
        const res = await withTimeout(registerOrSignInAccount(created, pwd), 6000, 'Baza nie odpowiada.');
        finalProfile = res.cloudProfile
          ? {
              ...res.cloudProfile,
              id: created.id,
              login,
              passwordHash: created.passwordHash,
              cloudUid: res.uid,
            }
          : { ...created, cloudUid: res.uid };
      } catch (err) {
        const code = (err as { code?: string })?.code ?? '';
        if (code === 'login-taken' || code === 'auth/email-already-in-use') {
          return { ok: false, error: describeAccountError(err) };
        }
        if (code === 'local-only') {
          syncState = { state: 'local' };
        } else {
        // Brak internetu: konto działa lokalnie i zsynchronizuje się później.
        pendingPasswordsRef.current.set(created.id, pwd);
        syncState = {
          state: 'waiting',
          message: 'Brak połączenia — konto działa na tym urządzeniu i połączy się z chmurą samo, gdy wróci internet.',
        };
        window.setTimeout(() => void linkAccountRef.current(created.id), RETRY_STEPS_MS[0]);
        }
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
    async (
      loginInput: string,
      passwordInput: string,
      opts?: { cloudOnly?: boolean }
    ): Promise<{ ok: boolean; error?: string }> => {
      const login = normalizeLogin(loginInput);
      const pwd = passwordInput.trim();
      if (!loginInput.trim()) return { ok: false, error: 'Wpisz swój login.' };

      const local = opts?.cloudOnly ? undefined : storeRef.current.profiles.find((p) => profileLogin(p) === login);
      if (local && hasAccountPassword(local) && verifyAccountCredentials(local, pwd, loginInput)) {
        setStore((prev) => ({
          ...prev,
          activeProfileId: local.id,
          ownedProfileIds: prev.ownedProfileIds.includes(local.id)
            ? prev.ownedProfileIds
            : [...prev.ownedProfileIds, local.id],
          hasSelectedProfile: true,
        }));
        void logLoginEvent(loginInput, true, 'ok');
        // Konto jest na tym urządzeniu — wchodzimy od razu, bez czekania na bazę.
        // Połączenie z chmurą dzieje się w tle; gdy hasło w chmurze jest inne, próbujemy zwykłego logowania.
        if (!local.cloudOptOut) {
          void (async () => {
            const linked = await linkAccountRef.current(local.id, pwd);
            if (linked !== 'needs-password') return;
            const r = await loginToCloudAccountRef.current(loginInput, pwd, { cloudOnly: true });
            if (!r.ok) {
              setSyncFor(local.id, {
                state: 'needs-password',
                message: r.error ?? 'Wpisz hasło, aby wznowić synchronizację.',
              });
            }
          })();
        }
        return { ok: true };
      }
      if (!pwd) return { ok: false, error: 'Wpisz hasło lub PIN.' };

      try {
        const res = await withTimeout(
          signInAccountAndFetch(login, pwd),
          20000,
          'Baza nie odpowiada. Sprawdź internet.'
        );
        const cloud: UserProfile = {
          ...(res.profile ??
            createFreshProfileForCloud(loginInput.trim(), 'owl', Date.now())),
          id: res.profileId,
          login,
        };
        if (!cloud.circles) cloud.circles = [];
        setStore((prev) => {
          const existing =
            prev.profiles.find((p) => p.id === cloud.id) ??
            prev.profiles.find((p) => profileLogin(p) === login);
          const merged: UserProfile = {
            ...(existing ? mergeCloudIntoLocal(existing, { ...cloud, id: existing.id }, res.uid) : cloud),
            id: cloud.id,
            login,
            passwordHash: res.passwordHash,
            cloudUid: res.uid,
          };
          const replaceId = (id: string) => (existing && id === existing.id ? cloud.id : id);
          const owned = prev.ownedProfileIds.map(replaceId);
          return {
            ...prev,
            activeProfileId: merged.id,
            profiles: [
              ...prev.profiles.filter((p) => p.id !== merged.id && p.id !== existing?.id),
              merged,
            ],
            ownedProfileIds: owned.includes(merged.id) ? owned : [...owned, merged.id],
            hasSelectedProfile: true,
          };
        });
        setSyncFor(cloud.id, { state: 'synced' });
        circlesEnsuredRef.current.delete(cloud.id);
        window.setTimeout(() => void ensureCircles(cloud.id), 500);
        void logLoginEvent(loginInput, true, 'ok');
        return { ok: true };
      } catch (err) {
        const code = String((err as { code?: string })?.code ?? '');
        const msg = err instanceof Error ? err.message : '';
        void logLoginEvent(
          loginInput,
          false,
          code.startsWith('auth/invalid') || code === 'auth/wrong-password'
            ? 'invalid-credential'
            : /nie odpowiada/i.test(msg)
            ? 'timeout'
            : code === 'auth/network-request-failed'
            ? 'network'
            : code || msg.slice(0, 60) || 'inny błąd'
        );
        void reloadIfNewVersion();
        return { ok: false, error: describeAccountError(err) };
      }
    },
    [linkAccount, mergeCloudIntoLocal, setSyncFor, ensureCircles]
  );

  loginToCloudAccountRef.current = loginToCloudAccount;

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
    async (name: string): Promise<{ ok: boolean; error?: string; circle?: CircleMembership }> => {
      const p = requireSyncedActive();
      if (typeof p === 'string') return { ok: false, error: p };
      try {
        const m = await withTimeout(createCircle(profileLogin(p), name), 20000, 'Baza nie odpowiada.');
        updateProfileCircles(p.id, (list) => [...list.filter((c) => c.id !== m.id), m]);
        setSelectedCircleId(m.id);
        return { ok: true, circle: m };
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
        setStore((prev) => ({
          ...prev,
          profiles: prev.profiles.map((x) =>
            x.id === p.id ? { ...x, leftCircleIds: (x.leftCircleIds ?? []).filter((id) => id !== m.id) } : x
          ),
        }));
        updateProfileCircles(p.id, (list) => [...list.filter((c) => c.id !== m.id), m]);
        setSelectedCircleId(m.id);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: describeAccountError(err) };
      }
    },
    [requireSyncedActive, updateProfileCircles]
  );

  joinGroupRef.current = joinGroup;

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
      setStore((prev) => ({
        ...prev,
        profiles: prev.profiles.map((x) =>
          x.id === p.id
            ? { ...x, leftCircleIds: Array.from(new Set([...(x.leftCircleIds ?? []), circleId])) }
            : x
        ),
      }));
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
    legacyGoogleSync: LEGACY_GOOGLE_SYNC_ENABLED,
    accountSync,
    retrySync,
    dbIssue,
    setCloudSync,
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
