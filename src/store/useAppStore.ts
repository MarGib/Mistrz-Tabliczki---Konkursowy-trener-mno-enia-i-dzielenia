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
  doesProfileNeedCloudPush,
  mergeCompetitionProfiles,
  mergeNotifications,
  mergeProfiles,
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
  type SchoolDirectoryEntry,
  loadLocalSchoolDirectory,
  mergeSchoolDirectories,
  resolveCanonicalSchoolAndClass,
  saveLocalSchoolDirectory,
} from '../engine/schoolDirectory';
import { computeTournamentMedal, updateFactMemory } from '../engine/spacedRepetition';
import { auth, formatFirebaseError } from '../firebase';
import type {
  AppSettings,
  AvatarSpec,
  ColorTheme,
  FamilyNotification,
  SessionRecord,
  TaskAttempt,
  UserProfile,
} from '../types/math';

const STORAGE_KEY = 'mistrz_tabliczki_store_v3';
const LEGACY_STORAGE_KEYS = [
  'mistrz_tabliczki_store_v2',
  'mistrz_tabliczki_store_v1',
  'mistrz_tabliczki_store',
];

export type CloudSyncStatus = 'offline' | 'connecting' | 'synced' | 'error';

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

  const competitionProfiles = useMemo(
    () => mergeCompetitionProfiles(store.profiles, arenaPlayers),
    [store.profiles, arenaPlayers]
  );

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
        const meta = await ensureCloudGroupForUser(
          user,
          snapshot.profiles,
          snapshot.activeProfileId
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
      await signInWithGoogleCloud();
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
  };
}
