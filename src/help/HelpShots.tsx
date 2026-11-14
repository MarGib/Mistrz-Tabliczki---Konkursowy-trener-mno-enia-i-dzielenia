/**
 * Strona pomocnicza do generowania zrzutów ekranu instrukcji (otwierana z ?__shots).
 * Renderuje prawdziwe komponenty aplikacji z przykładowymi danymi.
 */
import { GroupsPanel } from '../components/GroupsPanel';
import { InviteCard } from '../components/InviteCard';
import { NotificationCenter } from '../components/NotificationCenter';
import { SyncPrompt } from '../components/SyncPrompt';
import { StagePath } from '../components/StagePath';
import { MasterChallengeCard } from '../components/MasterChallengeCard';
import { GroupRivalry } from '../components/GroupRivalry';
import { CalculatorKeypad } from '../components/CalculatorKeypad';
import { InstallBanner } from '../components/InstallBanner';
import { renderCertificate } from '../engine/certificateCanvas';
import type { UserProfile } from '../types/math';
import { createFreshProfile } from '../data/curriculum';
import { resolveThemeById } from '../data/themes';
import { themeToCssVariables } from '../engine/themeEngine';
import type { CircleMembership } from '../types/math';

const ok = async () => ({ ok: true });
const circles: CircleMembership[] = [
  { id: 'c1', name: 'Rodzinka G', code: 'G-9GSVX', share: true, owner: true },
  { id: 'c2', name: 'Nasza paczka', code: 'G-K7P2M', share: false },
];

const NOW = Date.now();
function demoPlayer(name: string, xp: number, streak: number, acc: number, sec: number, n: number, medals: string[]): UserProfile {
  const p = createFreshProfile(name, 'owl');
  p.id = name;
  p.xp = xp;
  p.streakDays = streak;
  p.sessions = Array.from({ length: n }, (_, i) => ({
    id: `${name}-${i}`,
    timestamp: NOW - (n - i) * 86400000 * 0.6,
    mode: 'mixed' as const,
    seriesTitle: 'Seria',
    totalTasks: 10,
    correctTasks: Math.round(acc / 10),
    accuracyPct: acc,
    totalTimeMs: (sec + (n - i) * 0.15) * 10000,
    avgTimeMs: (sec + (n - i) * 0.15) * 1000,
    pointsEarned: 100,
    passedThreshold: true,
    attempts: [],
  }));
  p.tournamentBests = Object.fromEntries(
    medals.map((m, i) => [`t${i}`, { tournamentId: `t${i}`, bestAccuracyPct: 90, bestTimeSec: 40, medal: m as never, attemptsCount: 1, lastPlayedAt: NOW }])
  );
  return p;
}

function CertificateShot() {
  const c = document.createElement('canvas');
  renderCertificate(c, {
    kind: 'tournament',
    playerName: 'Ola',
    title: 'Wielki Finał Konkursowy',
    distinction: 'Złoty Medal',
    accuracyPct: 100,
    tasks: 20,
    totalTimeSec: 44,
    avgTimeSec: 2.2,
    maxRange: 100,
    dateMs: NOW,
    primaryColor: resolveThemeById(undefined, []).tokens.primary,
    accentColor: resolveThemeById(undefined, []).tokens.accent,
  });
  return <img src={c.toDataURL('image/png')} alt="" className="w-full rounded-xl border border-[var(--th-border)]" />;
}

