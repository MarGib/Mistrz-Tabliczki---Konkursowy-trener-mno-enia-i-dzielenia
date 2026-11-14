import { TOURNAMENTS } from '../data/curriculum';
import type {
  FamilyNotification,
  SessionRecord,
  UserProfile,
} from '../types/math';

export function createInitialFamilyNotifications(
  _profiles: UserProfile[],
  _now = Date.now()
): FamilyNotification[] {
  return [];
}

export function generateSessionNotifications(params: {
  actorBefore: UserProfile;
  actorAfter: UserProfile;
  otherProfiles: UserProfile[];
  session: SessionRecord;
  newBadges: string[];
  now?: number;
}): FamilyNotification[] {
  const {
    actorBefore,
    actorAfter,
    otherProfiles,
    session,
    newBadges,
    now = Date.now(),
  } = params;

  const notifications: FamilyNotification[] = [];
  const baseRead = [actorAfter.id];

  // 1. Check if actor overtook any other family member in total XP
  for (const other of otherProfiles) {
    if (actorBefore.xp <= other.xp && actorAfter.xp > other.xp) {
      notifications.push({
        id: `notif-xp-${now}-${other.id}`,
        createdAt: now,
        type: 'xp_overtake',
        actorProfileId: actorAfter.id,
        actorName: actorAfter.name,
        targetProfileId: other.id,
        title: `${actorAfter.name} przebił(a) Twój wynik XP!`,
        message: `${actorAfter.name} ma teraz ${actorAfter.xp} XP i wyprzedził(a) ${other.name} (${other.xp} XP).`,
        readByProfileIds: baseRead,
      });
    }
  }

  // 2. Check if actor set a new family speed record in a solid (>= 75% accuracy) session
  if (session.accuracyPct >= 75 && session.avgTimeMs > 0) {
    let bestOtherMember: { profile: UserProfile; avgMs: number } | null = null;
    for (const other of otherProfiles) {
      const valid = other.sessions.filter(
        (s) => s.accuracyPct >= 75 && s.avgTimeMs > 0
      );
      if (valid.length === 0) continue;
      const fastest = Math.min(...valid.map((s) => s.avgTimeMs));
      if (!bestOtherMember || fastest < bestOtherMember.avgMs) {
        bestOtherMember = { profile: other, avgMs: fastest };
      }
    }

    const ownPrevFastest = actorBefore.sessions
      .filter((s) => s.accuracyPct >= 75 && s.avgTimeMs > 0)
      .map((s) => s.avgTimeMs);
    const prevOwnBest =
      ownPrevFastest.length > 0 ? Math.min(...ownPrevFastest) : Infinity;

    if (
      bestOtherMember &&
      session.avgTimeMs < bestOtherMember.avgMs &&
      prevOwnBest >= bestOtherMember.avgMs
    ) {
      const newSec = (session.avgTimeMs / 1000).toFixed(1).replace('.', ',');
      const oldSec = (bestOtherMember.avgMs / 1000).toFixed(1).replace('.', ',');
      notifications.push({
        id: `notif-spd-${now}`,
        createdAt: now,
        type: 'speed_record',
        actorProfileId: actorAfter.id,
        actorName: actorAfter.name,
        targetProfileId: bestOtherMember.profile.id,
        title: `Nowy rekord tempa w grupie!`,
        message: `${actorAfter.name} osiągnął(ęła) średnio ${newSec} s/zadanie i pobił(a) rekord ${bestOtherMember.profile.name} (${oldSec} s)!`,
        readByProfileIds: baseRead,
      });
    }
  }

  // 3. Check tournament record beaten
  if (session.tournamentId) {
    const tourney = TOURNAMENTS.find((t) => t.id === session.tournamentId);
    const totalSec = Math.max(1, Math.round(session.totalTimeMs / 1000));
    if (tourney) {
      for (const other of otherProfiles) {
        const otherBest = other.tournamentBests[tourney.id];
        if (!otherBest) continue;
        const beatOther =
          session.accuracyPct > otherBest.bestAccuracyPct ||
          (session.accuracyPct === otherBest.bestAccuracyPct &&
            totalSec < otherBest.bestTimeSec);
        if (beatOther) {
          notifications.push({
            id: `notif-trn-${now}-${other.id}`,
            createdAt: now,
            type: 'tournament_record',
            actorProfileId: actorAfter.id,
            actorName: actorAfter.name,
            targetProfileId: other.id,
            title: `Przebity rekord w turnieju „${tourney.title}”!`,
            message: `${actorAfter.name} uzyskał(a) ${session.accuracyPct}% w ${totalSec} s i pokonał(a) wynik ${other.name} (${otherBest.bestAccuracyPct}% w ${otherBest.bestTimeSec} s).`,
            readByProfileIds: baseRead,
          });
        }
      }
    }
  }

  // 4. New badge milestone
  if (newBadges.length > 0) {
    notifications.push({
      id: `notif-bdg-${now}`,
      createdAt: now,
      type: 'badge_earned',
      actorProfileId: actorAfter.id,
      actorName: actorAfter.name,
      title: `${actorAfter.name} zdobył(a) nową odznakę!`,
      message: `Odblokowano osiągnięcie: ${newBadges.join(', ')}.`,
      readByProfileIds: baseRead,
    });
  }

  return notifications;
}

export function getUnreadNotificationsForProfile(
  notifications: FamilyNotification[],
  profileId: string
): FamilyNotification[] {
  return notifications.filter(
    (n) =>
      n.actorProfileId !== profileId && !n.readByProfileIds.includes(profileId)
  );
}
