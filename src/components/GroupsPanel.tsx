import { useState } from 'react';
import { HelpButton } from '../help/HelpButton';
import { Check, Copy, Eye, EyeOff, LogOut, PartyPopper, Plus, Send, Settings2, Users } from 'lucide-react';

export function inviteLink(code: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?dolacz=${encodeURIComponent(code)}`;
}

/** Udostępnia zaproszenie (menu udostępniania telefonu) albo kopiuje je do schowka. */
export async function shareInvite(circle: { name: string; code: string }): Promise<'shared' | 'copied' | 'failed'> {
  const url = inviteLink(circle.code);
  const text = `Dołącz do mojej grupy „${circle.name}” w Mistrzu Tabliczki! Kliknij link i zaloguj się (albo załóż konto). Kod grupy: ${circle.code}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Mistrz Tabliczki — zaproszenie', text, url });
      return 'shared';
    }
  } catch {
    // użytkownik zamknął menu udostępniania — spróbuj skopiować
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
import type { AccountSyncState } from '../store/useAppStore';
import type { CircleMembership } from '../types/math';

interface GroupsPanelProps {
  circles: CircleMembership[];
  selectedCircleId: string | null;
  onSelectCircle: (circleId: string | null) => void;
  accountState?: AccountSyncState;
  circleError: string | null;
  membersCount: number;
  onCreateGroup: (
    name: string
  ) => Promise<{ ok: boolean; error?: string; circle?: CircleMembership }>;
  onJoinGroup: (code: string) => Promise<{ ok: boolean; error?: string }>;
  onLeaveGroup: (circleId: string) => Promise<{ ok: boolean; error?: string }>;
  onSetShare: (circleId: string, share: boolean) => void;
  onOpenAccount: () => void;
  /** Tylko do zrzutów ekranu w instrukcji. */
  demoJustCreated?: CircleMembership;
  demoManageOpen?: boolean;
}

/**
 * Grupy gracza: rodzina, znajomi, drużyna… Gracz może należeć do wielu grup, a w każdej
 * sam decyduje, czy jego wyniki są widoczne. Rankingi i powiadomienia działają osobno w każdej grupie.
 */
export function GroupsPanel({
  circles,
  selectedCircleId,
  onSelectCircle,
  accountState,
  circleError,
  membersCount,
  onCreateGroup,
  onJoinGroup,
  onLeaveGroup,
  onSetShare,
  onOpenAccount,
  demoJustCreated,
  demoManageOpen,
}: GroupsPanelProps) {
  const [manageOpen, setManageOpen] = useState(demoManageOpen ?? circles.length === 0);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<CircleMembership | null>(demoJustCreated ?? null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const doShare = async (c: CircleMembership) => {
    const r = await shareInvite(c);
    setShareNote(
      r === 'shared'
        ? 'Wysłano zaproszenie.'
        : r === 'copied'
        ? 'Skopiowano zaproszenie z linkiem — wklej je w SMS-ie lub komunikatorze.'
        : `Podaj znajomym kod: ${c.code}`
    );
    window.setTimeout(() => setShareNote(null), 4000);
  };

  const synced = accountState?.state === 'synced';
  const selected = circles.find((c) => c.id === selectedCircleId) ?? null;

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, reset: () => void) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      reset();
      setManageOpen(false);
    } else {
      setError(res.error ?? 'Coś poszło nie tak.');
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  const COLLAPSE_AFTER = 5;
  const [showAll, setShowAll] = useState(false);
  let visibleCircles = circles;
  if (!showAll && circles.length > COLLAPSE_AFTER) {
    visibleCircles = circles.slice(0, COLLAPSE_AFTER - 1);
    if (selected && !visibleCircles.some((c) => c.id === selected.id)) visibleCircles = [...visibleCircles, selected];
  }
  const hiddenCount = circles.length - visibleCircles.length;

  const chip = (active: boolean) =>
    `max-w-full min-h-[38px] px-3.5 rounded-xl border text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
      active
        ? 'bg-[var(--th-primary)] border-[var(--th-primary)] text-[var(--th-primary-fg)]'
        : 'bg-[var(--th-surface)] border-[var(--th-border)] text-[var(--th-text)] hover:border-[var(--th-primary)]'
    }`;

  return (
    <section
      className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-4"
      aria-label="Grupy"
      data-testid="groups-panel"
    >
      <div className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-3 sm:p-4 shadow-sm space-y-3">
        {/* Nagłówek: tytuł + pomoc po lewej, zarządzanie po prawej — nic nie jest ucinane na telefonie. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Users className="w-4 h-4 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
            <span className="text-sm font-bold text-[var(--th-text)] truncate">
              {circles.length > 1 ? `Twoje grupy (${circles.length})` : 'Ranking'}
            </span>
            <HelpButton section="groups" label="Grupy" />
          </div>
          <button
            type="button"
            onClick={() => setManageOpen((v) => !v)}
            aria-expanded={manageOpen}
            className="shrink-0 min-h-[36px] px-3 rounded-xl border border-dashed border-[var(--th-border)] text-xs sm:text-sm font-bold text-[var(--th-text-muted)] hover:text-[var(--th-text)] hover:border-[var(--th-primary)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            {circles.length > 0 ? <Settings2 className="w-4 h-4" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
            <span>{circles.length > 0 ? 'Zarządzaj' : 'Dodaj grupę'}</span>
          </button>
        </div>

        {/* Wybór rankingu: przyciski zawijają się w kolejne wiersze; przy wielu grupach część jest zwinięta. */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Wybierz ranking">
          <button
            type="button"
            role="tab"
            aria-selected={!selectedCircleId}
            className={chip(!selectedCircleId)}
            onClick={() => onSelectCircle(null)}
          >
            Moje konta
          </button>
          {visibleCircles.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === selectedCircleId}
              className={chip(c.id === selectedCircleId)}
              onClick={() => onSelectCircle(c.id)}
              title={c.name}
            >
              <span className="truncate max-w-[11rem]">{c.name}</span>
              {!c.share && <EyeOff className="w-3.5 h-3.5 opacity-80 shrink-0" aria-label="wyniki ukryte" />}
            </button>
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="min-h-[38px] px-3 rounded-xl border border-[var(--th-border)] text-sm font-bold text-[var(--th-primary)] cursor-pointer"
            >
              +{hiddenCount} więcej
            </button>
          )}
          {showAll && circles.length > COLLAPSE_AFTER && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="min-h-[38px] px-3 rounded-xl text-sm font-bold text-[var(--th-text-muted)] cursor-pointer"
            >
              Zwiń
            </button>
          )}
        </div>

        {justCreated && (
          <div
            className="rounded-2xl border-2 border-[var(--th-primary)] bg-[var(--th-soft-tint)] p-4 space-y-3 animate-pop-in"
            data-testid="group-created-card"
          >
            <div className="flex items-start gap-2.5">
              <PartyPopper className="w-6 h-6 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
              <HelpButton section="group-create" label="Zapraszanie" className="order-last ml-auto -mt-1.5" />
              <div>
                <p className="font-display text-lg font-extrabold text-[var(--th-text)]">
                  Grupa „{justCreated.name}” gotowa!
                </p>
                <p className="text-sm text-[var(--th-text)]">
                  Wyślij zaproszenie rodzinie lub znajomym. Po kliknięciu linku zalogują się i dołączą jednym przyciskiem.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 rounded-xl bg-[var(--th-surface)] border border-[var(--th-border)] px-3 py-2 text-center">
                <div className="text-[11px] font-bold text-[var(--th-text-muted)]">Kod grupy</div>
                <div className="font-mono text-2xl font-extrabold tracking-widest text-[var(--th-text)]">
                  {justCreated.code}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void doShare(justCreated)}
                className="min-h-[48px] px-5 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                Wyślij zaproszenie
              </button>
              <button
                type="button"
                onClick={() => setJustCreated(null)}
                className="min-h-[48px] px-4 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] font-bold cursor-pointer"
              >
                Gotowe
              </button>
            </div>
            {shareNote && <p className="text-xs font-semibold text-[var(--th-primary)]">{shareNote}</p>}
          </div>
        )}

        {selected && !justCreated && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <span className="text-[var(--th-text-muted)] inline-flex items-center gap-1.5">
              <Users className="w-4 h-4" aria-hidden="true" />
              {membersCount}{' '}
              {membersCount === 1
                ? 'osoba widoczna'
                : [2, 3, 4].includes(membersCount % 10) && ![12, 13, 14].includes(membersCount % 100)
                ? 'osoby widoczne'
                : 'osób widocznych'}{' '}
              w rankingu
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="text-[var(--th-text-muted)]">Kod:</span>
              <button
                type="button"
                onClick={() => copyCode(selected.code)}
                className="font-mono font-bold text-[var(--th-text)] inline-flex items-center gap-1 cursor-pointer"
                aria-label={`Skopiuj kod grupy ${selected.code}`}
              >
                {selected.code}
                {copied === selected.code ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => void doShare(selected)}
                className="min-h-[36px] px-3 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                Zaproś
              </button>
            </span>
            {shareNote && <p className="w-full text-xs font-semibold text-[var(--th-primary)]">{shareNote}</p>}
          </div>
        )}

        {circleError && selected && (
          <p className="text-xs font-bold text-red-500" role="alert">
            {circleError}
          </p>
        )}

        {manageOpen && (
          <div className="pt-3 border-t border-[var(--th-border)] space-y-3">
            {!synced ? (
              <div className="text-sm text-[var(--th-text)] space-y-2">
                <p>
                  Grupy działają dla kont z hasłem i włączoną synchronizacją z chmurą.{' '}
                  {accountState?.message ??
                    'W zakładce Konto ustaw hasło i zaznacz „Synchronizuj z chmurą”, a potem wróć tutaj.'}
                </p>
                <button
                  type="button"
                  onClick={onOpenAccount}
                  className="min-h-[40px] px-4 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-sm font-bold cursor-pointer"
                >
                  Przejdź do Konta
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <form
                    className="space-y-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void (async () => {
                        setBusy(true);
                        setError(null);
                        const res = await onCreateGroup(newName);
                        setBusy(false);
                        if (res.ok && res.circle) {
                          setNewName('');
                          setManageOpen(false);
                          setJustCreated(res.circle);
                        } else {
                          setError(res.error ?? 'Nie udało się założyć grupy.');
                        }
                      })();
                    }}
                  >
                    <label htmlFor="new-group-name" className="block text-xs font-bold text-[var(--th-text)]">
                      Załóż nową grupę
                    </label>
                    <HelpButton section="group-create" label="Zakładanie grupy" className="float-right -mt-7" />
                    <div className="flex gap-2">
                      <input
                        id="new-group-name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        maxLength={40}
                        placeholder="np. Rodzina, Nasza paczka"
                        className="flex-1 min-w-0 min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] text-sm font-semibold"
                      />
                      <button
                        type="submit"
                        disabled={busy || !newName.trim()}
                        className="min-h-[42px] px-4 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-sm font-bold cursor-pointer disabled:opacity-50"
                      >
                        Załóż
                      </button>
                    </div>
                  </form>
                  <form
                    className="space-y-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(() => onJoinGroup(joinCode), () => setJoinCode(''));
                    }}
                  >
                    <label htmlFor="join-group-code" className="block text-xs font-bold text-[var(--th-text)]">
                      Dołącz kodem od znajomego
                    </label>
                    <HelpButton section="group-join" label="Dołączanie do grupy" className="float-right -mt-7" />
                    <div className="flex gap-2">
                      <input
                        id="join-group-code"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={12}
                        placeholder="G-AB12C"
                        className="flex-1 min-w-0 min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] text-sm font-mono font-bold"
                      />
                      <button
                        type="submit"
                        disabled={busy || joinCode.trim().length < 4}
                        className="min-h-[42px] px-4 rounded-xl bg-[var(--th-surface-muted)] border border-[var(--th-border)] text-[var(--th-text)] text-sm font-bold cursor-pointer disabled:opacity-50"
                      >
                        Dołącz
                      </button>
                    </div>
                  </form>
                </div>

                {circles.length > 0 && (
                  <p className="text-xs font-bold text-[var(--th-text)] flex items-center gap-1">
                    Twoje grupy <HelpButton section="visibility" label="Widoczność wyników" />
                  </p>
                )}
                {circles.length > 0 && (
                  <ul className="divide-y divide-[var(--th-border)] border border-[var(--th-border)] rounded-2xl">
                    {circles.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[var(--th-text)] truncate">{c.name}</div>
                          <div className="text-xs text-[var(--th-text-muted)] font-mono">{c.code}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSetShare(c.id, !c.share)}
                            aria-pressed={c.share}
                            className={`min-h-[38px] px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                              c.share
                                ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)] text-[var(--th-primary)]'
                                : 'bg-[var(--th-surface)] border-[var(--th-border)] text-[var(--th-text-muted)]'
                            }`}
                          >
                            {c.share ? <Eye className="w-3.5 h-3.5" aria-hidden="true" /> : <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />}
                            {c.share ? 'Moje wyniki widoczne' : 'Moje wyniki ukryte'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void run(() => onLeaveGroup(c.id), () => {})}
                            className="min-h-[38px] px-3 rounded-xl border border-[var(--th-border)] text-xs font-bold text-red-500 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                            Opuść
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {error && (
              <p className="text-xs font-bold text-red-500" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
