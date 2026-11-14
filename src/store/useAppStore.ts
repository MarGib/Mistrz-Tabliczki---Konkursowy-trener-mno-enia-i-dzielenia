import { useCallback, useEffect, useState } from 'react';
import {
  ALL_BADGES,
  LEVEL_STAGES,
  TOURNAMENTS,
  createFamilySeedProfiles,
  createFreshProfile,
} from '../data/curriculum';
import { DEFAULT_THEME_ID } from '../data/themes';
import { computeTournamentMedal, updateFactMemory } from '../engine/spacedRepetition';
import type {
  AppSettings,
  AvatarSpec,
  ColorTheme,
  SessionRecord,
  TaskAttempt,
  UserProfile,
} from '../types/math';

const STORAGE_KEY = 'mistrz_tabliczki_store_v1';

interface StoreState {
  activeProfileId: string;
  profiles: UserProfile[];
}

function loadInitialStore(): StoreState {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoreState;
        if (parsed?.profiles?.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to family seed
    }
  }
  const family = createFamilySeedProfiles();
  return {
    activeProfileId: family[0].id,
    profiles: family,
  };
}

export function useAppStore() {
  const [store, setStore] = useState<StoreState>(loadInitialStore);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Ignore storage quota issues
    }
  }, [store]);

  const activeProfile =
    store.profiles.find((p) => p.id === store.activeProfileId) ?? store.profiles[0];

  const updateActiveProfile = useCallback(
    (updater: (profile: UserProfile) => UserProfile) => {
      setStore((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === prev.activeProfileId ? updater(p) : p
        ),
      }));
    },
    []
  );

  const switchProfile = useCallback((profileId: string) => {
    setStore((prev) => {
      if (!prev.profiles.some((p) => p.id === profileId)) return prev;
      return { ...prev, activeProfileId: profileId };
    });
  }, []);

  const createProfile = useCallback(
    (name: string, avatarId: string, customAvatarSpec?: AvatarSpec) => {
      const created = createFreshProfile(name, avatarId, Date.now(), customAvatarSpec);
      setStore((prev) => ({
        activeProfileId: created.id,
        profiles: [...prev.profiles, created],
      }));
    },
    []
  );

  const deleteProfile = useCallback((profileId: string) => {
    setStore((prev) => {
      if (prev.profiles.length <= 1) return prev;
      const remaining = prev.profiles.filter((p) => p.id !== profileId);
      if (remaining.length === 0) return prev;
      const nextActive =
        prev.activeProfileId === profileId ? remaining[0].id : prev.activeProfileId;
      return {
        activeProfileId: nextActive,
        profiles: remaining,
      };
    });
  }, []);

  const addMissingFamilyProfiles = useCallback(() => {
    const family = createFamilySeedProfiles();
    setStore((prev) => {
      const existingNames = new Set(prev.profiles.map((p) => p.name.trim().toLowerCase()));
      const additions = family.filter(
        (f) => !existingNames.has(f.name.trim().toLowerCase())
      );
      if (additions.length === 0) return prev;
      return {
        ...prev,
        profiles: [...prev.profiles, ...additions],
      };
    });
  }, []);

  const updateProfileMeta = useCallback(
    (name: string, avatarId: string, customAvatarSpec?: AvatarSpec) => {
      updateActiveProfile((p) => ({
        ...p,
        name: name.trim() || p.name,
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
      updateActiveProfile((p) => {
        const now = Date.now();
        const nextMemories = { ...p.memories };
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
          p.lastActiveDate === todayStr ? p.streakDays : p.streakDays + 1;

        let bonusXp = 0;
        const unlockedStageIds = new Set(p.unlockedStageIds);
        const completedStageIds = new Set(p.completedStageIds);
        const earnedBadges = new Set(p.earnedBadges);

        if (session.stageId && session.passedThreshold) {
          const stage = LEVEL_STAGES.find((s) => s.id === session.stageId);
          if (stage) {
            if (!completedStageIds.has(stage.id)) {
              bonusXp += stage.rewardXp;
            }
            completedStageIds.add(stage.id);
            earnedBadges.add(stage.badgeName);
            const nextStage = LEVEL_STAGES.find((s) => s.order === stage.order + 1);
            if (nextStage) {
              unlockedStageIds.add(nextStage.id);
            }
          }
        }

        const nextTournamentBests = { ...p.tournamentBests };
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
              medal:
                medal !== 'brak'
                  ? medal
                  : prevBest?.medal ?? 'brak',
              attemptsCount: (prevBest?.attemptsCount ?? 0) + 1,
              lastPlayedAt: now,
            };

            if (medal !== 'brak') {
              earnedBadges.add('Medalistka Turnieju');
              if (!prevBest || prevBest.medal === 'brak') {
                bonusXp += tourney.rewardXp;
              }
            }
          }
        }

        if (improvedHardFact && ALL_BADGES.some((b) => b.id === 'Pogromca Trudnych')) {
          earnedBadges.add('Pogromca Trudnych');
        }

        return {
          ...p,
          xp: p.xp + session.pointsEarned + bonusXp,
          streakDays,
          lastActiveDate: todayStr,
          unlockedStageIds: Array.from(unlockedStageIds),
          completedStageIds: Array.from(completedStageIds),
          earnedBadges: Array.from(earnedBadges),
          memories: nextMemories,
          sessions: [...p.sessions, session].slice(-40),
          tournamentBests: nextTournamentBests,
        };
      });
    },
    [updateActiveProfile]
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

  const resetDemoData = useCallback(() => {
    const family = createFamilySeedProfiles();
    setStore({
      activeProfileId: family[0].id,
      profiles: family,
    });
  }, []);

  return {
    profiles: store.profiles,
    activeProfile,
    switchProfile,
    createProfile,
    deleteProfile,
    addMissingFamilyProfiles,
    updateProfileMeta,
    updateSettings,
    recordCompletedSession,
    setActiveTheme,
    saveCustomTheme,
    deleteCustomTheme,
    resetDemoData,
  };
}
