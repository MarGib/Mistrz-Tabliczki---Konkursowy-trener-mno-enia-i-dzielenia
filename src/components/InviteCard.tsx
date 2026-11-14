import { useEffect, useState } from 'react';
import { HelpButton } from '../help/HelpButton';
import { UsersRound } from 'lucide-react';

const KEY = 'mt_pending_invite';

/** Odczytuje ?dolacz=KOD z linku zaproszenia i zapamiętuje go do czasu zalogowania. */
export function capturePendingInvite(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('dolacz');
    if (code) {
      window.localStorage.setItem(KEY, code.toUpperCase().slice(0, 16));
      params.delete('dolacz');
      const q = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
    }
  } catch {
    // brak dostępu do localStorage — trudno, kod można wpisać ręcznie
  }
}

export function readPendingInvite(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

interface InviteCardProps {
  canJoin: boolean;
  alreadyMemberCodes: string[];
  onJoin: (code: string) => Promise<{ ok: boolean; error?: string }>;
  onJoined: () => void;
}

/** Pasek „Zaproszenie do grupy” po otwarciu linku od znajomego. */
export function InviteCard({ canJoin, alreadyMemberCodes, onJoin, onJoined }: InviteCardProps) {
  const [code, setCode] = useState<string | null>(readPendingInvite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code && alreadyMemberCodes.includes(code)) {
      clearPendingInvite();
      setCode(null);
    }
  }, [code, alreadyMemberCodes]);

  if (!code) return null;

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-3" data-testid="invite-card">
      <div className="rounded-2xl border-2 border-[var(--th-primary)] bg-[var(--th-soft-tint)] p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-2.5 flex-1">
          <UsersRound className="w-6 h-6 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
          <HelpButton section="group-join" label="Dołączanie do grupy" className="order-last -mt-1.5" />
          <div className="text-sm text-[var(--th-text)]">
            <p className="font-bold">Masz zaproszenie do grupy (kod {code}).</p>
            <p>
              {canJoin
                ? 'Dołącz, aby porównywać wyniki i dostawać powiadomienia.'
                : 'Najpierw włącz synchronizację konta (wpisz hasło powyżej), potem dołączysz jednym kliknięciem.'}
            </p>
            {error && <p className="text-red-600 font-semibold mt-1">{error}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canJoin || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const res = await onJoin(code);
              setBusy(false);
              if (res.ok) {
                clearPendingInvite();
                setCode(null);
                onJoined();
              } else {
                setError(res.error ?? 'Nie udało się dołączyć.');
              }
            }}
            className="min-h-[46px] px-5 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-bold cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Dołączam…' : 'Dołącz'}
          </button>
          <button
            type="button"
            onClick={() => {
              clearPendingInvite();
              setCode(null);
            }}
            className="min-h-[46px] px-3 rounded-xl text-sm font-bold text-[var(--th-text-muted)] cursor-pointer"
          >
            Nie teraz
          </button>
        </div>
      </div>
    </div>
  );
}
