/**
 * Pamięć synchronizacji na urządzeniu — oszczędza darmowy limit bazy, niczego nie zmieniając dla gracza.
 *
 *  * „Odcisk” ostatnio wysłanego konta i kart w grupach: po ponownym uruchomieniu aplikacji
 *    (otwarcie, odświeżenie, nowa wersja) nie wysyłamy tego samego jeszcze raz.
 *  * Znaczniki „sprawdzone niedawno” dla rzadkich odczytów (członkostwo w grupach, weryfikacja konta,
 *    komunikat dla graczy) — nie powtarzamy ich przy każdym uruchomieniu.
 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const FP_KEY = 'mt_sync_fp';
const CHECK_KEY = 'mt_sync_checked';

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readJson<T extends object>(storage: KeyValueStorage | null, key: string): T {
  if (!storage) return {} as T;
  try {
    const raw = JSON.parse(storage.getItem(key) ?? '{}');
    return raw && typeof raw === 'object' ? (raw as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

function writeJson(storage: KeyValueStorage | null, key: string, value: object): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // pełna pamięć / tryb prywatny — najwyżej wyślemy coś jeszcze raz
  }
}

export type FpKind = 'acc' | 'card';
type FpMap = Record<string, Partial<Record<FpKind, string>>>;

/** Odciski wysłanych danych zapisane na urządzeniu: profileId → odcisk. */
export function loadPushedFps(kind: FpKind, storage = defaultStorage()): Map<string, string> {
  const all = readJson<FpMap>(storage, FP_KEY);
  const out = new Map<string, string>();
  for (const [pid, v] of Object.entries(all)) {
    const fp = v?.[kind];
    if (typeof fp === 'string') out.set(pid, fp);
  }
  return out;
}

/** Zapamiętuje odcisk po udanym wysłaniu (albo go zapomina, gdy fp = null). */
export function savePushedFp(kind: FpKind, profileId: string, fp: string | null, storage = defaultStorage()): void {
  const all = readJson<FpMap>(storage, FP_KEY);
  const entry = { ...(all[profileId] ?? {}) };
  if (fp === null) delete entry[kind];
  else entry[kind] = fp;
  if (Object.keys(entry).length === 0) delete all[profileId];
  else all[profileId] = entry;
  writeJson(storage, FP_KEY, all);
}

/** Ile ms minęło od ostatniego sprawdzenia (Infinity = nigdy). */
export function sinceChecked(key: string, now = Date.now(), storage = defaultStorage()): number {
  const at = Number(readJson<Record<string, number>>(storage, CHECK_KEY)[key]);
  return Number.isFinite(at) && at > 0 && at <= now ? now - at : Infinity;
}

export function checkedRecently(key: string, maxAgeMs: number, now = Date.now(), storage = defaultStorage()): boolean {
  return sinceChecked(key, now, storage) < maxAgeMs;
}

export function markChecked(key: string, now = Date.now(), storage = defaultStorage()): void {
  const all = readJson<Record<string, number>>(storage, CHECK_KEY);
  all[key] = now;
  // Porządek: wpisy starsze niż 30 dni nie są już potrzebne.
  for (const [k, at] of Object.entries(all)) if (now - Number(at) > 30 * 86_400_000) delete all[k];
  writeJson(storage, CHECK_KEY, all);
}

export function forgetChecked(key: string, storage = defaultStorage()): void {
  const all = readJson<Record<string, number>>(storage, CHECK_KEY);
  delete all[key];
  writeJson(storage, CHECK_KEY, all);
}
