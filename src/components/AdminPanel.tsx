import { KeyRound, LogIn, LogOut, RefreshCw, ShieldCheck, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AdminAccountRow,
  type AdminInviteRow,
  type AdminMemberRow,
  type AdminSession,
  type AppErrorRow,
  type DbUsageDay,
  type DeviceRow,
  type HelpRequestRow,
  type HostingInfo,
  type LoginEventRow,
  SPARK_LIMITS,
  adminResetPassword,
  adminSignIn,
  adminSignOut,
  clearLoginEvents,
  deleteAdminDocs,
  fetchDbUsage,
  fetchHostingInfo,
  hasFreshAdminToken,
  ensureAdminToken,
  listAccounts,
  listAppErrors,
  listDevices,
  listHelpRequests,
  listReviews,
  listOwnerAccounts,
  listAdmins,
  listAdminInvites,
  inviteAdmin,
  removeAdmin,
  cancelAdminInvite,
  setOwnerAccount,
  decideReview,
  type ReviewRow,
  listLoginEvents,
  readAppStatusAdmin,
  restoreAdminSession,
  setHelpRequestDone,
  writeAppStatusAdmin,
} from '../engine/adminCloud';
import {
  type Level,
  computeDbCapacity,
  computeHealth,
  computeHosting,
  computeOverview,
  fmtAgo,
  fmtBytes,
  PAGES_LIMITS,
} from '../engine/adminStats';
import { type AppStatus } from '../engine/appStatus';
import { normalizeLogin } from '../engine/accountSecurity';
import { RELEASES } from '../data/changelog';
import { AdminFairPlay, fairPlayFindings } from './AdminFairPlay';
import { AdminBackup } from './AdminBackup';

export interface AdminDemoData {
  accounts: AdminAccountRow[];
  events: LoginEventRow[];
  devices: DeviceRow[];
  errors: AppErrorRow[];
  help: HelpRequestRow[];
  hosting: HostingInfo;
  usage: DbUsageDay[];
  reviews?: ReviewRow[];
}

interface AdminPanelProps {
  onClose: () => void;
  /** Tylko do podglądu wyglądu w wersji deweloperskiej. */
  demo?: AdminDemoData;
}

function fmtTime(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const REASON_PL: Record<string, string> = {
  ok: 'zalogowano',
  'invalid-credential': 'zły login lub hasło',
  'no-login': 'nie ma takiego loginu',
  timeout: 'brak odpowiedzi bazy',
  network: 'brak internetu',
};

const TOPIC_PL: Record<string, string> = {
  password: 'Nie pamiętam hasła',
  login: 'Nie mogę się zalogować',
  sync: 'Wyniki się nie zapisują',
  other: 'Inny problem',
};

type Tab = 'przeglad' | 'weryfikacja' | 'aktywnosc' | 'baza' | 'hosting' | 'wydania' | 'pomoc' | 'bledy' | 'konta' | 'logowania' | 'admini';

/** Zakładki tylko dla właściciela: kopia i zużycie bazy, komunikaty dla graczy. */
const OWNER_TABS: Tab[] = ['baza', 'wydania'];

const LEVEL_STYLE: Record<Level, string> = {
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  warn: 'border-amber-300 bg-amber-50 text-amber-950',
  bad: 'border-red-300 bg-red-50 text-red-900',
};
const LEVEL_DOT: Record<Level, string> = { ok: '🟢', warn: '🟡', bad: '🔴' };

const card = 'rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface)] p-4';
const btn = 'min-h-[40px] px-3 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50';
const btnGhost = `${btn} border border-[var(--th-border)] bg-[var(--th-surface)]`;
const btnPrimary = `${btn} bg-[var(--th-primary)] text-[var(--th-primary-fg)]`;

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface)] p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--th-text-muted)]">{label}</p>
      <p className="font-display text-2xl font-extrabold tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-xs text-[var(--th-text-muted)]">{sub}</p>}
    </div>
  );
}

