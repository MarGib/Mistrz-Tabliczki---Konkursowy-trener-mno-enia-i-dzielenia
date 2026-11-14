import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listAccounts, listAppErrors, listDevices, listHelpRequests, listLoginEvents, restoreAdminSession } from '../engine/adminCloud';
import { type HealthSignal, computeHealth, computeOverview } from '../engine/adminStats';

interface Peek {
  at: number;
  active1: number;
  active7: number;
  accounts: number;
  series1: number;
  series7: number;
  devices: number;
  installed: number;
  accuracy7: number | null;
  openHelp: number;
  err24: number;
  health: HealthSignal[];
}

const CACHE_KEY = 'mt_admin_peek';
const DOT = { ok: '🟢', warn: '🟡', bad: '🔴' } as const;

function readCache(): Peek | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Peek) : null;
  } catch {
    return null;
  }
}

/** „Podgląd administratora” w Koncie — kilka liczb na szybkie zerknięcie, bez otwierania panelu. */
export function AdminQuickPeek() {
  const [peek, setPeek] = useState<Peek | null>(() => readCache());
  const [state, setState] = useState<'loading' | 'ready' | 'login' | 'error'>(peek ? 'ready' : 'loading');

  const load = async (force = false) => {
    const cached = readCache();
    if (!force && cached && Date.now() - cached.at < 10 * 60_000) {
      setPeek(cached);
      setState('ready');
      return;
    }
    setState((s) => (s === 'ready' ? s : 'loading'));
    try {
      const session = await restoreAdminSession();
      if (!session?.isAdmin) {
        setState('login');
        return;
      }
      const soft = <T,>(p: Promise<T>, f: T) => p.catch(() => f);
      const [accounts, devices, events, help, errors] = await Promise.all([
        listAccounts(),
        soft(listDevices(), []),
        soft(listLoginEvents(50), []),
        soft(listHelpRequests(30), []),
        soft(listAppErrors(30), []),
      ]);
      const o = computeOverview(accounts, devices, events);
      const p: Peek = {
        at: Date.now(),
        active1: o.active1,
        active7: o.active7,
        accounts: o.accounts,
        series1: o.series1,
        series7: o.series7,
        devices: o.devices30,
        installed: o.installed30,
        accuracy7: o.accuracy7,
        openHelp: help.filter((h) => h.status === 'new').length,
        err24: errors.filter((e) => e.atMs >= Date.now() - 86_400_000).length,
        health: computeHealth(o, devices, errors, help, null, null).slice(0, 3),
      };
      try {
        window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(p));
      } catch {
        // ignore
      }
      setPeek(p);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = () => {
    window.location.hash = 'admin';
  };

  const tile = (label: string, value: string | number, sub?: string) => (
    <div className="rounded-xl bg-[var(--th-surface)] border border-[var(--th-border)] px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--th-text-muted)] leading-tight">{label}</p>
      <p className="font-display text-xl font-extrabold tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-[var(--th-text-muted)] leading-tight">{sub}</p>}
    </div>
  );

  return (
    <div className="rounded-2xl border border-dashed border-[var(--th-primary)] bg-[var(--th-soft-tint)] p-3 space-y-2.5" data-testid="admin-peek">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-sm inline-flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" /> Podgląd administratora
        </p>
        {state === 'ready' && (
          <button type="button" onClick={() => void load(true)} className="text-xs underline text-[var(--th-text-muted)] cursor-pointer">
            odśwież
          </button>
        )}
      </div>
      {state === 'loading' && <p className="text-xs text-[var(--th-text-muted)]">Wczytywanie statystyk…</p>}
      {state === 'login' && <p className="text-xs text-[var(--th-text-muted)]">Zaloguj się w panelu przez Google, aby widzieć statystyki tutaj.</p>}
      {state === 'error' && <p className="text-xs text-[var(--th-text-muted)]">Nie udało się wczytać (brak internetu albo baza odpoczywa).</p>}
      {peek && state === 'ready' && (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {tile('Grali dziś', peek.active1, `7 dni: ${peek.active7} z ${peek.accounts}`)}
            {tile('Serie dziś', peek.series1, `7 dni: ${peek.series7}`)}
            {tile('Urządzenia', peek.devices, `zainstal.: ${peek.installed}`)}
            {tile('Poprawność', peek.accuracy7 === null ? '—' : `${peek.accuracy7}%`, '7 dni')}
            {tile('Prośby', peek.openHelp, 'o pomoc')}
            {tile('Błędy', peek.err24, 'w 24 h')}
          </div>
          <div className="space-y-1">
            {peek.health.map((h, i) => (
              <p key={i} className="text-xs font-semibold">
                {DOT[h.level]} {h.text}
              </p>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={open}
        className="w-full min-h-[40px] rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-sm font-bold cursor-pointer"
      >
        Otwórz pełny panel administratora
      </button>
    </div>
  );
}
