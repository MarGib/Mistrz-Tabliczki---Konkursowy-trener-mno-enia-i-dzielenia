import { computeUserLevel } from './spacedRepetition';
import type { MedalTier, UserProfile } from '../types/math';

export interface MemberStanding {
  profileId: string;
  name: string;
  schoolName?: string;
  className?: string;
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

export interface GroupCohortStanding {
  key: string;
  label: string;
  sublabel?: string;
  membersCount: number;
  totalXp: number;
  solvedTasks: number;
  avgAccuracyPct: number;
  avgTimeSec: number | null;
}

export interface FamilySummary {
  members: MemberStanding[];
  classStandings: GroupCohortStanding[];
  schoolStandings: GroupCohortStanding[];
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

function buildCohortStandings(
  members: MemberStanding[],
  mode: 'class' | 'school'
): GroupCohortStanding[] {
  const buckets = new Map<
    string,
    { label: string; sublabel?: string; items: MemberStanding[] }
  >();

  for (const m of members) {
    const school = m.schoolName?.trim();
    const cls = m.className?.trim();
    if (mode === 'class') {
      if (!cls) continue;
      const key = `${(school || '').toLowerCase()}::${cls.toLowerCase()}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.items.push(m);
      } else {
        buckets.set(key, {
          label: `Klasa ${cls}`,
          sublabel: school || undefined,
          items: [m],
        });
      }
    } else {
      if (!school) continue;
      const key = school.toLowerCase();
      const existing = buckets.get(key);
      if (existing) {
        existing.items.push(m);
      } else {
        buckets.set(key, {
          label: school,
          items: [m],
        });
      }
    }
  }

  return Array.from(buckets.entries())
    .map(([key, bucket]) => {
      const totalXp = bucket.items.reduce((s, m) => s + m.xp, 0);
      const solvedTasks = bucket.items.reduce((s, m) => s + m.solvedTasks, 0);
      const active = bucket.items.filter((m) => m.solvedTasks > 0);
      const avgAccuracyPct =
        active.length > 0
          ? Math.round(active.reduce((s, m) => s + m.accuracyPct, 0) / active.length)
          : 0;
      const timed = bucket.items.filter(
        (m): m is MemberStanding & { avgTimeSec: number } => m.avgTimeSec !== null
      );
      const avgTimeSec =
        timed.length > 0
          ? Number(
              (timed.reduce((s, m) => s + m.avgTimeSec, 0) / timed.length).toFixed(2)
            )
          : null;
      return {
        key,
        label: bucket.label,
        sublabel: bucket.sublabel,
        membersCount: bucket.items.length,
        totalXp,
        solvedTasks,
        avgAccuracyPct,
        avgTimeSec,
      };
    })
    .sort((a, b) => b.totalXp - a.totalXp);
}

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
      schoolName: p.schoolName,
      className: p.className,
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

  const classStandings = buildCohortStandings(members, 'class');
  const schoolStandings = buildCohortStandings(members, 'school');

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
    classStandings,
    schoolStandings,
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
