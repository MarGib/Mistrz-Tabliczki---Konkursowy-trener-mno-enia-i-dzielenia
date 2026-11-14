import { computeUserLevel } from './spacedRepetition';
import type { MedalTier, UserProfile } from '../types/math';

export interface MemberStanding {
  profileId: string;
  name: string;
  avatarId: string;
  customAvatarSpec?: UserProfile['customAvatarSpec'];
  xp: number;
  level: number;
  levelTitle: string;
  streakDays: number;
  sessionsCount: number;
  solvedTasks: number;
  accuracyPct: number;
  avgTimeSec: number | null;
  masteredFactsCount: number;
  medalsCount: number;
  bestMedal: MedalTier;
}

export interface FamilySummary {
  members: MemberStanding[];
  totalXp: number;
  totalSolvedTasks: number;
  totalSessions: number;
  familyAvgAccuracyPct: number;
  familyAvgTimeSec: number | null;
  fastestMember: MemberStanding | null;
  mostAccurateMember: MemberStanding | null;
  xpLeader: MemberStanding | null;
}

const MEDAL_RANK: Record<MedalTier, number> = {
  brak: 0,
  braz: 1,
  srebro: 2,
  zloto: 3,
  puchar: 4,
};

export function computeFamilySummary(profiles: UserProfile[]): FamilySummary {
  const members: MemberStanding[] = profiles.map((p) => {
    const lvl = computeUserLevel(p.xp);
    const sessionsCount = p.sessions.length;
    const solvedTasksFromSessions = p.sessions.reduce((s, r) => s + r.totalTasks, 0);
    const correctFromSessions = p.sessions.reduce((s, r) => s + r.correctTasks, 0);

    const memoriesList = Object.values(p.memories).filter((m) => m.attempts > 0);
    const masteredFactsCount = memoriesList.filter(
      (m) => m.mastery === 'opanowane' || m.mastery === 'mistrzowskie'
    ).length;

    let accuracyPct = 0;
    if (solvedTasksFromSessions > 0) {
      accuracyPct = Math.round((correctFromSessions / solvedTasksFromSessions) * 100);
    } else if (memoriesList.length > 0) {
      const memAttempts = memoriesList.reduce((s, m) => s + m.attempts, 0);
      const memCorrect = memoriesList.reduce((s, m) => s + m.correctCount, 0);
      accuracyPct = memAttempts > 0 ? Math.round((memCorrect / memAttempts) * 100) : 0;
    }

    let avgTimeSec: number | null = null;
    if (sessionsCount > 0) {
      const totalMs = p.sessions.reduce((s, r) => s + r.totalTimeMs, 0);
      const totalTasks = p.sessions.reduce((s, r) => s + r.totalTasks, 0);
      if (totalTasks > 0) {
        avgTimeSec = Number((totalMs / totalTasks / 1000).toFixed(2));
      }
    } else if (memoriesList.length > 0) {
      const avgMs =
        memoriesList.reduce((s, m) => s + m.avgTimeMs, 0) / memoriesList.length;
      avgTimeSec = Number((avgMs / 1000).toFixed(2));
    }

    const tournamentBests = Object.values(p.tournamentBests);
    let bestMedal: MedalTier = 'brak';
    let medalsCount = 0;
    for (const tb of tournamentBests) {
      if (tb.medal !== 'brak') {
        medalsCount += 1;
        if (MEDAL_RANK[tb.medal] > MEDAL_RANK[bestMedal]) {
          bestMedal = tb.medal;
        }
      }
    }

    return {
      profileId: p.id,
      name: p.name,
      avatarId: p.avatarId,
      customAvatarSpec: p.customAvatarSpec,
      xp: p.xp,
      level: lvl.level,
      levelTitle: lvl.title,
      streakDays: p.streakDays,
      sessionsCount,
      solvedTasks: solvedTasksFromSessions,
      accuracyPct,
      avgTimeSec,
      masteredFactsCount,
      medalsCount,
      bestMedal,
    };
  });

  members.sort((a, b) => b.xp - a.xp);

  const totalXp = members.reduce((s, m) => s + m.xp, 0);
  const totalSolvedTasks = members.reduce((s, m) => s + m.solvedTasks, 0);
  const totalSessions = members.reduce((s, m) => s + m.sessionsCount, 0);

  const activeMembersWithTasks = members.filter((m) => m.solvedTasks > 0);
  const familyAvgAccuracyPct =
    activeMembersWithTasks.length > 0
      ? Math.round(
          activeMembersWithTasks.reduce((s, m) => s + m.accuracyPct, 0) /
            activeMembersWithTasks.length
        )
      : 0;

  const timedMembers = members.filter(
    (m): m is MemberStanding & { avgTimeSec: number } => m.avgTimeSec !== null
  );
  const familyAvgTimeSec =
    timedMembers.length > 0
      ? Number(
          (
            timedMembers.reduce((s, m) => s + m.avgTimeSec, 0) / timedMembers.length
          ).toFixed(2)
        )
      : null;

  const fastestMember =
    timedMembers.length > 0
      ? [...timedMembers].sort((a, b) => a.avgTimeSec - b.avgTimeSec)[0]
      : null;

  const mostAccurateMember =
    activeMembersWithTasks.length > 0
      ? [...activeMembersWithTasks].sort((a, b) => {
          if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
          return (a.avgTimeSec ?? 99) - (b.avgTimeSec ?? 99);
        })[0]
      : null;

  const xpLeader = members[0] ?? null;

  return {
    members,
    totalXp,
    totalSolvedTasks,
    totalSessions,
    familyAvgAccuracyPct,
    familyAvgTimeSec,
    fastestMember,
    mostAccurateMember,
    xpLeader,
  };
}
