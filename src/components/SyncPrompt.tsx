import { useEffect, useState } from 'react';
import { HelpButton } from '../help/HelpButton';
import { CloudOff, RefreshCw } from 'lucide-react';
import { hasAccountPassword, verifyAccountCredentials } from '../engine/accountSecurity';
import type { AccountSyncState } from '../store/useAppStore';
import type { UserProfile } from '../types/math';
import { PasswordInput } from './PasswordInput';

interface SyncPromptProps {
  profile: UserProfile;
  state?: AccountSyncState;
  onSubmitPassword: (profileId: string, login: string, password: string) => void;
  onRetry?: (profileId: string) => void;
}

/** Pasek dla kont, które nie są jeszcze w chmurze: jedno wpisanie hasła włącza synchronizację. */
export function SyncPrompt({ profile, state, onSubmitPassword, onRetry }: SyncPromptProps) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const hasPwd = hasAccountPassword(profile);
  const transient =
    !!state && (state.state === 'waiting' || state.state === 'error' || (state.state === 'synced' && !!state.unsent));
  const [, tick] = useState(0);
  useEffect(() => {
    if (!transient) return;
    const id = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [transient]);

  if (!state) return null;

  // Chwilowy problem z siecią/bazą: hasło nie jest potrzebne — tylko informacja i ponawianie.
  if (transient) {
    const secs = state.retryAt ? Math.max(0, Math.round((state.retryAt - Date.now()) / 1000)) : null;
    return (
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-3" data-testid="sync-status">
        <div className="rounded-2xl border border-sky-300 bg-sky-50 text-sky-950 p-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <CloudOff className="w-5 h-5 shrink-0 mt-0.5 text-sky-700" aria-hidden="true" />
            <p className="text-sm font-semibold">
              {state.message ?? 'Chwilowy problem z połączeniem. Ponawiam automatycznie.'}
              <span className="block text-xs font-normal text-sky-800 mt-0.5">
                Możesz grać dalej — nic nie zginie.
                {secs !== null && secs > 0 ? ` Kolejna próba za ${secs} s.` : ' Trwa ponawianie…'}
              </span>
            </p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={() => onRetry(profile.id)}
              className="min-h-[42px] px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold cursor-pointer shrink-0 inline-flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" /> Spróbuj teraz
            </button>
          )}
        </div>
      </div>
    );
  }

  if (dismissed || state.state === 'synced' || state.state === 'syncing') return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = pwd.trim();
    if (p.length < 4) {
      setError('Hasło lub PIN musi mieć co najmniej 4 znaki.');
      return;
    }
    if (hasPwd && !verifyAccountCredentials(profile, p)) {
      setError('To nie jest hasło tego konta. Spróbuj jeszcze raz.');
      return;
    }
    setError(null);
    onSubmitPassword(profile.id, profile.login || profile.name, p);
    setPwd('');
  };

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-3" data-testid="sync-prompt">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 p-3 flex flex-col sm:flex-row sm:items-center gap-2.5"
      >
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <CloudOff className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <HelpButton section="sync" label="Synchronizacja" className="-mt-1.5 -ml-1 order-last" />
          <p className="text-sm font-semibold">
            {state.state === 'needs-password' && state.message && hasPwd
              ? `${state.message} (konto „${profile.login || profile.name}”)`
              : hasPwd
              ? `Wpisz hasło konta „${profile.login || profile.name}”, aby zapisać wyniki w chmurze i logować się na innych urządzeniach.`
              : 'Ustaw hasło lub PIN, aby zapisać wyniki w chmurze i logować się na innych urządzeniach.'}
            {error && <span className="block text-red-600 mt-1">{error}</span>}
          </p>
        </div>
        <div className="flex gap-2 sm:w-auto">
          <div className="flex-1 sm:w-40">
            <PasswordInput
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder={hasPwd ? 'Twoje hasło' : 'Nowe hasło / PIN'}
              aria-label="Hasło konta"
              autoComplete={hasPwd ? 'current-password' : 'new-password'}
              className="w-full min-h-[42px] px-3 rounded-xl border border-amber-300 bg-white text-slate-900 text-sm font-semibold"
            />
          </div>
          <button
            type="submit"
            className="min-h-[42px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold cursor-pointer shrink-0"
          >
            Włącz
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="min-h-[42px] px-2 text-xs font-bold text-amber-800 cursor-pointer shrink-0"
          >
            Później
          </button>
        </div>
      </form>
    </div>
  );
}
