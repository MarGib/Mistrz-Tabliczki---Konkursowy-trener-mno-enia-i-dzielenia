import { Megaphone, Wrench, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type AppStatus, cachedAppStatus, fetchAppStatus } from '../engine/appStatus';

const DISMISS_KEY = 'mt_status_dismissed';

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `ok. ${time}` : `${d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}, ${time}`;
}

function sig(st: AppStatus) {
  return `${st.mode}|${st.message}|${st.untilMs}`;
}

/**
 * Komunikaty administratora dla wszystkich: pasek informacyjny albo plansza przerwy technicznej.
 * Plansza nie blokuje gry — „Graj dalej” zamyka ją, a wyniki zapiszą się na urządzeniu.
 */
export function AppStatusLayer({ hideBanner }: { hideBanner?: boolean }) {
  const [status, setStatus] = useState<AppStatus>(() => cachedAppStatus());
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let alive = true;
    const refresh = (force = false) =>
      void fetchAppStatus(force).then((st) => {
        if (alive && st) setStatus(st);
      });
    refresh();
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    const t = window.setInterval(() => refresh(), 60_000); // fetchAppStatus sam pilnuje odstępów
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(t);
    };
  }, []);

  if (status.mode === 'off' || dismissed === sig(status)) return null;

  const dismiss = () => {
    const s = sig(status);
    setDismissed(s);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, s);
    } catch {
      // ignore
    }
  };

  if (status.mode === 'maintenance') {
    return (
      <div className="fixed inset-0 z-[90] bg-[var(--th-canvas)]/95 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="maint-title" data-testid="maintenance">
        <div className="w-full max-w-sm rounded-3xl bg-[var(--th-surface)] border border-[var(--th-border)] shadow-2xl p-6 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Wrench className="w-8 h-8" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 id="maint-title" className="font-display font-extrabold text-xl">Przerwa techniczna</h2>
            <p className="text-sm text-[var(--th-text-muted)]">
              {status.message || 'Ulepszamy aplikację. Za chwilę wszystko wróci do normy.'}
            </p>
            {status.untilMs > 0 && (
              <p className="text-sm font-bold">Wracamy {fmtTime(status.untilMs)}</p>
            )}
          </div>
          <p className="text-xs text-[var(--th-text-muted)]">
            Możesz grać dalej — wyniki zapiszą się na tym urządzeniu i wyślą same, gdy przerwa się skończy.
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="w-full min-h-[48px] rounded-2xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-display font-bold border-b-4 border-[var(--th-primary-dark)] cursor-pointer"
          >
            Graj dalej
          </button>
        </div>
      </div>
    );
  }

  if (hideBanner) return null;
  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-6 pt-3" data-testid="status-banner">
      <div className="rounded-2xl border border-sky-300 bg-sky-50 text-sky-950 px-3 py-2.5 flex items-start gap-2.5 text-sm">
        <Megaphone className="w-5 h-5 shrink-0 mt-0.5 text-sky-600" aria-hidden="true" />
        <p className="flex-1">
          {status.message}
          {status.untilMs > 0 && <span className="font-bold"> (do {fmtTime(status.untilMs)})</span>}
        </p>
        <button type="button" onClick={dismiss} aria-label="Zamknij komunikat" className="w-8 h-8 -m-1 rounded-full hover:bg-sky-100 flex items-center justify-center cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