function Bars({ rows, limit, unit }: { rows: { label: string; value: number }[]; limit?: number; unit?: string }) {
  const max = Math.max(limit ?? 0, ...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-1">
      <div className="relative flex items-end gap-1 h-32">
        {limit !== undefined && (
          <div className="absolute left-0 right-0 border-t-2 border-dashed border-red-400" style={{ bottom: `${(limit / max) * 100}%` }}>
            <span className="absolute right-0 -top-4 text-[10px] font-bold text-red-500">limit {limit.toLocaleString('pl-PL')}</span>
          </div>
        )}
        {rows.map((r) => (
          <div key={r.label} className="flex-1 h-full flex flex-col justify-end" title={`${r.label}: ${r.value.toLocaleString('pl-PL')}${unit ?? ''}`}>
            <div className="rounded-t-md bg-[var(--th-primary)] min-h-[2px]" style={{ height: `${(r.value / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {rows.map((r, i) => (
          <span key={r.label} className="flex-1 text-center text-[9px] text-[var(--th-text-muted)] tabular-nums truncate">
            {rows.length <= 8 || i % 3 === 0 || i === rows.length - 1 ? r.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function Meter({ label, pct, detail }: { label: string; pct: number; detail: string }) {
  const level: Level = pct >= 80 ? 'bad' : pct >= 50 ? 'warn' : 'ok';
  const color = level === 'bad' ? 'bg-red-500' : level === 'warn' ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-bold">{label}</span>
        <span className="tabular-nums text-[var(--th-text-muted)]">{detail}</span>
      </div>
      <div className="h-3 rounded-full bg-[var(--th-surface-muted)] overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.max(pct, 1))}%` }} />
      </div>
    </div>
  );
}

function Breakdown({ items }: { items: [string, number][] }) {
  const total = items.reduce((a, [, n]) => a + n, 0) || 1;
  return (
    <div className="space-y-1.5">
      {items.map(([k, n]) => (
        <div key={k} className="flex items-center gap-2 text-sm">
          <span className="w-36 truncate">{k}</span>
          <div className="flex-1 h-2.5 rounded-full bg-[var(--th-surface-muted)] overflow-hidden">
            <div className="h-full bg-[var(--th-primary)]" style={{ width: `${(n / total) * 100}%` }} />
          </div>
          <span className="w-8 text-right tabular-nums font-bold">{n}</span>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-[var(--th-text-muted)]">Brak danych.</p>}
    </div>
  );
}

export function AdminPanel({ onClose, demo }: AdminPanelProps) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('przeglad');
  const [accounts, setAccounts] = useState<AdminAccountRow[]>([]);
  const [events, setEvents] = useState<LoginEventRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [errors, setErrors] = useState<AppErrorRow[]>([]);
  const [help, setHelp] = useState<HelpRequestRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [admins, setAdmins] = useState<AdminMemberRow[]>([]);
  const [invites, setInvites] = useState<AdminInviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [hosting, setHosting] = useState<HostingInfo | null>(null);
  const [usage, setUsage] = useState<DbUsageDay[] | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [statusDraft, setStatusDraft] = useState<AppStatus>({ mode: 'off', message: '', untilMs: 0 });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tokenTick, setTokenTick] = useState(0);
  const [loadedAt, setLoadedAt] = useState(0);

  const loadUsage = useCallback(async () => {
    if (!hasFreshAdminToken()) return;
    setUsageError(null);
    try {
      setUsage(await fetchDbUsage());
    } catch (err) {
      setUsageError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    const soft = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    try {
      void soft(listReviews(), []).then(setReviews);
      void soft(listOwnerAccounts(), []).then(setOwners);
      void soft(listAdmins(), []).then(setAdmins);
      void soft(listAdminInvites(), []).then(setInvites);
      const [a, e, d, er, h, ho, st] = await Promise.all([
        listAccounts(),
        soft(listLoginEvents(), []),
        soft(listDevices(), []),
        soft(listAppErrors(), []),
        soft(listHelpRequests(), []),
        fetchHostingInfo(),
        soft(readAppStatusAdmin(), null),
      ]);
      setAccounts(a);
      setEvents(e);
      setDevices(d);
      setErrors(er);
      setHelp(h);
      setHosting(ho);
      if (st) {
        setStatus(st);
        setStatusDraft(st);
      }
      setLoadedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    void loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    if (demo) {
      setSession({ uid: 'demo', email: 'demo@przyklad', isAdmin: true, role: 'owner' });
      setAccounts(demo.accounts);
      setEvents(demo.events);
      setDevices(demo.devices);
      setErrors(demo.errors);
      setHelp(demo.help);
      setReviews(demo.reviews ?? []);
      setHosting(demo.hosting);
      setUsage(demo.usage);
      setStatus({ mode: 'off', message: '', untilMs: 0 });
      setLoadedAt(Date.now());
      setLoading(false);
      return;
    }
    void restoreAdminSession()
      .then((s) => {
        setSession(s);
        if (s?.isAdmin) return refresh();
      })
      .finally(() => setLoading(false));
  }, [refresh, demo]);

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

  const doReset = async (row: AdminAccountRow, helpId?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await adminResetPassword(row, newPwd);
      if (helpId) {
        await setHelpRequestDone(helpId).catch(() => {});
        setHelp((list) => list.map((h) => (h.id === helpId ? { ...h, status: 'done' } : h)));
      }
      setNotice(`Nowe hasło dla „${row.name}” (login: ${row.login}) to: ${newPwd.trim()}`);
      setResetFor(null);
      setNewPwd('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const runAdminAction = async (action: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      const [a, i] = await Promise.all([listAdmins(), listAdminInvites()]);
      setAdmins(a);
      setInvites(i);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setError(
        code === 'permission-denied'
          ? 'Baza nie pozwoliła na tę zmianę (brak uprawnień albo reguły bazy nie są jeszcze opublikowane).'
          : err instanceof Error
            ? err.message
            : String(err)
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleOwner = async (row: AdminAccountRow) => {
    const on = !owners.includes(row.uid);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await setOwnerAccount(row.uid, on);
      setOwners((list) => (on ? [...list, row.uid] : list.filter((u) => u !== row.uid)));
      setNotice(
        on
          ? `Konto „${row.login}” oznaczone jako Twoje. Po zalogowaniu na nie w Koncie pojawi się skrót do panelu (na innych urządzeniach do 30 min).`
          : `Konto „${row.login}” nie jest już oznaczone jako Twoje.`
      );
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setError(
        code === 'permission-denied'
          ? 'Baza nie pozwoliła zapisać — opublikuj najpierw nowe reguły bazy (firestore.rules) w konsoli Firebase.'
          : err instanceof Error
            ? err.message
            : String(err)
      );
    } finally {
      setBusy(false);
    }
  };

  const saveStatus = async () => {
    setBusy(true);
    setError(null);
    try {
      await writeAppStatusAdmin(statusDraft);
      setStatus(statusDraft);
      setNotice(
        statusDraft.mode === 'off'
          ? 'Komunikat wyłączony.'
          : 'Zapisano. Gracze zobaczą komunikat przy najbliższym uruchomieniu lub powrocie do aplikacji (najpóźniej w 15 min).'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const tokenOk = useMemo(() => hasFreshAdminToken(), [tokenTick, session]); // eslint-disable-line react-hooks/exhaustive-deps
  const overview = useMemo(() => computeOverview(accounts, devices, events), [accounts, devices, events]);
  const dbCap = useMemo(() => (usage ? computeDbCapacity(usage, Math.max(overview.devices30, overview.active7)) : null), [usage, overview]);
  const hostCap = useMemo(() => (hosting ? computeHosting(hosting, overview.devices30) : null), [hosting, overview]);
  const health = useMemo(
    () => computeHealth(overview, devices, errors, help, hosting?.appVersion ?? null, dbCap),
    [overview, devices, errors, help, hosting, dbCap]
  );
  const failedCount = overview.failedLogins7;
  const openHelp = help.filter((h) => h.status === 'new').length;
  const err24 = errors.filter((e) => e.atMs >= Date.now() - 86_400_000).length;

  const resetForm = (row: AdminAccountRow, helpId?: string) => (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void doReset(row, helpId);
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
      <button type="submit" disabled={busy || newPwd.trim().length < 4} className={btnPrimary}>
        Ustaw
      </button>
      <button type="button" onClick={() => setResetFor(null)} className={btnGhost}>
        Anuluj
      </button>
    </form>
  );

  const fairCount =
    reviews.filter((r) => r.state === 'pending').length + fairPlayFindings(accounts, devices, events).fastSeries.length;
  const isOwner = session?.role === 'owner';
  const TABS = (
    [
    ['przeglad', 'Przegląd'],
    ['weryfikacja', `Uczciwa gra${fairCount ? ` (${fairCount})` : ''}`],
    ['aktywnosc', 'Aktywność'],
    ['baza', 'Baza'],
    ['hosting', 'Hosting'],
    ['wydania', 'Wydania'],
    ['pomoc', `Pomoc${openHelp ? ` (${openHelp})` : ''}`],
    ['bledy', `Błędy${err24 ? ` (${err24})` : ''}`],
    ['konta', `Konta (${accounts.length})`],
    ['logowania', `Logowania${failedCount ? ` · ${failedCount}✗` : ''}`],
    ['admini', 'Administratorzy'],
    ] as [Tab, string][]
  ).filter(([t]) => isOwner || !OWNER_TABS.includes(t));

  return (
    <div className="fixed inset-0 z-[85] bg-[var(--th-canvas)] text-[var(--th-text)] overflow-y-auto" data-testid="admin-panel">
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4 pb-24">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-bold inline-flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[var(--th-primary)]" aria-hidden="true" />
            Panel administratora
          </h1>
          <button type="button" onClick={onClose} aria-label="Zamknij panel" className={btnGhost}>
            <X className="w-4 h-4" aria-hidden="true" /> Zamknij
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--th-text-muted)]">Ładowanie…</p>
        ) : !session ? (
          <div className={`${card} space-y-3`}>
            <p className="text-sm">
              Panel jest dla właściciela aplikacji i zaproszonych administratorów. Zaloguj się swoim kontem Google.
            </p>
            <button type="button" onClick={signIn} disabled={busy} className={btnPrimary}>
              <LogIn className="w-4 h-4" aria-hidden="true" /> Zaloguj przez Google
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        ) : !session.isAdmin ? (
          <div className={`${card} space-y-3`}>
            <p className="text-sm">
              Konto <b>{session.email}</b> nie ma jeszcze uprawnień administratora.
            </p>
            <p className="text-xs text-[var(--th-text-muted)]">
              Poproś administratora, żeby zaprosił adres <b>{session.email}</b> (Panel → Administratorzy), a potem kliknij „Sprawdź ponownie”.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={signIn} className={btnGhost}>
                Sprawdź ponownie
              </button>
              <button type="button" onClick={() => void adminSignOut().then(() => setSession(null))} className={btnGhost}>
                Wyloguj
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`${card} flex flex-wrap items-center justify-between gap-2`}>
              <p className="text-sm">
                Zalogowano: <b>{session.email}</b> · {isOwner ? 'właściciel' : 'administrator'}
                <span className="block text-xs text-[var(--th-text-muted)]">Dane z {fmtTime(loadedAt)}</span>

              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void refresh()} className={btnGhost}>
                  <RefreshCw className="w-4 h-4" aria-hidden="true" /> Odśwież
                </button>
                <button type="button" onClick={() => void adminSignOut().then(() => setSession(null))} className={btnGhost}>
                  <LogOut className="w-4 h-4" aria-hidden="true" /> Wyloguj
                </button>
              </div>
            </div>

            {notice && (
              <div className="rounded-2xl border border-emerald-400 bg-emerald-50 text-emerald-900 p-3 text-sm font-semibold">
                {notice}
                {notice.startsWith('Nowe hasło') && (
                  <span className="block text-xs font-normal mt-1">
                    Przekaż to hasło dziecku. Na urządzeniach, gdzie było zalogowane, aplikacja poprosi o nowe hasło.
                  </span>
                )}
              </div>
            )}
            {error && <div className="rounded-2xl border border-red-300 bg-red-50 text-red-800 p-3 text-sm">{error}</div>}

            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
              {TABS.map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`${btn} shrink-0 ${tab === t ? 'bg-[var(--th-primary)] text-[var(--th-primary-fg)]' : 'border border-[var(--th-border)] bg-[var(--th-surface)]'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'przeglad' && (
              <div className="space-y-4">
                {!demo && isOwner && <AdminBackup compact />}
                <div className="space-y-2">
                  {health.map((h, i) => (
                    <div key={i} className={`rounded-2xl border px-3 py-2 text-sm font-semibold ${LEVEL_STYLE[h.level]}`}>
                      {LEVEL_DOT[h.level]} {h.text}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Kpi label="Konta" value={overview.accounts} sub={`aktywne 30 dni: ${overview.active30}`} />
                  <Kpi label="Grali dziś" value={overview.active1} sub={`w 7 dni: ${overview.active7}`} />
                  <Kpi label="Urządzenia" value={overview.devices30} sub="widziane w 30 dni" />
                  <Kpi
                    label="Zainstalowane"
                    value={overview.installed30}
                    sub={overview.devices30 ? `${Math.round((overview.installed30 / overview.devices30) * 100)}% urządzeń` : '—'}
                  />
                  <Kpi label="Serie dziś" value={overview.series1} sub={`7 dni: ${overview.series7} · 30 dni: ${overview.series30}`} />
                  <Kpi label="Zadania 7 dni" value={overview.tasks7.toLocaleString('pl-PL')} />
                  <Kpi label="Poprawność 7 dni" value={overview.accuracy7 === null ? '—' : `${overview.accuracy7}%`} />
                  <Kpi label="Śr. czas zadania" value={overview.avgSec7 === null ? '—' : `${overview.avgSec7} s`} sub="7 dni" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className={card}>
                    <p className="font-bold mb-2">Urządzenia (30 dni)</p>
                    <Breakdown items={overview.platforms} />
                  </div>
                  <div className={card}>
                    <p className="font-bold mb-2">Wersje aplikacji</p>
                    <Breakdown items={overview.versions} />
                    {hosting && <p className="text-xs text-[var(--th-text-muted)] mt-2">Aktualna na serwerze: {hosting.appVersion}</p>}
                  </div>
                </div>
              </div>
            )}

            {tab === 'aktywnosc' && (
              <div className="space-y-3">
                <div className={card}>
                  <p className="font-bold">Serie dziennie (14 dni)</p>
                  <p className="text-xs text-[var(--th-text-muted)] mb-3">Z serii zapisanych w chmurze (konto trzyma ostatnie serie).</p>
                  <Bars rows={overview.perDay.map((d) => ({ label: d.day, value: d.series }))} />
                </div>
                <div className={card}>
                  <p className="font-bold">Grających dziennie</p>
                  <Bars rows={overview.perDay.map((d) => ({ label: d.day, value: d.players }))} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className={card}>
                    <p className="font-bold mb-2">Czym grają (30 dni)</p>
                    <Breakdown items={overview.kinds30} />
                  </div>
                  <div className={card}>
                    <p className="font-bold mb-2">Najaktywniejsi (7 dni)</p>
                    <div className="space-y-1">
                      {overview.top7.map((p) => (
                        <div key={p.login} className="flex justify-between gap-2 text-sm border-t border-[var(--th-border)] pt-1">
                          <span className="truncate">
                            {p.name} <span className="text-[var(--th-text-muted)]">({p.login})</span>
                          </span>
                          <span className="tabular-nums shrink-0">
                            {p.series} serii · {p.tasks} zad. · {p.accuracy}%
                          </span>
                        </div>
                      ))}
                      {overview.top7.length === 0 && <p className="text-sm text-[var(--th-text-muted)]">Nikt nie grał w tym tygodniu.</p>}
                    </div>
                  </div>
                </div>
                <div className={card}>
                  <p className="font-bold mb-2">Urządzenia</p>
                  <div className="space-y-1">
                    {devices.slice(0, 40).map((d) => (
                      <div key={d.id} className="flex flex-wrap gap-x-3 text-sm border-t border-[var(--th-border)] pt-1">
                        <span className="font-semibold">{d.platform}</span>
                        <span className="text-[var(--th-text-muted)]">{d.browser}</span>
                        <span>{d.installed ? '📲 zainstalowana' : '🌐 przeglądarka'}</span>
                        <span className="text-[var(--th-text-muted)]">{d.logins.join(', ') || '—'}</span>
                        <span className="text-[var(--th-text-muted)] tabular-nums">v{d.appVersion}</span>
                        {d.unsent && <span className="text-amber-600 font-bold">niewysłane wyniki</span>}
                        <span className="ml-auto text-[var(--th-text-muted)]">{fmtAgo(d.lastSeenMs)}</span>
                      </div>
                    ))}
                    {devices.length === 0 && (
                      <p className="text-sm text-[var(--th-text-muted)]">Urządzenia zgłoszą się po aktualizacji aplikacji (raz na 12 godzin).</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'baza' && (
              <div className="space-y-3">
                <AdminBackup demo={Boolean(demo)} />
                {!tokenOk && !usage && (
                  <div className={`${card} space-y-2`}>
                    <p className="text-sm">Zużycie bazy pobieramy z Google Cloud.</p>
                    <p className="text-xs text-[var(--th-text-muted)]">
                      Za pierwszym razem Google może ostrzec, że aplikacja nie jest zweryfikowana — to Twoja aplikacja: kliknij
                      „Zaawansowane”, potem „Przejdź do…” i zezwól.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void ensureAdminToken()
                          .then(() => {
                            setTokenTick((t) => t + 1);
                            return loadUsage();
                          })
                          .catch((e) => setUsageError(e instanceof Error ? e.message : String(e)))
                      }
                      className={btnPrimary}
                    >
                      <RefreshCw className="w-4 h-4" aria-hidden="true" /> Pokaż zużycie
                    </button>
                  </div>
                )}
                {usageError && <div className="rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 p-3 text-sm">{usageError}</div>}
                {dbCap && (
                  <div className={`rounded-2xl border p-4 space-y-1 ${LEVEL_STYLE[dbCap.level]}`}>
                    <p className="font-bold">
                      {LEVEL_DOT[dbCap.level]}{' '}
                      {dbCap.level === 'ok' ? 'Darmowy plan wystarcza' : dbCap.level === 'warn' ? 'Warto obserwować' : 'Blisko limitu'}
                    </p>
                    <p className="text-sm">{dbCap.advice}</p>
                    {dbCap.devicesCapacity !== null && (
                      <p className="text-sm">
                        Szacunek: przy obecnym sposobie grania darmowy plan uniesie ok. <b>{dbCap.devicesCapacity.toLocaleString('pl-PL')}</b> aktywnych
                        urządzeń dziennie (z 20% zapasem).
                      </p>
                    )}
                  </div>
                )}
                {usage && (
                  <>
                    <div className={`${card} space-y-3`}>
                      <Meter
                        label="Odczyty — najgorszy dzień"
                        pct={dbCap?.peakReadsPct ?? 0}
                        detail={`${Math.max(...usage.map((d) => d.reads), 0).toLocaleString('pl-PL')} / ${SPARK_LIMITS.reads.toLocaleString('pl-PL')}`}
                      />
                      <Meter
                        label="Zapisy — najgorszy dzień"
                        pct={dbCap?.peakWritesPct ?? 0}
                        detail={`${Math.max(...usage.map((d) => d.writes), 0).toLocaleString('pl-PL')} / ${SPARK_LIMITS.writes.toLocaleString('pl-PL')}`}
                      />
                      <p className="text-xs text-[var(--th-text-muted)]">
                        Średnio z 7 dni: {dbCap?.avgReads7.toLocaleString('pl-PL')} odczytów i {dbCap?.avgWrites7.toLocaleString('pl-PL')} zapisów na dobę.
                        Doba liczy się wg czasu w Kalifornii (reset ok. 9:00 rano w Polsce).
                      </p>
                    </div>
                    <div className={card}>
                      <p className="font-bold mb-2">Odczyty dziennie</p>
                      <Bars rows={usage.map((d) => ({ label: d.day.slice(5), value: d.reads }))} limit={SPARK_LIMITS.reads} />
                    </div>
                    <div className={card}>
                      <p className="font-bold mb-2">Zapisy dziennie</p>
                      <Bars rows={usage.map((d) => ({ label: d.day.slice(5), value: d.writes }))} limit={SPARK_LIMITS.writes} />
                    </div>
                  </>
                )}
                <div className={`${card} text-sm space-y-1.5`}>
                  <p className="font-bold">Kiedy myśleć o zmianie</p>
                  <p>• Baza Firestore (plan Spark): 50 tys. odczytów, 20 tys. zapisów, 20 tys. usunięć na dobę i 1 GB danych. Po przekroczeniu zapisy czekają do następnej doby — nic się nie płaci, a aplikacja działa dalej lokalnie.</p>
                  <p>• Logowanie (Firebase Auth): do 3000 aktywnych kont dziennie i 100 nowych kont na godzinę z jednego adresu IP.</p>
                  <p>• Sygnał do migracji: kilka dni z rzędu powyżej 80% albo częste komunikaty „baza odpoczywa”. Wtedy: plan Blaze (płatność tylko za nadwyżkę) albo własny serwer (np. Mikrus).</p>
                  <a className="underline text-[var(--th-primary)] font-bold" href="https://console.firebase.google.com/project/mistrz-tabliczki/firestore/usage" target="_blank" rel="noreferrer">
                    Szczegóły w konsoli Firebase →
                  </a>
                </div>
              </div>
            )}

            {tab === 'hosting' && (
              <div className="space-y-3">
                {hosting && hostCap ? (
                  <>
                    <div className={`rounded-2xl border p-4 ${LEVEL_STYLE[hostCap.level]}`}>
                      <p className="font-bold">
                        {LEVEL_DOT[hostCap.level]} GitHub Pages {hostCap.level === 'ok' ? 'spokojnie wystarcza' : hostCap.level === 'warn' ? '— warto obserwować' : '— czas na mocniejszy hosting'}
                      </p>
                      <p className="text-sm">
                        Cała aplikacja waży {fmtBytes(hosting.totalBytes)} (kod {fmtBytes(hosting.coreBytes)}). Miesięczny limit transferu 100 GB to ok.{' '}
                        <b>{hostCap.installsPerMonth.toLocaleString('pl-PL')}</b> pełnych pobrań aplikacji.
                      </p>
                    </div>
                    <div className={`${card} space-y-3`}>
                      <Meter label="Rozmiar strony" pct={hostCap.sitePct} detail={`${fmtBytes(hosting.totalBytes)} / ${fmtBytes(PAGES_LIMITS.siteBytes)}`} />
                      <Meter
                        label="Szacowany transfer w miesiącu"
                        pct={hostCap.estMonthlyPct}
                        detail={`~${fmtBytes(hostCap.estMonthlyBytes)} / 100 GB`}
                      />
                      <p className="text-xs text-[var(--th-text-muted)]">
                        Szacunek: {overview.devices30} urządzeń × ok. 8 aktualizacji w miesiącu + nowe instalacje. Zainstalowana aplikacja wczytuje się z urządzenia, więc codzienne granie prawie nie zużywa transferu.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[var(--th-text-muted)]">Brak danych o rozmiarze (dostępne w opublikowanej wersji).</p>
                )}
                <div className={`${card} text-sm space-y-1.5`}>
                  <p className="font-bold">Limity GitHub Pages</p>
                  <p>• Strona do 1 GB, transfer „miękko” do 100 GB miesięcznie, publikacja do 10 minut. Za darmo, bez karty.</p>
                  <p>• GitHub przy przekroczeniu najpierw wysyła e-mail — strona nie znika od razu.</p>
                  <p>• Przy tysiącach aktywnych urządzeń warto przenieść stronę (np. Cloudflare Pages — bez limitu transferu, albo własny serwer).</p>
                </div>
              </div>
            )}

            {tab === 'wydania' && (
              <div className="space-y-3">
                <div className={`${card} text-sm space-y-1`}>
                  <p className="font-bold">Wersje</p>
                  <p>Na serwerze: <b>{hosting?.appVersion ?? '—'}</b></p>
                  <p>Na tym urządzeniu: <b>{__APP_VERSION__}</b></p>
                  <p className="text-xs text-[var(--th-text-muted)]">
                    Nowa wersja instaluje się po cichu, gdy gracz wyjdzie z aplikacji (nigdy w trakcie zadań). Po powrocie widzi okienko „Co nowego”.
                  </p>
                </div>
                <div className={`${card} space-y-3`}>
                  <p className="font-bold">Komunikat dla wszystkich graczy</p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['off', 'Wyłączony'],
                        ['banner', 'Pasek z informacją'],
                        ['maintenance', 'Przerwa techniczna'],
                      ] as const
                    ).map(([m, l]) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={statusDraft.mode === m}
                        onClick={() => setStatusDraft((s) => ({ ...s, mode: m }))}
                        className={statusDraft.mode === m ? btnPrimary : btnGhost}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  {statusDraft.mode !== 'off' && (
                    <>
                      <textarea
                        value={statusDraft.message}
                        onChange={(e) => setStatusDraft((s) => ({ ...s, message: e.target.value }))}
                        rows={2}
                        maxLength={300}
                        placeholder={statusDraft.mode === 'maintenance' ? 'Ulepszamy aplikację. Za chwilę wszystko wróci do normy.' : 'np. W sobotę o 20:00 krótka przerwa w zapisie wyników.'}
                        className="w-full rounded-xl border border-[var(--th-border)] bg-[var(--th-surface-muted)] px-3 py-2 text-sm"
                      />
                      <label className="block text-sm">
                        <span className="font-bold">Do kiedy</span> <span className="text-[var(--th-text-muted)]">(po tej godzinie komunikat zniknie sam)</span>
                        <input
                          type="datetime-local"
                          value={statusDraft.untilMs ? new Date(statusDraft.untilMs - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ''}
                          onChange={(e) => setStatusDraft((s) => ({ ...s, untilMs: e.target.value ? new Date(e.target.value).getTime() : 0 }))}
                          className="mt-1 block min-h-[40px] rounded-xl border border-[var(--th-border)] bg-[var(--th-surface-muted)] px-3 text-sm"
                        />
                      </label>
                      {statusDraft.mode === 'maintenance' && (
                        <p className="text-xs text-[var(--th-text-muted)]">
                          Gracze zobaczą planszę „Przerwa techniczna” z przyciskiem „Graj dalej” — mogą grać, a wyniki wyślą się po przerwie. W trakcie serii zadań plansza się nie pojawi.
                        </p>
                      )}
                    </>
                  )}
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => void saveStatus()} disabled={busy} className={btnPrimary}>
                      Zapisz komunikat
                    </button>
                    {status && <span className="text-xs text-[var(--th-text-muted)]">Teraz: {status.mode === 'off' ? 'wyłączony' : status.mode === 'banner' ? 'pasek' : 'przerwa techniczna'}</span>}
                  </div>
                </div>
                <div className={`${card} text-sm space-y-1.5`}>
                  <p className="font-bold">Jak wydać nową wersję</p>
                  <p>1. Dopisz wpis na górze <code>src/data/changelog.ts</code> (prosto, dla dzieci).</p>
                  <p>2. Wypchnij zmiany do <code>main</code> — GitHub Actions publikuje w ok. 1 minutę.</p>
                  <p>3. Gracze nic nie zauważą w trakcie gry; nowa wersja wskoczy po wyjściu z aplikacji, a po powrocie pokaże „Co nowego”.</p>
                  <p>4. Tylko przy dużych zmianach w bazie: najpierw włącz „Przerwę techniczną”, potem opublikuj, sprawdź i wyłącz.</p>
                  <p>5. Po publikacji zajrzyj tu do „Wersje aplikacji” w Przeglądzie i do zakładki Błędy.</p>
                </div>
                <div className={`${card} space-y-2`}>
                  <p className="font-bold">Lista zmian (widoczna dla graczy)</p>
                  {RELEASES.map((r) => (
                    <div key={r.id} className="text-sm border-t border-[var(--th-border)] pt-1">
                      <b>{r.date}</b> — {r.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'weryfikacja' && (
              <AdminFairPlay
                reviews={reviews}
                accounts={accounts}
                devices={devices}
                events={events}
                onDecide={!isOwner ? undefined : async (uid, d) => {
                  try {
                    await decideReview(uid, d);
                    setReviews(await listReviews());
                    setNotice(d === 'suspended' ? 'Konto zablokowane.' : d === 'trusted' ? 'Konto oznaczone jako zaufane.' : 'Konto zwolnione — wyniki wracają do rankingów.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  }
                }}
              />
            )}

            {tab === 'pomoc' && (
              <div className="space-y-2">
                {help.map((h) => {
                  const row = accounts.find((a) => a.login === normalizeLogin(h.login));
                  return (
                    <div key={h.id} className={`${card} ${h.status === 'done' ? 'opacity-60' : ''}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 text-sm">
                          <p className="font-bold">
                            {TOPIC_PL[h.topic] ?? h.topic} · „{h.login}” {h.status === 'done' && <span className="text-emerald-600">✓ załatwione</span>}
                          </p>
                          <p className="text-xs text-[var(--th-text-muted)]">
                            {fmtTime(h.atMs)} · {h.platform}
                            {row ? ` · konto: ${row.name}` : ' · nie ma konta o takim loginie'}
                          </p>
                          {h.message && <p className="mt-1">{h.message}</p>}
                          {h.contact && <p className="text-xs mt-0.5">Kontakt: {h.contact}</p>}
                        </div>
                        <div className="flex gap-2">
                          {row && h.status === 'new' && resetFor !== `help-${h.id}` && (
                            <button
                              type="button"
                              onClick={() => {
                                setResetFor(`help-${h.id}`);
                                setNewPwd('');
                                setNotice(null);
                              }}
                              className={btnGhost}
                            >
                              <KeyRound className="w-4 h-4" aria-hidden="true" /> Nowe hasło
                            </button>
                          )}
                          {h.status === 'new' ? (
                            <button
                              type="button"
                              onClick={() =>
                                void setHelpRequestDone(h.id).then(() => setHelp((l) => l.map((x) => (x.id === h.id ? { ...x, status: 'done' } : x))))
                              }
                              className={btnGhost}
                            >
                              Załatwione
                            </button>
                          ) : isOwner && (
                            <button
                              type="button"
                              onClick={() => void deleteAdminDocs('helpRequests', [h.id]).then(() => setHelp((l) => l.filter((x) => x.id !== h.id)))}
                              className={btnGhost}
                            >
                              Usuń
                            </button>
                          )}
                        </div>
                      </div>
                      {row && resetFor === `help-${h.id}` && resetForm(row, h.id)}
                    </div>
                  );
                })}
                {help.length === 0 && <p className={`${card} text-sm text-[var(--th-text-muted)]`}>Brak próśb o pomoc. Gracze wysyłają je z ekranu logowania („Nie pamiętam hasła”) i z Instrukcji.</p>}
              </div>
            )}

            {tab === 'bledy' && (
              <div className={`${card} space-y-2`}>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-[var(--th-text-muted)]">Nieobsłużone błędy z urządzeń (max 3 na dobę z jednego urządzenia).</p>
                  {isOwner && errors.length > 0 && (
                    <button type="button" onClick={() => void deleteAdminDocs('appErrors', errors.map((e) => e.id)).then(() => setErrors([]))} className="text-xs underline text-[var(--th-text-muted)] cursor-pointer">
                      Wyczyść
                    </button>
                  )}
                </div>
                {errors.map((e) => (
                  <details key={e.id} className="text-sm border-t border-[var(--th-border)] pt-1">
                    <summary className="cursor-pointer">
                      <span className="tabular-nums text-[var(--th-text-muted)]">{fmtTime(e.atMs)}</span> · <b>{e.message}</b>{' '}
                      <span className="text-xs text-[var(--th-text-muted)]">
                        {e.platform} · v{e.appVersion}
                      </span>
                    </summary>
                    <pre className="text-[11px] whitespace-pre-wrap break-all bg-[var(--th-surface-muted)] rounded-lg p-2 mt-1">{e.stack || '—'}</pre>
                  </details>
                ))}
                {errors.length === 0 && <p className="text-sm text-[var(--th-text-muted)]">Brak błędów. 🎉</p>}
              </div>
            )}

            {tab === 'konta' && (
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
                        {row.groups.length > 0 && <p className="text-xs text-[var(--th-text-muted)]">Grupy: {row.groups.join(', ')}</p>}
                        {owners.includes(row.uid) && (
                          <p className="text-xs font-semibold text-[var(--th-primary)]">⭐ Moje konto — w Koncie widać skrót do panelu</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || Boolean(demo)}
                          onClick={() => void toggleOwner(row)}
                          className={btnGhost}
                          title="Na tym koncie gracza (na każdym urządzeniu) w Koncie pojawi się skrót do panelu administratora."
                        >
                          {owners.includes(row.uid) ? 'Nie moje konto' : '⭐ Moje konto'}
                        </button>
                        {resetFor !== row.login && (
                          <button
                            type="button"
                            onClick={() => {
                              setResetFor(row.login);
                              setNewPwd('');
                              setNotice(null);
                              setError(null);
                            }}
                            className={btnGhost}
                          >
                            <KeyRound className="w-4 h-4" aria-hidden="true" /> Nowe hasło
                          </button>
                        )}
                      </div>
                    </div>
                    {resetFor === row.login && resetForm(row)}
                  </div>
                ))}
                {accounts.length === 0 && <p className="text-sm text-[var(--th-text-muted)]">Brak kont.</p>}
              </div>
            )}

            {tab === 'admini' && (
              <div className="space-y-3">
                <div className={`${card} space-y-2`}>
                  <p className="font-bold">Kto ma dostęp do panelu</p>
                  {admins.map((a) => (
                    <div key={a.uid} className="flex flex-wrap items-center justify-between gap-2 text-sm border-t border-[var(--th-border)] pt-2">
                      <span className="min-w-0 break-all">
                        <b>{a.email || (a.uid === session.uid ? session.email : 'konto Google')}</b>
                        <span className="text-[var(--th-text-muted)]"> · {a.role === 'owner' ? 'właściciel' : 'administrator'}</span>
                      </span>
                      {isOwner && a.role === 'admin' && (
                        <button
                          type="button"
                          disabled={busy || Boolean(demo)}
                          onClick={() => {
                            if (!window.confirm(`Odebrać uprawnienia administratora kontu ${a.email}?`)) return;
                            void runAdminAction(async () => {
                              await removeAdmin(a);
                              return `${a.email} nie jest już administratorem.`;
                            });
                          }}
                          className={`${btnGhost} text-rose-600`}
                        >
                          Odbierz uprawnienia
                        </button>
                      )}
                    </div>
                  ))}
                  {admins.length === 0 && <p className="text-sm text-[var(--th-text-muted)]">Brak danych.</p>}
                  <p className="text-xs text-[var(--th-text-muted)]">
                    Administrator może przeglądać panel, ustawiać nowe hasła i zapraszać kolejne osoby. Uprawnienia odbiera tylko właściciel.
                    Kopia i zużycie bazy, komunikaty dla graczy, blokady kont i usuwanie danych są tylko dla właściciela.
                  </p>
                </div>

                <form
                  className={`${card} space-y-2`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void runAdminAction(async () => {
                      const email = await inviteAdmin(inviteEmail);
                      setInviteEmail('');
                      return `Zaproszono ${email}. Ta osoba otwiera panel (adres aplikacji z #admin na końcu) i loguje się tym kontem Google.`;
                    });
                  }}
                >
                  <p className="font-bold inline-flex items-center gap-2">
                    <UserPlus className="w-4 h-4" aria-hidden="true" /> Zaproś administratora
                  </p>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="adres konta Google"
                    autoComplete="off"
                    className="w-full min-h-[44px] rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] px-3"
                  />
                  <button type="submit" disabled={busy || Boolean(demo) || !inviteEmail.trim()} className={btnPrimary}>
                    Zaproś
                  </button>
                  {isOwner && (
                    <p className="text-xs text-[var(--th-text-muted)]">
                      Żeby nowy administrator mógł zmieniać hasła, dodaj jego konto Google w Google Cloud → IAM projektu z rolami
                      „Firebase Authentication Admin” i „Service Usage Consumer”. Jeśli ekran zgody Google jest w trybie testowym, dopisz go też jako testera.
                    </p>
                  )}
                </form>

                {invites.length > 0 && (
                  <div className={`${card} space-y-2`}>
                    <p className="font-bold">Zaproszenia</p>
                    {invites.map((i) => {
                      const accepted = admins.some((a) => a.email === i.email);
                      return (
                        <div key={i.email} className="flex flex-wrap items-center justify-between gap-2 text-sm border-t border-[var(--th-border)] pt-2">
                          <span className="min-w-0 break-all">
                            <b>{i.email}</b>
                            <span className="text-[var(--th-text-muted)]">
                              {' '}· {accepted ? 'przyjęte' : 'czeka na pierwsze logowanie'} · zaprosił(a) {i.byEmail || '—'}
                            </span>
                          </span>
                          {isOwner && !accepted && (
                            <button
                              type="button"
                              disabled={busy || Boolean(demo)}
                              onClick={() =>
                                void runAdminAction(async () => {
                                  await cancelAdminInvite(i.email);
                                  return `Zaproszenie dla ${i.email} odwołane.`;
                                })
                              }
                              className={btnGhost}
                            >
                              Odwołaj
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'logowania' && (
              <div className={`${card} space-y-1`}>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-[var(--th-text-muted)]">Ostatnie próby logowania (hasła nie są zapisywane).</p>
                  {isOwner && events.length > 0 && (
                    <button type="button" onClick={() => void clearLoginEvents(events.map((e) => e.id)).then(refresh)} className="text-xs underline text-[var(--th-text-muted)] cursor-pointer">
                      Wyczyść
                    </button>
                  )}
                </div>
                {events.map((e) => {
                  const known = accounts.some((a) => a.login === normalizeLogin(e.login));
                  return (
                    <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm border-t border-[var(--th-border)] pt-1">
                      <span className="tabular-nums text-[var(--th-text-muted)] w-[92px]">{fmtTime(e.atMs)}</span>
                      <span className={e.ok ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{e.ok ? '✓' : '✗'}</span>
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
