/**
 * Lekka telemetria dla panelu administratora — bez danych osobowych poza loginami gracza:
 *  • urządzenie (raz na 12 h): platforma, czy zainstalowane jako aplikacja, wersja, loginy kont, stan wysyłki,
 *  • błędy aplikacji (max 3 na dobę z jednego urządzenia),
 *  • prośby o pomoc wysłane z aplikacji.
 * Każdy zapis to pojedynczy dokument — znikomy wpływ na darmowy limit bazy.
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import { type Firestore, addDoc, collection, doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-accounts-config.json';
import { protectApp } from './appCheck';
import { isStandalone } from '../pwa';

const DEVICE_KEY = 'mt_device_id';
const BEAT_KEY = 'mt_device_beat';
const FIRST_KEY = 'mt_device_first';
const ERR_KEY = 'mt_err_log';

let db: Firestore | null = null;
function telemetryDb(): Firestore {
  if (db) return db;
  const name = 'telemetry';
  const app = getApps().some((a) => a.name === name) ? getApp(name) : initializeApp(firebaseConfig, name);
  protectApp(app);
  db = getFirestore(app);
  return db;
}

function ls(key: string, value?: string): string | null {
  try {
    if (value !== undefined) window.localStorage.setItem(key, value);
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function deviceId(): string {
  let id = ls(DEVICE_KEY);
  if (!id) {
    id = `d-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    ls(DEVICE_KEY, id);
    ls(FIRST_KEY, String(Date.now()));
  }
  return id;
}

export function devicePlatform(): string {
  const ua = navigator.userAgent;
  const iPadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPad/.test(ua) || iPadOs) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android telefon' : 'Android tablet';
  if (/Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Linux/.test(ua)) return 'Linux';
  return 'inne';
}

function browserName(): string {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|Instagram|Messenger/.test(ua)) return 'w aplikacji FB/IG';
  if (/EdgA?\//.test(ua)) return 'Edge';
  if (/SamsungBrowser/.test(ua)) return 'Samsung';
  if (/CriOS|Chrome\//.test(ua)) return 'Chrome';
  if (/FxiOS|Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'inna';
}

export interface DeviceBeatInput {
  logins: string[];
  unsent: boolean;
  dbPaused: boolean;
}

/** Zgłoszenie urządzenia — najwyżej raz na 12 godzin (albo gdy zmieni się lista kont / wersja). */
export function deviceHeartbeat(input: DeviceBeatInput): void {
  try {
    if (!navigator.onLine) return;
    const logins = Array.from(new Set(input.logins.filter(Boolean))).sort().slice(0, 8);
    const sig = `${__APP_VERSION__}|${logins.join(',')}|${isStandalone() ? 1 : 0}`;
    const last = (ls(BEAT_KEY) ?? '').split('#');
    const lastAt = Number(last[0]) || 0;
    if (Date.now() - lastAt < 12 * 3600_000 && last[1] === sig) return;
    ls(BEAT_KEY, `${Date.now()}#${sig}`);
    const id = deviceId();
    void setDoc(
      doc(telemetryDb(), 'devices', id),
      {
        platform: devicePlatform(),
        browser: browserName(),
        installed: isStandalone(),
        appVersion: String(__APP_VERSION__).slice(0, 20),
        logins,
        unsent: input.unsent,
        dbPaused: input.dbPaused,
        firstSeenMs: Number(ls(FIRST_KEY)) || Date.now(),
        lastSeen: serverTimestamp(),
      },
      { merge: false }
    ).catch(() => {
      ls(BEAT_KEY, '0#'); // spróbujemy przy następnym uruchomieniu
    });
  } catch {
    // telemetria nigdy nie może przeszkadzać w grze
  }
}

/** Zgłoszenie błędu aplikacji (max 3 różne na dobę z urządzenia). */
export function reportAppError(message: string, stack?: string): void {
  try {
    if (!navigator.onLine || !message) return;
    const today = new Date().toISOString().slice(0, 10);
    const raw = ls(ERR_KEY) ?? '';
    const [day, ...seen] = raw.split('|');
    const list = day === today ? seen : [];
    const key = message.slice(0, 60);
    if (list.length >= 3 || list.includes(key)) return;
    ls(ERR_KEY, [today, ...list, key].join('|'));
    void addDoc(collection(telemetryDb(), 'appErrors'), {
      message: message.slice(0, 300),
      stack: (stack ?? '').slice(0, 900),
      appVersion: String(__APP_VERSION__).slice(0, 20),
      platform: devicePlatform(),
      device: deviceId().slice(0, 40),
      at: serverTimestamp(),
    }).catch(() => {});
  } catch {
    // ignore
  }
}

/** Nasłuch nieobsłużonych błędów — zgłasza je do panelu administratora. */
export function installErrorReporting(): void {
  window.addEventListener('error', (e) => {
    // pomijamy błędy wczytywania obrazków/skryptów z zewnątrz i rozszerzeń przeglądarki
    if (!e.message || /ResizeObserver|Script error|extension:\/\//i.test(e.message)) return;
    // Błędy wstrzyknięte przez wbudowane przeglądarki aplikacji (Messenger, Facebook, Instagram: „iabjs://”,
    // „Java object is gone”) — nie pochodzą z naszego kodu.
    const stack = e.error instanceof Error ? e.error.stack ?? '' : `${e.filename}`;
    if (/iabjs:\/\/|Java object is gone|webkit-masked-url|chrome-extension|moz-extension/i.test(`${e.message} ${stack}`)) return;
    // Plik ze starej wersji po wydaniu: aplikacja sama się przeładowuje (lazyWithReload) — to nie awaria.
    if (/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(e.message)) return;
    reportAppError(e.message, e.error instanceof Error ? e.error.stack : `${e.filename}:${e.lineno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; code?: string; stack?: string } | undefined;
    const msg = r?.message ?? String(r ?? '');
    // błędy sieci/bazy są obsługiwane w aplikacji (ponawianie) — nie zaśmiecamy nimi listy
    if (!msg || /network|offline|unavailable|quota|resource-exhausted|Failed to fetch|permission/i.test(`${msg} ${r?.code ?? ''}`)) return;
    reportAppError(`Promise: ${msg}`, r?.stack);
  });
}

export interface HelpRequestInput {
  login: string;
  topic: 'password' | 'login' | 'sync' | 'other';
  message: string;
  contact?: string;
}

/** Prośba o pomoc do rodzica / administratora. */
export async function sendHelpRequest(input: HelpRequestInput): Promise<void> {
  await addDoc(collection(telemetryDb(), 'helpRequests'), {
    login: input.login.trim().toLowerCase().slice(0, 40),
    topic: input.topic,
    message: input.message.trim().slice(0, 500),
    contact: (input.contact ?? '').trim().slice(0, 80),
    platform: devicePlatform(),
    device: deviceId().slice(0, 40),
    status: 'new',
    at: serverTimestamp(),
  });
}
