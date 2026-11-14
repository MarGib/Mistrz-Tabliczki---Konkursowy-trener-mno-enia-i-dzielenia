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
import { mergeNotifications, mergeProfiles } from '../engine/cloudMerge';
import {
  type CloudSessionMeta,
  deleteProfileFromCloud,
  ensureCloudGroupForUser,
  fetchGlobalSchoolDirectory,
  joinCloudGroupByCode,
  pushActiveProfileSelectionToCloud,
  pushGlobalSchoolDirectory,
  pushGroupProfileIds,
  pushNotificationsFeedToCloud,
  pushProfileToCloud,
  signInWithGoogleCloud,
  signOutCloud,
  subscribeToGroupCloud,
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
import { auth } from '../firebase';
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

export function parseInitialStoreState(raw: string | null): StoreState {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StoreState>;
      if (Array.isArray(parsed?.profiles) && parsed.profiles.length > 0) {
        const validActive = parsed.profiles.some(
          (p) => p.id === parsed.activeProfileId
        )
          ? (parsed.activeProfileId as string)
          : parsed.profiles[0].id;
        const owned = Array.isArray(parsed.ownedProfileIds)
          ? parsed.ownedProfileIds.filter((id) =>
              parsed.profiles!.some((p) => p.id === id)
            )
          : [validActive];
        return {
          activeProfileId: validActive,
          profiles: parsed.profiles,
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
      return parseInitialStoreState(window.localStorage.getItem(STORAGE_KEY));
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
  const [localDirectorySeed, setLocalDirectorySeed] = useState<SchoolDirectoryEntry[]>(
    loadLocalSchoolDirectory
  );

  const schoolDirectory = useMemo(
    () => mergeSchoolDirectories([remoteSchools, localDirectorySeed], store.profiles),
    [remoteSchools, localDirectorySeed, store.profiles]
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

  // Fetch non-PII global school & class directory on mount so new users see existing schools/classes
  useEffect(() => {
    let active = true;
    void fetchGlobalSchoolDirectory().then((entries) => {
      if (active && entries.length > 0) {
        setRemoteSchools(entries);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Listen to Firebase Auth state & sync family workspace
  useEffect(() => {
    let unsubCloud: (() => void) | null = null;
    let cancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
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

        unsubCloud = subscribeToGroupCloud({
          groupId: meta.groupId,
          onProfilesSnapshot: (cloudProfiles) => {
            setStore((prev) => {
              const merged = mergeProfiles(prev.profiles, cloudProfiles);
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
          },
          onFeedSnapshot: (cloudNotifs) => {
            setStore((prev) => ({
              ...prev,
              notifications: mergeNotifications(prev.notifications, cloudNotifs),
            }));
          },
          onError: () => {
            setCloudStatus('error');
          },
        });
      } catch (err) {
        if (cancelled) return;
        setCloudStatus('error');
        setCloudError(
          err instanceof Error
            ? err.message
            : 'Nie udało się połączyć z synchronizacją w chmurze.'
        );
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubCloud) unsubCloud();
    };
  }, [cloudSubVersion]);

  const activeProfile = useMemo(
    () =>
      store.profiles.find((p) => p.id === store.activeProfileId) ??
      store.profiles[0] ??
      FALLBACK_GUEST_PROFILE,
    [store.profiles, store.activeProfileId]
  );

  // Only accounts belonging to THIS user/device appear on the Welcome Gate & Konto switcher
  const ownedProfiles = useMemo(
    () => store.profiles.filter((p) => store.ownedProfileIds.includes(p.id)),
    [store.profiles, store.ownedProfileIds]
  );

  const syncProfileIfConnected = useCallback((profile: UserProfile) => {
    const meta = cloudMetaRef.current;
    if (!meta) return;
    void pushProfileToCloud(meta.groupId, meta.uid, profile).catch(() => {});
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
      setCloudError(
        err instanceof Error
          ? err.message
          : 'Logowanie przez Google zostało anulowane lub zablokowane.'
      );
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
          // Merge existing remote profileIds with local owned profileIds cleanly
          const allIds = Array.from(
            new Set([...existingProfileIds, ...ownedList.map((p) => p.id)])
          );
          await pushGroupProfileIds(meta.groupId, allIds).catch(() => {});
        }

        setCloudMeta(meta);
        cloudMetaRef.current = meta;
        setCloudStatus('synced');
        setCloudSubVersion((v) => v + 1);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Nie udało się dołączyć do grupy tym kodem.',
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
