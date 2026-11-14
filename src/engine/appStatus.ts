/**
 * Komunikat od administratora dla wszystkich graczy (dokument config/status w bazie):
 *  • mode 'off'         — nic,
 *  • mode 'banner'      — pasek z informacją (np. „W sobotę wieczorem krótka przerwa”),
 *  • mode 'maintenance' — plansza „Przerwa techniczna” (można grać dalej bez synchronizacji).
 * Odczyt: przy starcie i przy powrocie do aplikacji, najwyżej co 15 minut (co 2 min w trakcie przerwy).
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import { type Firestore, doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-accounts-config.json';

export type AppStatusMode = 'off' | 'banner' | 'maintenance';
export interface AppStatus {
  mode: AppStatusMode;
  message: string;
  untilMs: number;
}

const CACHE_KEY = 'mt_app_status';
const OFF: AppStatus = { mode: 'off', message: '', untilMs: 0 };

let db: Firestore | null = null;
function statusDb(): Firestore {
  if (db) return db;
  const name = 'telemetry';
  const app = getApps().some((a) => a.name === name) ? getApp(name) : initializeApp(firebaseConfig, name);
  db = getFirestore(app);
  return db;
}

function normalize(raw: Partial<AppStatus> | undefined): AppStatus {
  const mode = raw?.mode === 'banner' || raw?.mode === 'maintenance' ? raw.mode : 'off';
  const untilMs = Number(raw?.untilMs ?? 0) || 0;
  // Komunikat z minioną datą końca wygasa sam — nie trzeba pamiętać o wyłączeniu.
  if (mode !== 'off' && untilMs > 0 && untilMs < Date.now()) return OFF;
  return { mode, message: String(raw?.message ?? '').slice(0, 300), untilMs };
}

export function cachedAppStatus(): AppStatus {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? normalize(JSON.parse(raw) as AppStatus) : OFF;
  } catch {
    return OFF;
  }
}

let lastFetch = 0;

export async function fetchAppStatus(force = false): Promise<AppStatus | null> {
  const cached = cachedAppStatus();
  const gap = cached.mode === 'maintenance' ? 2 * 60_000 : 15 * 60_000;
  if (!force && Date.now() - lastFetch < gap) return null;
  if (!navigator.onLine) return null;
  lastFetch = Date.now();
  try {
    const snap = await Promise.race([
      getDoc(doc(statusDb(), 'config', 'status')),
      new Promise<never>((_, rej) => window.setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    const st = normalize(snap.exists() ? (snap.data() as AppStatus) : undefined);
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(st));
    } catch {
      // ignore
    }
    return st;
  } catch {
    return null; // baza niedostępna — zostaje ostatni znany stan
  }
}

/** Zapis z panelu administratora (reguły pozwalają tylko administratorowi). */
export async function saveAppStatus(adminDb: Firestore, st: AppStatus): Promise<void> {
  await setDoc(doc(adminDb, 'config', 'status'), {
    mode: st.mode,
    message: st.message.trim().slice(0, 300),
    untilMs: st.untilMs,
    updatedAt: serverTimestamp(),
  });
}
