/**
 * Panel administratora (rodzica): podgląd kont, dziennik logowań i reset haseł.
 *
 * Administrator loguje się kontem Google, które jest właścicielem projektu Firebase.
 * Reset hasła odbywa się przez oficjalne API Firebase Authentication (Identity Toolkit),
 * autoryzowane tokenem Google właściciela — bez serwera i bez opłat.
 * Uprawnienia do odczytu danych daje dokument admins/{uid} w bazie.
 */
import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  GoogleAuthProvider,
  getAuth,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  type Firestore,
  type Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-accounts-config.json';
import { protectApp } from './appCheck';
import type { SessionRecord, UserProfile } from '../types/math';
import { type AppStatus, saveAppStatus } from './appStatus';
import { hashAccountPassword } from './accountSecurity';
import { secretFromHash } from './accountCloud';

const ADMIN_FLAG = 'mt_admin_device';

interface AdminHandle {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let handle: AdminHandle | null = null;
let accessToken: string | null = null;
let accessTokenAt = 0;
// Token Google (reset haseł, zużycie bazy) trzymamy w tej karcie, żeby odświeżenie strony go nie gubiło.
const TOKEN_KEY = 'mt_admin_gtoken';
try {
  const raw = JSON.parse(window.sessionStorage.getItem(TOKEN_KEY) ?? 'null');
  if (raw && typeof raw.t === 'string' && Date.now() - Number(raw.at) < 50 * 60_000) {
    accessToken = raw.t;
    accessTokenAt = Number(raw.at);
  }
} catch {
  // brak sessionStorage
}
function saveToken(token: string | null): void {
  accessToken = token;
  accessTokenAt = token ? Date.now() : 0;
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ t: token, at: accessTokenAt }));
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** Samo logowanie do panelu: tylko e-mail i profil, więc Google nie pokazuje ostrzeżenia „niezweryfikowana aplikacja”. */
function signInProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/**
 * Poufne uprawnienia (reset haseł, odczyt zużycia bazy) prosimy osobno, dopiero gdy są potrzebne.
 * Przy pierwszej zgodzie Google pokaże ostrzeżenie o niezweryfikowanej aplikacji — potem już nie.
 */
function scopedProvider(email?: string): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/identitytoolkit');
  provider.addScope('https://www.googleapis.com/auth/monitoring.read');
  // Znane konto: Google pomija wybór konta i zgody — okienko mignie i samo się zamknie.
  provider.setCustomParameters(email ? { login_hint: email } : { prompt: 'select_account' });
  return provider;
}

/**
 * Zapewnia ważny token Google z uprawnieniami do resetu haseł i zużycia bazy. Gdy go brak albo wygasł
 * (po ok. godzinie), pobiera go: krótkie okienko Google otwiera się i zamyka bez klikania.
 * Wywoływać z kliknięcia (przeglądarka pozwala wtedy na okienko).
 */
export async function ensureAdminToken(): Promise<void> {
  if (hasFreshAdminToken()) return;
  const { auth } = getAdminHandle();
  const user = auth.currentUser;
  if (!user) throw new Error('Zaloguj się do panelu przez Google.');
  const result = await reauthenticateWithPopup(user, scopedProvider(user.email ?? undefined));
  const cred = GoogleAuthProvider.credentialFromResult(result);
  if (!cred?.accessToken) throw new Error('Google nie zwrócił tokenu — spróbuj jeszcze raz.');
  saveToken(cred.accessToken);
}

function getAdminHandle(): AdminHandle {
  if (handle) return handle;
  const name = 'admin-panel';
  const app = getApps().some((a) => a.name === name) ? getApp(name) : initializeApp(firebaseConfig, name);
  protectApp(app);
  handle = { app, auth: getAuth(app), db: getFirestore(app) };
  return handle;
}

export interface AdminSession {
  uid: string;
  email: string;
  isAdmin: boolean;
}

export function isAdminDevice(): boolean {
  try {
    return window.localStorage.getItem(ADMIN_FLAG) === '1';
  } catch {
    return false;
  }
}

