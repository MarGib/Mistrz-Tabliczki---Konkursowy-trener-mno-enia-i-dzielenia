/**
 * Obliczenia do panelu administratora — czyste funkcje (łatwe do testu na przykładowych danych).
 */
import type { AdminAccountRow, AppErrorRow, DbUsageDay, DeviceRow, HelpRequestRow, HostingInfo, LoginEventRow } from './adminCloud';
import { SPARK_LIMITS } from './adminCloud';

const DAY = 24 * 3600_000;

function lastActivity(a: AdminAccountRow): number {
  const fromSessions = a.recent.reduce((m, s) => Math.max(m, s.t), 0);
  const fromDate = a.lastActiveDate ? new Date(`${a.lastActiveDate}T12:00:00`).getTime() || 0 : 0;
  return Math.max(fromSessions, fromDate, a.updatedAtMs);
}

export interface Overview {
  accounts: number;
  active1: number;
  active7: number;
  active30: number;
  devices30: number;
  installed30: number;
  platforms: [string, number][];
  versions: [string, number][];
  series1: number;
  series7: number;
  series30: number;
  tasks7: number;
  accuracy7: number | null;
  avgSec7: number | null;
  perDay: { day: string; series: number; players: number }[];
  kinds30: [string, number][];
  top7: { name: string; login: string; series: number; tasks: number; accuracy: number }[];
  failedLogins7: number;
  okLogins7: number;
  unsentDevices: number;
  newAccounts30: number;
}

const KIND_LABEL: Record<string, string> = {
  stage: 'Ścieżka (etapy)',
  tournament: 'Turnieje',
  master: 'Wyzwanie Mistrza',
  free: 'Trening dowolny',
};

