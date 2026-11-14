import { KeyRound, LogIn, LogOut, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AdminAccountRow,
  type AdminSession,
  type LoginEventRow,
  adminResetPassword,
  adminSignIn,
  adminSignOut,
  clearLoginEvents,
  hasFreshAdminToken,
  listAccounts,
  listLoginEvents,
  restoreAdminSession,
} from '../engine/adminCloud';
import { normalizeLogin } from '../engine/accountSecurity';

interface AdminPanelProps {
  onClose: () => void;
}

function fmtTime(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const REASON_PL: Record<string, string> = {
  ok: 'zalogowano',
  'invalid-credential': 'zły login lub hasło',
  'no-login': 'nie ma takiego loginu',
  timeout: 'brak odpowiedzi bazy',
  network: 'brak internetu',
};

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'konta' | 'logowania'>('konta');
  const [accounts, setAccounts] = useState<AdminAccountRow[]>([]);
  const [events, setEvents] = useState<LoginEventRow[]>([]);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tokenTick, setTokenTick] = useState(0);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [a, e] = await Promise.all([listAccounts(), listLoginEvents()]);
      setAccounts(a);
      setEvents(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void restoreAdminSession()
      .then((s) => {
        setSession(s);
        if (s?.isAdmin) return refresh();
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  const signIn = async () => {
    setError(null);
    setBusy(true);
    try {
      const s = await adminSignIn();
      setSession(s);
      setTokenTick((t) => t + 1);
      if (s.isAdmin) await refresh();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setError(
        code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
          ? 'Logowanie przerwane.'
          : code === 'auth/popup-blocked'
          ? 'Przeglądarka zablokowała okienko logowania — zezwól na wyskakujące okna i spróbuj ponownie.'
          : err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setBusy(false);
    }
  };

  const doReset = async (row: AdminAccountRow) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await adminResetPassword(row, newPwd);
      setNotice(`Nowe hasło dla „${row.name}” (login: ${row.login}) to: ${newPwd.trim()}`);
      setResetFor(null);
      setNewPwd('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const failedCount = useMemo(() => events.filter((e) => !e.ok).length, [events]);
  const tokenOk = useMemo(() => hasFreshAdminToken(), [tokenTick, session]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = 'rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface)] p-4';
  const btn =
    'min-h-[40px] px-3 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-[80] bg-[var(--th-canvas)] text-[var(--th-text)] overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4 pb-24">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-bold inline-flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[var(--th-primary)]" aria-hidden="true" />
            Panel administratora
          </h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij panel"
            className={`${btn} border border-[var(--th-border)] bg-[var(--th-surface)]`}
          >
            <X className="w-4 h-4" aria-hidden="true" /> Zamknij
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--th-text-muted)]">Ładowanie…</p>
        ) : !session ? (
          <div className={`${card} space-y-3`}>
            <p className="text-sm">
              Panel jest tylko dla właściciela aplikacji. Zaloguj się kontem Google, które jest właścicielem
              projektu Firebase.
            </p>
            <button
              type="button"
              onClick={signIn}
              disabled={busy}
              className={`${btn} bg-[var(--th-primary)] text-[var(--th-primary-fg)]`}
            >
              <LogIn className="w-4 h-4" aria-hidden="true" /> Zaloguj przez Google
            </button>
          </div>
        ) : !session.isAdmin ? (
          <div className={`${card} space-y-3`}>
            <p className="text-sm">
              Konto <b>{session.email}</b> nie ma jeszcze uprawnień administratora.
            </p>
            <p className="text-xs text-[var(--th-text-muted)]">
              Identyfikator do nadania uprawnień (dokument <code>admins/{'{uid}'}</code> w bazie):{' '}
              <code className="select-all break-all">{session.uid}</code>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={signIn}
                className={`${btn} border border-[var(--th-border)]`}
              >
                Sprawdź ponownie
              </button>
              <button
                type="button"
                onClick={() => void adminSignOut().then(() => setSession(null))}
                className={`${btn} border border-[var(--th-border)]`}
              >
                Wyloguj
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`${card} flex flex-wrap items-center justify-between gap-2`}>
              <p className="text-sm">
                Zalogowano: <b>{session.email}</b>
                {!tokenOk && (
                  <span className="block text-xs text-amber-600">
                    Aby resetować hasła, zaloguj się ponownie (uprawnienie Google ważne ok. godziny).
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                {!tokenOk && (
                  <button
                    type="button"
                    onClick={signIn}
                    disabled={busy}
                    className={`${btn} bg-[var(--th-primary)] text-[var(--th-primary-fg)]`}
                  >
                    <LogIn className="w-4 h-4" aria-hidden="true" /> Zaloguj ponownie
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className={`${btn} border border-[var(--th-border)]`}
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" /> Odśwież
                </button>
                <button
                  type="button"
                  onClick={() => void adminSignOut().then(() => setSession(null))}
                  className={`${btn} border border-[var(--th-border)]`}
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" /> Wyloguj
                </button>
              </div>
            </div>

            {notice && (
              <div className="rounded-2xl border border-emerald-400 bg-emerald-50 text-emerald-900 p-3 text-sm font-semibold">
                {notice}
                <span className="block text-xs font-normal mt-1">
                  Przekaż to hasło dziecku. Na urządzeniach, gdzie było zalogowane, aplikacja poprosi o nowe hasło.
                </span>
              </div>
            )}
            {error && (
              <div className="rounded-2xl border border-red-300 bg-red-50 text-red-800 p-3 text-sm">{error}</div>
            )}

            <div className="flex gap-2">
              {(['konta', 'logowania'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`${btn} ${
                    tab === t
                      ? 'bg-[var(--th-primary)] text-[var(--th-primary-fg)]'
                      : 'border border-[var(--th-border)] bg-[var(--th-surface)]'
                  }`}
                >
                  {t === 'konta' ? `Konta (${accounts.length})` : `Logowania${failedCount ? ` · ${failedCount} nieudane` : ''}`}
                </button>
              ))}
            </div>

            {tab === 'konta' ? (
              <div className="space-y-2">
                {accounts.map((row) => (
                  <div key={row.login} className={card}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold">
                          {row.name} <span className="font-normal text-[var(--th-text-muted)]">· login: {row.login}</span>
                        </p>
                        <p className="text-xs text-[var(--th-text-muted)] tabular-nums">
                          {row.xp} XP · {row.sessions} serii · ostatnio {fmtTime(row.updatedAtMs)}
                        </p>
                        {row.groups.length > 0 && (
                          <p className="text-xs text-[var(--th-text-muted)]">Grupy: {row.groups.join(', ')}</p>
                        )}
                      </div>
                      {resetFor !== row.login && (
                        <button
                          type="button"
                          onClick={() => {
                            setResetFor(row.login);
                            setNewPwd('');
                            setNotice(null);
                            setError(null);
                          }}
                          className={`${btn} border border-[var(--th-border)]`}
                        >
                          <KeyRound className="w-4 h-4" aria-hidden="true" /> Nowe hasło
                        </button>
                      )}
                    </div>
                    {resetFor === row.login && (
                      <form
                        className="mt-3 flex flex-wrap items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void doReset(row);
                        }}
                      >
                        <input
                          autoFocus
                          value={newPwd}
                          onChange={(e) => setNewPwd(e.target.value)}
                          placeholder="Nowe hasło lub PIN (min. 4)"
                          autoComplete="off"
                          className="min-h-[40px] flex-1 min-w-[160px] rounded-xl border border-[var(--th-border)] bg-[var(--th-surface-muted)] px-3 text-sm"
                        />
                        <button
                          type="submit"
                          disabled={busy || newPwd.trim().length < 4}
                          className={`${btn} bg-[var(--th-primary)] text-[var(--th-primary-fg)]`}
                        >
                          Ustaw
                        </button>
                        <button
                          type="button"
                          onClick={() => setResetFor(null)}
                          className={`${btn} border border-[var(--th-border)]`}
                        >
                          Anuluj
                        </button>
                      </form>
                    )}
                  </div>
                ))}
                {accounts.length === 0 && <p className="text-sm text-[var(--th-text-muted)]">Brak kont.</p>}
              </div>
            ) : (
              <div className={`${card} space-y-1`}>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-[var(--th-text-muted)]">
                    Ostatnie próby logowania (hasła nie są zapisywane).
                  </p>
                  {events.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void clearLoginEvents(events.map((e) => e.id)).then(refresh)}
                      className="text-xs underline text-[var(--th-text-muted)] cursor-pointer"
                    >
                      Wyczyść
                    </button>
                  )}
                </div>
                {events.map((e) => {
                  const known = accounts.some((a) => a.login === normalizeLogin(e.login));
                  return (
                    <div
                      key={e.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm border-t border-[var(--th-border)] pt-1"
                    >
                      <span className="tabular-nums text-[var(--th-text-muted)] w-[92px]">{fmtTime(e.atMs)}</span>
                      <span className={e.ok ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                        {e.ok ? '✓' : '✗'}
                      </span>
                      <span className="font-semibold">„{e.login}”</span>
                      {!e.ok && !known && <span className="text-xs text-amber-600">(nie ma takiego loginu)</span>}
                      <span className="text-xs text-[var(--th-text-muted)]">
                        {REASON_PL[e.reason] ?? e.reason} · {e.device}
                      </span>
                    </div>
                  );
                })}
                {events.length === 0 && <p className="text-sm text-[var(--th-text-muted)]">Brak wpisów.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