async function checkAdmin(uid: string): Promise<boolean> {
  const { db } = getAdminHandle();
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

/** Sesja z poprzedniego razu (bez tokenu do resetu haseł — ten trzeba odświeżyć logowaniem). */
export async function restoreAdminSession(): Promise<AdminSession | null> {
  const { auth } = getAdminHandle();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  const isAdmin = await checkAdmin(user.uid);
  return { uid: user.uid, email: user.email ?? '', isAdmin };
}

export async function adminSignIn(): Promise<AdminSession> {
  const { auth } = getAdminHandle();
  const result = await signInWithPopup(auth, signInProvider());
  // Token z samego logowania nie ma poufnych uprawnień — ten pobiera ensureAdminToken().
  saveToken(null);
  const isAdmin = await checkAdmin(result.user.uid);
  if (isAdmin) {
    try {
      window.localStorage.setItem(ADMIN_FLAG, '1');
    } catch {
      // ignore
    }
  }
  return { uid: result.user.uid, email: result.user.email ?? '', isAdmin };
}

export async function adminSignOut(): Promise<void> {
  saveToken(null);
  await signOut(getAdminHandle().auth).catch(() => {});
}

/** Token Google z poufnymi uprawnieniami (reset haseł, zużycie bazy) jest ważny ok. godzinę. */
export function hasFreshAdminToken(): boolean {
  return Boolean(accessToken) && Date.now() - accessTokenAt < 50 * 60_000;
}

export interface AdminAccountRow {
  login: string;
  uid: string;
  profileId: string;
  name: string;
  xp: number;
  sessions: number;
  lastActiveDate: string;
  updatedAtMs: number;
  groups: string[];
  /** Ostatnie serie zapisane w chmurze (bez szczegółów zadań). */
  recent: AdminSessionLite[];
}

export interface AdminSessionLite {
  t: number;
  kind: 'stage' | 'tournament' | 'master' | 'free';
  mode: string;
  tasks: number;
  correct: number;
  avgMs: number;
}

function liteSession(s: SessionRecord): AdminSessionLite {
  const kind = s.masterLevel ? 'master' : s.tournamentId ? 'tournament' : s.stageId ? 'stage' : 'free';
  return {
    t: Number(s.timestamp) || 0,
    kind,
    mode: String(s.mode ?? ''),
    tasks: Number(s.totalTasks) || 0,
    correct: Number(s.correctTasks) || 0,
    avgMs: Number(s.avgTimeMs) || 0,
  };
}

export async function listAccounts(): Promise<AdminAccountRow[]> {
  const { db } = getAdminHandle();
  const [loginsSnap, accountsSnap] = await Promise.all([
    getDocs(collection(db, 'logins')),
    getDocs(collection(db, 'accounts')),
  ]);
  const accounts = new Map<string, { profile?: UserProfile; updatedAt?: Timestamp }>();
  accountsSnap.forEach((d) => accounts.set(d.id, d.data() as { profile?: UserProfile; updatedAt?: Timestamp }));
  const rows: AdminAccountRow[] = [];
  loginsSnap.forEach((d) => {
    const data = d.data() as { uid?: string; profileId?: string };
    const uid = String(data.uid ?? '');
    const acc = accounts.get(uid);
    const p = acc?.profile;
    rows.push({
      login: d.id,
      uid,
      profileId: String(data.profileId ?? ''),
      name: p?.name ?? d.id,
      xp: Number(p?.xp ?? 0),
      sessions: Array.isArray(p?.sessions) ? p!.sessions.length : 0,
      lastActiveDate: String(p?.lastActiveDate ?? ''),
      updatedAtMs: acc?.updatedAt?.toMillis?.() ?? 0,
      groups: (p?.circles ?? []).map((c) => `${c.name} (${c.code})`),
      recent: Array.isArray(p?.sessions) ? p!.sessions.map(liteSession) : [],
    });
  });
  return rows.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export interface LoginEventRow {
  id: string;
  login: string;
  ok: boolean;
  reason: string;
  device: string;
  atMs: number;
}

export async function listLoginEvents(max = 100): Promise<LoginEventRow[]> {
  const { db } = getAdminHandle();
  const snap = await getDocs(query(collection(db, 'loginEvents'), orderBy('at', 'desc'), limit(max)));
  return snap.docs.map((d) => {
    const data = d.data() as { login?: string; ok?: boolean; reason?: string; device?: string; at?: Timestamp };
    return {
      id: d.id,
      login: String(data.login ?? ''),
      ok: Boolean(data.ok),
      reason: String(data.reason ?? ''),
      device: String(data.device ?? ''),
      atMs: data.at?.toMillis?.() ?? 0,
    };
  });
}

export async function clearLoginEvents(ids: string[]): Promise<void> {
  const { db } = getAdminHandle();
  await Promise.all(ids.map((id) => deleteDoc(doc(db, 'loginEvents', id)).catch(() => {})));
}

/**
 * Ustawia nowe hasło konta. Dziecko loguje się potem nowym hasłem na dowolnym urządzeniu;
 * na urządzeniach, gdzie było zalogowane, poproszone zostanie o nowe hasło.
 */
export async function adminResetPassword(row: AdminAccountRow, newPassword: string): Promise<void> {
  const pwd = newPassword.trim();
  if (pwd.length < 4) throw new Error('Nowe hasło lub PIN musi mieć co najmniej 4 znaki.');
  if (!row.uid || !row.profileId) throw new Error('Brak danych konta.');
  await ensureAdminToken();
  const secret = secretFromHash(hashAccountPassword(pwd, row.profileId));
  const projectId = firebaseConfig.projectId;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Goog-User-Project': projectId,
      },
      body: JSON.stringify({ localId: row.uid, password: secret }),
    }
  );
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body.error?.message ?? '';
    } catch {
      // ignore
    }
    if (res.status === 401) {
      saveToken(null);
      throw new Error('Sesja Google wygasła — zaloguj się ponownie i powtórz.');
    }
    if (res.status === 403) {
      throw new Error(`Konto Google nie ma uprawnień do projektu (${detail || 'brak dostępu'}).`);
    }
    throw new Error(`Nie udało się zmienić hasła (${detail || res.status}).`);
  }
}

