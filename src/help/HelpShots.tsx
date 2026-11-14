/**
 * Strona pomocnicza do generowania zrzutów ekranu instrukcji (otwierana z ?__shots).
 * Renderuje prawdziwe komponenty aplikacji z przykładowymi danymi.
 */
import { GroupsPanel } from '../components/GroupsPanel';
import { InviteCard } from '../components/InviteCard';
import { NotificationCenter } from '../components/NotificationCenter';
import { SyncPrompt } from '../components/SyncPrompt';
import { createFreshProfile } from '../data/curriculum';
import { resolveThemeById } from '../data/themes';
import { themeToCssVariables } from '../engine/themeEngine';
import type { CircleMembership } from '../types/math';

const ok = async () => ({ ok: true });
const circles: CircleMembership[] = [
  { id: 'c1', name: 'Rodzinka G', code: 'G-9GSVX', share: true, owner: true },
  { id: 'c2', name: 'Nasza paczka', code: 'G-K7P2M', share: false },
];

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
