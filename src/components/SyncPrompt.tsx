import { useState } from 'react';
import { HelpButton } from '../help/HelpButton';
import { CloudOff } from 'lucide-react';
import { hasAccountPassword, verifyAccountCredentials } from '../engine/accountSecurity';
import type { AccountSyncState } from '../store/useAppStore';
import type { UserProfile } from '../types/math';
import { PasswordInput } from './PasswordInput';

interface SyncPromptProps {
  profile: UserProfile;
  state?: AccountSyncState;
  onSubmitPassword: (profileId: string, login: string, password: string) => void;
}

/** Pasek dla kont, które nie są jeszcze w chmurze: jedno wpisanie hasła włącza synchronizację. */
export function SyncPrompt({ profile, state, onSubmitPassword }: SyncPromptProps) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !state || state.state === 'synced' || state.state === 'syncing') return null;
  const hasPwd = hasAccountPassword(profile);

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
            {state.state === 'error' && state.message
              ? state.message
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