/* ───────────── Telemetria: urządzenia, błędy, prośby o pomoc ───────────── */

function ms(v: unknown): number {
  const t = v as Timestamp | undefined;
  return t?.toMillis?.() ?? 0;
}

export interface DeviceRow {
  id: string;
  platform: string;
  browser: string;
  installed: boolean;
  appVersion: string;
  logins: string[];
  unsent: boolean;
  dbPaused: boolean;
  firstSeenMs: number;
  lastSeenMs: number;
}

export async function listDevices(): Promise<DeviceRow[]> {
  const { db } = getAdminHandle();
  const snap = await getDocs(collection(db, 'devices'));
  return snap.docs
    .map((d) => {
      const x = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        platform: String(x.platform ?? ''),
        browser: String(x.browser ?? ''),
        installed: Boolean(x.installed),
        appVersion: String(x.appVersion ?? ''),
        logins: Array.isArray(x.logins) ? (x.logins as string[]) : [],
        unsent: Boolean(x.unsent),
        dbPaused: Boolean(x.dbPaused),
        firstSeenMs: Number(x.firstSeenMs) || 0,
        lastSeenMs: ms(x.lastSeen),
      };
    })
    .sort((a, b) => b.lastSeenMs - a.lastSeenMs);
}

export interface AppErrorRow {
  id: string;
  message: string;
  stack: string;
  appVersion: string;
  platform: string;
  device: string;
  atMs: number;
}

export async function listAppErrors(max = 100): Promise<AppErrorRow[]> {
  const { db } = getAdminHandle();
  const snap = await getDocs(query(collection(db, 'appErrors'), orderBy('at', 'desc'), limit(max)));
  return snap.docs.map((d) => {
    const x = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      message: String(x.message ?? ''),
      stack: String(x.stack ?? ''),
      appVersion: String(x.appVersion ?? ''),
      platform: String(x.platform ?? ''),
      device: String(x.device ?? ''),
      atMs: ms(x.at),
    };
  });
}

export interface HelpRequestRow {
  id: string;
  login: string;
  topic: string;
  message: string;
  contact: string;
  platform: string;
  status: 'new' | 'done';
  atMs: number;
}

export async function listHelpRequests(max = 100): Promise<HelpRequestRow[]> {
  const { db } = getAdminHandle();
  const snap = await getDocs(query(collection(db, 'helpRequests'), orderBy('at', 'desc'), limit(max)));
  return snap.docs.map((d) => {
    const x = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      login: String(x.login ?? ''),
      topic: String(x.topic ?? ''),
      message: String(x.message ?? ''),
      contact: String(x.contact ?? ''),
      platform: String(x.platform ?? ''),
      status: x.status === 'done' ? 'done' : 'new',
      atMs: ms(x.at),
    };
  });
}

export async function setHelpRequestDone(id: string): Promise<void> {
  await updateDoc(doc(getAdminHandle().db, 'helpRequests', id), { status: 'done' });
}

export async function deleteAdminDocs(col: 'appErrors' | 'helpRequests' | 'devices', ids: string[]): Promise<void> {
  const { db } = getAdminHandle();
  await Promise.all(ids.map((id) => deleteDoc(doc(db, col, id)).catch(() => {})));
}

/* ───────────── Komunikat dla wszystkich / przerwa techniczna ───────────── */

