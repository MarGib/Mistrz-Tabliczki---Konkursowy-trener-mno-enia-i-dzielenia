import { ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { UserProfile } from '../types/math';

/** Prywatność: link do zasad i trwałe usunięcie konta (z potwierdzeniem wpisaniem loginu). */
export function DeleteAccountCard({
  profile,
  onDelete,
}: {
  profile: UserProfile;
  onDelete: (profileId: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = (profile.login ?? profile.name).trim().toLowerCase();
  const match = typed.trim().toLowerCase() === login;

  return (
    <div className="pt-4 border-t border-[var(--th-border)] space-y-2" data-testid="privacy-card">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ShieldCheck className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
        <a href="./prywatnosc.html" target="_blank" rel="noopener" className="font-bold underline underline-offset-2">
          Zasady prywatności
        </a>
        <span className="text-[var(--th-text-muted)]">· bez e-maili i danych osobowych</span>
      </div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-[36px] px-3 rounded-xl border border-[var(--th-border)] text-xs font-bold text-[var(--th-text-muted)] hover:border-red-400 hover:text-red-600 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Usuń konto i wszystkie wyniki
        </button>
      ) : (
        <div className="rounded-2xl border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 space-y-2 text-sm">
          <p>
            Konto <b>{login}</b> zniknie na zawsze: wyniki, historia, gwiazdki, miejsca w grupach — w chmurze i na tym urządzeniu.
            Tego nie da się cofnąć. {profile.cloudUid ? 'Potrzebny jest internet.' : ''}
          </p>
          <label className="block text-xs font-semibold">
            Aby potwierdzić, wpisz login: <b>{login}</b>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full min-h-[40px] rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] px-3"
            />
          </label>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!match || busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const res = await onDelete(profile.id);
                setBusy(false);
                if (!res.ok) setError(res.error ?? 'Nie udało się usunąć konta.');
              }}
              className="min-h-[40px] px-3 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
            >
              {busy ? 'Usuwam…' : 'Usuń na zawsze'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setTyped(''); setError(null); }} className="min-h-[40px] px-3 rounded-xl border border-[var(--th-border)] text-xs font-bold cursor-pointer">
              Anuluj
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
