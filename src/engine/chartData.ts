import type { UserProfile } from '../types/math';

export interface SpeedTrendPoint {
  label: string;
  sessionNumber: number;
  [key: string]: string | number | undefined;
}

export interface UserSpeedSummary {
  profileId: string;
  name: string;
  sessionCount: number;
  firstAvgSec: number | null;
  latestAvgSec: number | null;
  deltaSec: number | null; // negative means faster!
}

export function buildUserSpeedTrendData(
  profiles: UserProfile[],
  selectedProfileIds: string[],
  maxSessions = 12
): {
  data: SpeedTrendPoint[];
  summaries: UserSpeedSummary[];
} {
  const activeProfiles = profiles.filter((p) => selectedProfileIds.includes(p.id));

  const trimmedByProfile = new Map<string, UserProfile['sessions']>();
  let maxLen = 0;

  const summaries: UserSpeedSummary[] = activeProfiles.map((p) => {
    const slice = (p.trendSessions ?? p.sessions).slice(-maxSessions);
    trimmedByProfile.set(p.id, slice);
    if (slice.length > maxLen) {
      maxLen = slice.length;
    }

    const first = slice[0];
    const latest = slice[slice.length - 1];
    const firstAvgSec = first ? Number((first.avgTimeMs / 1000).toFixed(2)) : null;
    const latestAvgSec = latest ? Number((latest.avgTimeMs / 1000).toFixed(2)) : null;
    const deltaSec =
      firstAvgSec !== null && latestAvgSec !== null && slice.length >= 2
        ? Number((latestAvgSec - firstAvgSec).toFixed(2))
        : null;

    return {
      profileId: p.id,
      name: p.name,
      sessionCount: slice.length,
      firstAvgSec,
      latestAvgSec,
      deltaSec,
    };
  });

  const data: SpeedTrendPoint[] = [];
  for (let i = 0; i < maxLen; i++) {
    const point: SpeedTrendPoint = {
      label: `Seria ${i + 1}`,
      sessionNumber: i + 1,
    };

    for (const p of activeProfiles) {
      const sess = trimmedByProfile.get(p.id)?.[i];
      if (sess) {
        point[`time_${p.id}`] = Number((sess.avgTimeMs / 1000).toFixed(2));
        point[`acc_${p.id}`] = sess.accuracyPct;
        point[`title_${p.id}`] = sess.seriesTitle;
        point[`date_${p.id}`] = new Date(sess.timestamp).toLocaleDateString('pl-PL');
      }
    }
    data.push(point);
  }

  return { data, summaries };
}