export async function readAppStatusAdmin(): Promise<AppStatus> {
  const snap = await getDoc(doc(getAdminHandle().db, 'config', 'status'));
  const x = (snap.exists() ? snap.data() : {}) as Partial<AppStatus>;
  return {
    mode: x.mode === 'banner' || x.mode === 'maintenance' ? x.mode : 'off',
    message: String(x.message ?? ''),
    untilMs: Number(x.untilMs ?? 0) || 0,
  };
}

export async function writeAppStatusAdmin(st: AppStatus): Promise<void> {
  await saveAppStatus(getAdminHandle().db, st);
}

/* ───────────── Zużycie bazy (Cloud Monitoring) ───────────── */

export interface DbUsageDay {
  day: string; // RRRR-MM-DD (czas pacyficzny — wtedy Firebase zeruje dzienne limity)
  reads: number;
  writes: number;
  deletes: number;
}

export const SPARK_LIMITS = { reads: 50_000, writes: 20_000, deletes: 20_000, storageBytes: 1024 ** 3 };

/**
 * Dzienne operacje na bazie z ostatnich 14 dni. Wymaga zalogowania Google w tej sesji
 * (uprawnienie „monitoring.read” daje bycie właścicielem projektu).
 */
export async function fetchDbUsage(): Promise<DbUsageDay[]> {
  if (!hasFreshAdminToken()) throw new Error('Zaloguj się przez Google w tej sesji, aby zobaczyć zużycie bazy.');
  const projectId = firebaseConfig.projectId;
  const end = new Date();
  const start = new Date(end.getTime() - 14 * 24 * 3600_000);
  const metrics: [keyof Omit<DbUsageDay, 'day'>, string][] = [
    ['reads', 'firestore.googleapis.com/document/read_ops_count'],
    ['writes', 'firestore.googleapis.com/document/write_ops_count'],
    ['deletes', 'firestore.googleapis.com/document/delete_ops_count'],
  ];
  const days = new Map<string, DbUsageDay>();
  const dayKey = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  await Promise.all(
    metrics.map(async ([key, type]) => {
      const params = new URLSearchParams({
        filter: `metric.type = "${type}"`,
        'interval.startTime': start.toISOString(),
        'interval.endTime': end.toISOString(),
        'aggregation.alignmentPeriod': '3600s',
        'aggregation.perSeriesAligner': 'ALIGN_SUM',
        'aggregation.crossSeriesReducer': 'REDUCE_SUM',
      });
      const res = await fetch(
        `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}`, 'X-Goog-User-Project': projectId } }
      );
      if (res.status === 401 || res.status === 403) {
        throw new Error('Brak dostępu do statystyk Google Cloud — zaloguj się ponownie przez Google i zezwól na „odczyt monitoringu”.');
      }
      if (!res.ok) throw new Error(`Monitoring odpowiedział błędem ${res.status}.`);
      const body = (await res.json()) as {
        timeSeries?: { points?: { interval: { endTime: string }; value: { int64Value?: string } }[] }[];
      };
      for (const ts of body.timeSeries ?? []) {
        for (const p of ts.points ?? []) {
          const k = dayKey(p.interval.endTime);
          const row = days.get(k) ?? { day: k, reads: 0, writes: 0, deletes: 0 };
          row[key] += Number(p.value.int64Value ?? 0);
          days.set(k, row);
        }
      }
    })
  );
  return Array.from(days.values()).sort((a, b) => a.day.localeCompare(b.day));
}

/* ───────────── Hosting (GitHub Pages) ───────────── */

export interface HostingInfo {
  appVersion: string;
  coreBytes: number;
  totalBytes: number;
}