function count<T>(items: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

export function computeOverview(
  accounts: AdminAccountRow[],
  devices: DeviceRow[],
  events: LoginEventRow[],
  now = Date.now()
): Overview {
  const acts = accounts.map(lastActivity);
  const sessions = accounts.flatMap((a) => a.recent.map((s) => ({ ...s, login: a.login, name: a.name })));
  const since = (d: number) => sessions.filter((s) => s.t >= now - d * DAY);
  const s7 = since(7);
  const tasks7 = s7.reduce((a, s) => a + s.tasks, 0);
  const correct7 = s7.reduce((a, s) => a + s.correct, 0);
  const timed = s7.filter((s) => s.avgMs > 0);

  const perDay: Overview['perDay'] = [];
  for (let i = 13; i >= 0; i--) {
    const start = new Date(now - i * DAY);
    start.setHours(0, 0, 0, 0);
    const end = start.getTime() + DAY;
    const daySessions = sessions.filter((s) => s.t >= start.getTime() && s.t < end);
    perDay.push({
      day: start.toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' }),
      series: daySessions.length,
      players: new Set(daySessions.map((s) => s.login)).size,
    });
  }

  const byPlayer = new Map<string, Overview['top7'][number] & { correct: number }>();
  for (const s of s7) {
    const r = byPlayer.get(s.login) ?? { name: s.name, login: s.login, series: 0, tasks: 0, accuracy: 0, correct: 0 };
    r.series += 1;
    r.tasks += s.tasks;
    r.correct += s.correct;
    byPlayer.set(s.login, r);
  }
  const top7 = Array.from(byPlayer.values())
    .map((r) => ({ ...r, accuracy: r.tasks ? Math.round((r.correct / r.tasks) * 100) : 0 }))
    .sort((a, b) => b.tasks - a.tasks)
    .slice(0, 8);

  const dev30 = devices.filter((d) => d.lastSeenMs >= now - 30 * DAY);
  const ev7 = events.filter((e) => e.atMs >= now - 7 * DAY);

  return {
    accounts: accounts.length,
    active1: acts.filter((t) => t >= now - DAY).length,
    active7: acts.filter((t) => t >= now - 7 * DAY).length,
    active30: acts.filter((t) => t >= now - 30 * DAY).length,
    devices30: dev30.length,
    installed30: dev30.filter((d) => d.installed).length,
    platforms: count(dev30, (d) => d.platform || '?'),
    versions: count(dev30, (d) => d.appVersion || '?'),
    series1: since(1).length,
    series7: s7.length,
    series30: since(30).length,
    tasks7,
    accuracy7: tasks7 ? Math.round((correct7 / tasks7) * 100) : null,
    avgSec7: timed.length ? Math.round((timed.reduce((a, s) => a + s.avgMs, 0) / timed.length) / 100) / 10 : null,
    perDay,
    kinds30: count(since(30), (s) => KIND_LABEL[s.kind] ?? s.kind),
    top7,
    failedLogins7: ev7.filter((e) => !e.ok).length,
    okLogins7: ev7.filter((e) => e.ok).length,
    unsentDevices: dev30.filter((d) => d.unsent || d.dbPaused).length,
    newAccounts30: 0,
  };
}

export type Level = 'ok' | 'warn' | 'bad';

export interface DbCapacity {
  level: Level;
  peakReadsPct: number;
  peakWritesPct: number;
  avgReads7: number;
  avgWrites7: number;
  readsPerDevice: number | null;
  devicesCapacity: number | null;
  advice: string;
}

export function computeDbCapacity(usage: DbUsageDay[], activeDevices: number): DbCapacity {
  const last7 = usage.slice(-7);
  const avg = (k: 'reads' | 'writes') => (last7.length ? last7.reduce((a, d) => a + d[k], 0) / last7.length : 0);
  const peak = (k: 'reads' | 'writes') => usage.reduce((m, d) => Math.max(m, d[k]), 0);
  const peakReadsPct = Math.round((peak('reads') / SPARK_LIMITS.reads) * 100);
  const peakWritesPct = Math.round((peak('writes') / SPARK_LIMITS.writes) * 100);
  const worst = Math.max(peakReadsPct, peakWritesPct);
  const avgReads7 = Math.round(avg('reads'));
  const avgWrites7 = Math.round(avg('writes'));
  const perDevice = activeDevices > 0 ? Math.max(avgReads7 / SPARK_LIMITS.reads, avgWrites7 / SPARK_LIMITS.writes) / activeDevices : null;
  const devicesCapacity = perDevice && perDevice > 0 ? Math.floor(0.8 / perDevice) : null;
  const level: Level = worst >= 80 ? 'bad' : worst >= 50 ? 'warn' : 'ok';
  const advice =
    level === 'bad'
      ? 'Najgorszy dzień zbliżył się do darmowego limitu. Przy dalszym wzroście część zapisów będzie czekać do północy czasu USA (aplikacja działa dalej lokalnie). Czas rozważyć plan Blaze (płatność za nadwyżkę, zwykle grosze) albo własny serwer.'
      : level === 'warn'
        ? 'Zużycie jest wyraźne, ale bezpieczne. Obserwuj — jeśli liczba aktywnych urządzeń się podwoi, warto zaplanować przejście na Blaze lub inny hosting.'
        : 'Spokojnie mieścimy się w darmowym planie. Płatność nigdy nie włączy się sama — plan Spark po prostu wstrzymuje zapisy po przekroczeniu limitu dnia.';
  return { level, peakReadsPct, peakWritesPct, avgReads7, avgWrites7, readsPerDevice: perDevice, devicesCapacity, advice };
}

export const PAGES_LIMITS = { siteBytes: 1024 ** 3, monthlyBytes: 100 * 1024 ** 3 };

export interface HostingCapacity {
  level: Level;
  sitePct: number;
  /** Ile pełnych pobrań aplikacji (instalacja albo aktualizacja) mieści się w miesięcznym transferze. */
  installsPerMonth: number;
  /** Szacunek: urządzenia × aktualizacje/mies. × rozmiar. */
  estMonthlyBytes: number;
  estMonthlyPct: number;
}

export function computeHosting(h: HostingInfo, devices30: number, releasesPerMonth = 8): HostingCapacity {
  const total = Math.max(h.totalBytes, 1);
  const sitePct = Math.round((total / PAGES_LIMITS.siteBytes) * 1000) / 10;
  // przy aktualizacji pobiera się rdzeń (kod + style); grafiki tylko gdy się zmieniły
  const perRelease = Math.max(h.coreBytes, total * 0.3);
  const estMonthlyBytes = devices30 * (releasesPerMonth * perRelease + total * 0.2) + total * 10; // + ~10 nowych instalacji/odwiedzin
  const estMonthlyPct = Math.round((estMonthlyBytes / PAGES_LIMITS.monthlyBytes) * 1000) / 10;
  const level: Level = estMonthlyPct >= 70 || sitePct >= 70 ? 'bad' : estMonthlyPct >= 35 ? 'warn' : 'ok';
  return { level, sitePct, installsPerMonth: Math.floor(PAGES_LIMITS.monthlyBytes / total), estMonthlyBytes, estMonthlyPct };
}

export interface HealthSignal {
  level: Level;
  text: string;
}

/** Krótka lista sygnałów „czy coś idzie w złą stronę”. */
export function computeHealth(
  o: Overview,
  devices: DeviceRow[],
  errors: AppErrorRow[],
  help: HelpRequestRow[],
  currentVersion: string | null,
  db: DbCapacity | null,
  now = Date.now()
): HealthSignal[] {
  const out: HealthSignal[] = [];
  const err24 = errors.filter((e) => e.atMs >= now - DAY).length;
  const openHelp = help.filter((h) => h.status === 'new').length;
  if (openHelp) out.push({ level: 'warn', text: `Prośby o pomoc czekają: ${openHelp}` });
  if (err24 >= 5) out.push({ level: 'bad', text: `Dużo błędów aplikacji w ciągu doby: ${err24}` });
  else if (err24) out.push({ level: 'warn', text: `Błędy aplikacji w ciągu doby: ${err24}` });
  if (o.unsentDevices) out.push({ level: 'warn', text: `Urządzenia z niewysłanymi wynikami: ${o.unsentDevices}` });
  if (o.failedLogins7 >= 10) out.push({ level: 'warn', text: `Nieudane logowania w 7 dni: ${o.failedLogins7}` });
  if (currentVersion) {
    const old = devices.filter((d) => d.lastSeenMs >= now - 3 * DAY && d.appVersion && d.appVersion !== currentVersion).length;
    if (old) out.push({ level: 'ok', text: `Urządzenia jeszcze na starszej wersji (zaktualizują się same): ${old}` });
  }
  if (db && db.level !== 'ok') out.push({ level: db.level, text: `Baza: najgorszy dzień ${Math.max(db.peakReadsPct, db.peakWritesPct)}% darmowego limitu` });
  if (o.active7 === 0 && o.accounts > 0) out.push({ level: 'warn', text: 'Nikt nie grał od tygodnia' });
  if (!out.some((s) => s.level !== 'ok')) out.unshift({ level: 'ok', text: 'Wszystko działa — brak niepokojących sygnałów' });
  return out;
}

export function fmtBytes(b: number): string {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(b / 1024)} KB`;
}

export function fmtAgo(ms: number, now = Date.now()): string {
  if (!ms) return '—';
  const d = now - ms;
  if (d < 60_000) return 'przed chwilą';
  if (d < 3600_000) return `${Math.round(d / 60_000)} min temu`;
  if (d < DAY) return `${Math.round(d / 3600_000)} godz. temu`;
  const days = Math.round(d / DAY);
  return days === 1 ? 'wczoraj' : `${days} dni temu`;
}