export function HelpShots() {
  for (const [k, v] of Object.entries(themeToCssVariables(resolveThemeById(undefined, [])))) {
    document.documentElement.style.setProperty(k, v);
  }
  try {
    window.localStorage.setItem('mt_pending_invite', 'G-9GSVX');
  } catch {
    // ignore
  }
  const demo = { ...createFreshProfile('Ola', 'owl'), login: 'ola', passwordHash: 'x' };
  const panelProps = {
    circles,
    selectedCircleId: 'c1',
    onSelectCircle: () => {},
    accountState: { state: 'synced' as const },
    circleError: null,
    membersCount: 4,
    onCreateGroup: ok,
    onJoinGroup: ok,
    onLeaveGroup: ok,
    onSetShare: () => {},
    onOpenAccount: () => {},
  };
  return (
    <div className="bg-[var(--th-canvas)] text-[var(--th-text)] w-[390px] space-y-6 py-4">
      {!window.location.search.includes('__shots=notif') && (
      <>
      <div id="shot-synchronizacja" className="pb-2">
        <SyncPrompt profile={demo} state={{ state: 'needs-password' }} onSubmitPassword={() => {}} />
      </div>
      <div id="shot-grupy" className="pb-2">
        <GroupsPanel {...panelProps} />
      </div>
      <div id="shot-grupa-zalozona" className="pb-2">
        <GroupsPanel {...panelProps} demoJustCreated={circles[0]} />
      </div>
      <div id="shot-widocznosc" className="pb-2">
        <GroupsPanel {...panelProps} demoManageOpen />
      </div>
      <div id="shot-synchronizacja-czeka" className="pb-2">
        <SyncPrompt
          profile={demo}
          state={{
            state: 'synced',
            unsent: true,
            message: 'Brak połączenia z internetem. Ponowię wysyłanie automatycznie.',
            retryAt: Date.now() + 25_000,
          }}
          onSubmitPassword={() => {}}
          onRetry={() => {}}
        />
      </div>
      <div id="shot-sciezka" className="px-3 pt-2 pb-2">
        <StagePath
          profile={{
            ...demo,
            completedStageIds: ['stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-5', 'stage-6', 'stage-7'],
            unlockedStageIds: ['stage-1'],
          }}
          onStart={() => {}}
        />
      </div>
      <div id="shot-wyzwanie-mistrza" className="px-3 pb-2">
        <MasterChallengeCard profile={{ ...demo, masterLevel: 3 }} pathDone onStart={() => {}} />
      </div>
      <div id="shot-wyzwania-w-grupie" className="px-1 pb-2">
        <GroupRivalry
          meId="Ola"
          groupName="Rodzinka G"
          profiles={[
            demoPlayer('Ola', 666, 1, 92, 2.6, 4, ['braz']),
            demoPlayer('Kuba', 2400, 5, 88, 3.4, 12, ['zloto', 'srebro']),
            demoPlayer('Aga', 1500, 3, 97, 2.4, 7, []),
            demoPlayer('Tata', 441, 2, 80, 4.1, 3, ['braz']),
          ]}
        />
      </div>
      <div id="shot-klawiatura" className="px-3 pb-2">
        <CalculatorKeypad value="5" onDigit={() => {}} onBackspace={() => {}} onClear={() => {}} onSubmit={() => {}} compact />
      </div>
      <div id="shot-certyfikat" className="px-3 pb-2">
        <CertificateShot />
      </div>
      <div id="shot-instalacja" className="pb-2">
        <InstallBanner demoPlatform="ios-safari" />
      </div>
      <div id="shot-zaproszenie" className="pb-2">
        <InviteCard canJoin alreadyMemberCodes={[]} onJoin={ok} onJoined={() => {}} />
      </div>
      </>
      )}
      {window.location.search.includes('__shots=notif') && (
      <div id="shot-powiadomienia" className="relative h-[420px] overflow-hidden">
        <NotificationCenter
          open
          activeProfileId={demo.id}
          notifications={[
            {
              id: 'n1',
              createdAt: Date.now() - 120000,
              type: 'xp_overtake',
              actorProfileId: 'k',
              actorName: 'Kuba',
              targetProfileId: demo.id,
              title: 'Kuba wyprzedza Cię w grupie „Rodzinka G”!',
              message: 'Kuba ma 640 XP, a Ty 610 XP. Jedna seria i możesz odzyskać miejsce!',
              readByProfileIds: [],
            },
          ]}
          onClose={() => {}}
          onMarkRead={() => {}}
          onMarkAllRead={() => {}}
          onOpenFamilyStats={() => {}}
        />
      </div>
      )}
    </div>
  );
}
