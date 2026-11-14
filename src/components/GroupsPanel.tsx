import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, LogOut, Plus, Settings2, Users, UsersRound } from 'lucide-react';
import type { AccountSyncState } from '../store/useAppStore';
import type { CircleMembership } from '../types/math';

interface GroupsPanelProps {
  circles: CircleMembership[];
  selectedCircleId: string | null;
  onSelectCircle: (circleId: string | null) => void;
  accountState?: AccountSyncState;
  circleError: string | null;
  membersCount: number;
  onCreateGroup: (name: string) => Promise<{ ok: boolean; error?: string }>;
  onJoinGroup: (code: string) => Promise<{ ok: boolean; error?: string }>;
  onLeaveGroup: (circleId: string) => Promise<{ ok: boolean; error?: string }>;
  onSetShare: (circleId: string, share: boolean) => void;
  onOpenAccount: () => void;
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
}: GroupsPanelProps) {
  const [manageOpen, setManageOpen] = useState(circles.length === 0);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  const chip = (active: boolean) =>
    `shrink-0 min-h-[40px] px-3.5 rounded-xl border text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
      active
        ? 'bg-[var(--th-primary)] border-[var(--th-primary)] text-[var(--th-primary-fg)]'
        : 'bg-[var(--th-surface)] border-[var(--th-border)] text-[var(--th-text)] hover:border-[var(--th-primary)]'
    }`;

  return (
    <section
      className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 pt-4"
      aria-label="Grupy"
      data-testid="groups-panel"
    >
      <div className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <UsersRound className="w-5 h-5 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
          <button type="button" className={chip(!selectedCircleId)} onClick={() => onSelectCircle(null)}>
            Moje konta
          </button>
          {circles.map((c) => (
            <button
              key={c.id}
              type="button"
              className={chip(c.id === selectedCircleId)}
              onClick={() => onSelectCircle(c.id)}
            >
              {c.name}
              {!c.share && <EyeOff className="w-3.5 h-3.5 opacity-80" aria-label="wyniki ukryte" />}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setManageOpen((v) => !v)}
            aria-expanded={manageOpen}
            className="shrink-0 min-h-[40px] px-3 rounded-xl border border-dashed border-[var(--th-border)] text-sm font-bold text-[var(--th-text-muted)] hover:text-[var(--th-text)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            {circles.length > 0 ? <Settings2 className="w-4 h-4" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
            <span>{circles.length > 0 ? 'Grupy' : 'Dodaj grupę'}</span>
          </button>
        </div>

        {selected && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <span className="text-[var(--th-text-muted)] inline-flex items-center gap-1.5">
              <Users className="w-4 h-4" aria-hidden="true" />
              {membersCount} {membersCount === 1 ? 'osoba' : membersCount < 5 ? 'osoby' : 'osób'} widocznych w rankingu
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
            </span>
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
                  Grupy działają dla kont z hasłem zapisanych w chmurze.{' '}
                  {accountState?.message ?? 'Ustaw hasło w zakładce Konto, a potem wróć tutaj.'}
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
                      void run(() => onCreateGroup(newName), () => setNewName(''));
                    }}
                  >
                    <label htmlFor="new-group-name" className="block text-xs font-bold text-[var(--th-text)]">
                      Załóż nową grupę
                    </label>
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