export async function fetchHostingInfo(): Promise<HostingInfo | null> {
  try {
    const res = await fetch(`./precache.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const m = (await res.json()) as Partial<HostingInfo>;
    return { appVersion: String(m.appVersion ?? '?'), coreBytes: Number(m.coreBytes) || 0, totalBytes: Number(m.totalBytes) || 0 };
  } catch {
    return null;
  }
}

/* ------------------------------ Uczciwa gra: weryfikacja kont ------------------------------ */

export interface ReviewRow {
  uid: string;
  login: string;
  state: 'watch' | 'pending' | 'suspended' | 'cleared';
  trusted: boolean;
  events: { k: string; at: number; d: string }[];
  device: string;
  note: string;
  updatedAtMs: number;
}

export async function listReviews(): Promise<ReviewRow[]> {
  const { db } = getAdminHandle();
  const snap = await getDocs(collection(db, 'reviews'));
  return snap.docs
    .map((d) => {
      const x = d.data() as Record<string, unknown>;
      const st = String(x.state ?? 'watch');
      return {
        uid: d.id,
        login: String(x.login ?? ''),
        state: (['watch', 'pending', 'suspended', 'cleared'].includes(st) ? st : 'watch') as ReviewRow['state'],
        trusted: x.trusted === true,
        events: Array.isArray(x.events) ? (x.events as ReviewRow['events']) : [],
        device: String(x.device ?? ''),
        note: String(x.note ?? ''),
        updatedAtMs: ms(x.updatedAt),
      };
    })
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

/** Decyzja opiekuna: zwolnij (OK), zaufaj na stałe, zablokuj. */
export async function decideReview(
  uid: string,
  decision: 'cleared' | 'trusted' | 'suspended',
  note = ''
): Promise<void> {
  const { db } = getAdminHandle();
  const ref = doc(db, 'reviews', uid);
  const payload = {
    state: decision === 'suspended' ? 'suspended' : 'cleared',
    trusted: decision === 'trusted',
    note: note.slice(0, 200),
    decidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    // Blokada z wyniku skanu serwera — konto nie miało jeszcze wpisu.
    await setDoc(ref, { uid, login: '', events: [], device: '', createdAt: serverTimestamp(), ...payload });
  }
}

/* ------------------------------ Kopia zapasowa ------------------------------ */

const TOP_COLLECTIONS = [
  'logins',
  'accounts',
  'reviews',
  'circles',
  'circleCodes',
  'devices',
  'loginEvents',
  'appErrors',
  'helpRequests',
  'config',
] as const;

function plain(v: unknown): unknown {
  if (v && typeof v === 'object') {
    if (typeof (v as Timestamp).toMillis === 'function') return { __time: (v as Timestamp).toMillis() };
    if (Array.isArray(v)) return v.map(plain);
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

export interface BackupFile {
  kind: 'mistrz-tabliczki-backup';
  createdAt: string;
  appVersion: string;
  counts: Record<string, number>;
  data: Record<string, Record<string, unknown>>;
}

/**
 * Pełna kopia bazy (bez haseł — w bazie są tylko ich skróty w profilach na urządzeniach, nie w chmurze).
 * Zbiera kolekcje główne oraz podkolekcje: historię serii kont i członków/karty grup.
 */
export async function exportDatabase(onProgress?: (msg: string) => void): Promise<BackupFile> {
  const { db } = getAdminHandle();
  const data: Record<string, Record<string, unknown>> = {};
  const counts: Record<string, number> = {};
  const put = (path: string, id: string, value: unknown) => {
    (data[path] ??= {})[id] = plain(value);
    counts[path] = (counts[path] ?? 0) + 1;
  };
  for (const name of TOP_COLLECTIONS) {
    onProgress?.(`Pobieram: ${name}…`);
    const snap = await getDocs(collection(db, name)).catch(() => null);
    snap?.forEach((d) => put(name, d.id, d.data()));
  }
  const accountIds = Object.keys(data.accounts ?? {});
  for (const [i, uid] of accountIds.entries()) {
    onProgress?.(`Historia serii: konto ${i + 1} z ${accountIds.length}…`);
    const snap = await getDocs(collection(db, 'accounts', uid, 'history')).catch(() => null);
    snap?.forEach((d) => put('accounts/*/history', `${uid}/${d.id}`, d.data()));
  }
  for (const circleId of Object.keys(data.circles ?? {})) {
    onProgress?.(`Grupa ${circleId}…`);
    for (const sub of ['members', 'players'] as const) {
      const snap = await getDocs(collection(db, 'circles', circleId, sub)).catch(() => null);
      snap?.forEach((d) => put(`circles/*/${sub}`, `${circleId}/${d.id}`, d.data()));
    }
  }
  return {
    kind: 'mistrz-tabliczki-backup',
    createdAt: new Date().toISOString(),
    appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '',
    counts,
    data,
  };
}

/** Pobranie kopii jako plik JSON na urządzenie administratora. */
export function downloadBackup(file: BackupFile): void {
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mistrz-tabliczki-kopia-${file.createdAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const BACKUP_KEY = 'mt_admin_last_backup';
export function lastBackupAt(): number {
  try {
    return Number(window.localStorage.getItem(BACKUP_KEY)) || 0;
  } catch {
    return 0;
  }
}
export function noteBackupDone(): void {
  try {
    window.localStorage.setItem(BACKUP_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}
