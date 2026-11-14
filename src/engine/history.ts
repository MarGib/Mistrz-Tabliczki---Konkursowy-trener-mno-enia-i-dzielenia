/**
 * Pełna historia serii.
 *
 * Profil trzyma tylko ostatnie serie ze szczegółami zadań (do powtórek i wykresów „na teraz”).
 * Tutaj zbieramy KRÓTKIE podsumowania wszystkich serii:
 *  • na urządzeniu: localStorage `mt_hist_<profil>` (działa offline),
 *  • w chmurze: accounts/{uid}/history/{RRRR-MM} — jeden dokument na miesiąc,
 *    wysyłany paczkami (patrz: shouldFlushHistory), żeby oszczędzać darmowy limit zapisów.
 */
import type { SessionRecord } from '../types/math';

export interface SessionLite {
  id: string;
  /** Czas zakończenia (ms). */
  t: number;
  title: string;
  mode: string;
  kind: 'lesson' | 'stage' | 'tournament' | 'master' | 'free' | 'review';
  tasks: number;
  correct: number;
  avgMs: number;
  pts: number;
  passed: boolean;
  /** Identyfikator kropki / etapu / turnieju. */
  ref?: string;
  range?: number;
  /** Poziom Wyzwania Mistrza. */
  lvl?: number;
}

export function toLite(s: SessionRecord): SessionLite {
  const kind: SessionLite['kind'] = s.lessonId
    ? 'lesson'
    : s.masterLevel
    ? 'master'
    : s.tournamentId
    ? 'tournament'
    : s.stageId
    ? 'stage'
    : s.free
    ? 'free'
    : 'review';
  const lite: SessionLite = {
    id: String(s.id),
    t: Number(s.timestamp) || 0,
    title: String(s.seriesTitle ?? '').slice(0, 80),
    mode: String(s.mode ?? ''),
    kind,
    tasks: Number(s.totalTasks) || 0,
    correct: Number(s.correctTasks) || 0,
    avgMs: Math.round(Number(s.avgTimeMs) || 0),
    pts: Number(s.pointsEarned) || 0,
    passed: Boolean(s.passedThreshold),
  };
  const ref = s.lessonId ?? s.stageId ?? s.tournamentId;
  if (ref) lite.ref = String(ref).slice(0, 40);
  if (s.maxRange) lite.range = Number(s.maxRange);
  if (s.masterLevel) lite.lvl = Number(s.masterLevel);
  return lite;
}

/** Na potrzeby wykresów: skrót serii udający zwykłą serię (bez zadań). */
export function liteToRecord(l: SessionLite): SessionRecord {
  return {
    id: l.id,
    timestamp: l.t,
    mode: (l.mode || 'mixed') as SessionRecord['mode'],
    seriesTitle: l.title,
    totalTasks: l.tasks,
    correctTasks: l.correct,
    accuracyPct: l.tasks > 0 ? Math.round((l.correct / l.tasks) * 100) : 0,
    totalTimeMs: l.avgMs * l.tasks,
    avgTimeMs: l.avgMs,
    pointsEarned: l.pts,
    passedThreshold: l.passed,
    maxRange: l.range,
    masterLevel: l.lvl,
    stageId: l.kind === 'stage' ? l.ref : undefined,
    lessonId: l.kind === 'lesson' ? l.ref : undefined,
    tournamentId: l.kind === 'tournament' ? l.ref : undefined,
    attempts: [],
  };
}

export function monthKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Łączy listy bez powtórek (po id), rosnąco po czasie. */
export function mergeLite(...lists: SessionLite[][]): SessionLite[] {
  const byId = new Map<string, SessionLite>();
  for (const list of lists) for (const s of list) if (s && s.id) byId.set(s.id, s);
  return [...byId.values()].sort((a, b) => a.t - b.t);
}

export function groupByMonth(items: SessionLite[]): Map<string, SessionLite[]> {
  const out = new Map<string, SessionLite[]>();
  for (const s of items) {
    const k = monthKey(s.t);
    out.set(k, [...(out.get(k) ?? []), s]);
  }
  return out;
}

/* ---------------- Pamięć na urządzeniu ---------------- */

interface Store {
  items: SessionLite[];
  pending: SessionLite[];
  fetched: boolean;
  lastFlush: number;
}

const key = (profileId: string) => `mt_hist_${profileId}`;
const EVENT = 'mt:history';

function read(profileId: string): Store {
  try {
    const raw = JSON.parse(window.localStorage.getItem(key(profileId)) ?? 'null');
    if (raw && Array.isArray(raw.items)) {
      return {
        items: raw.items,
        pending: Array.isArray(raw.pending) ? raw.pending : [],
        fetched: Boolean(raw.fetched),
        lastFlush: Number(raw.lastFlush) || 0,
      };
    }
  } catch {
    // uszkodzony wpis — zaczynamy od zera
  }
  return { items: [], pending: [], fetched: false, lastFlush: 0 };
}

function write(profileId: string, st: Store): void {
  try {
    window.localStorage.setItem(key(profileId), JSON.stringify(st));
  } catch {
    // brak miejsca: zostawiamy ostatnie 3000 serii
    try {
      st.items = st.items.slice(-3000);
      window.localStorage.setItem(key(profileId), JSON.stringify(st));
    } catch {
      // trudno — historia w chmurze i tak zostaje
    }
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: profileId }));
  } catch {
    // środowisko bez okna (testy)
  }
}

/** Dopisuje serie do historii (bez powtórek) i do kolejki wysyłki. */
export function archiveSessions(profileId: string, sessions: SessionRecord[]): void {
  if (!profileId || sessions.length === 0) return;
  const st = read(profileId);
  const known = new Set(st.items.map((s) => s.id));
  const fresh = sessions.map(toLite).filter((s) => !known.has(s.id));
  if (fresh.length === 0) return;
  st.items = mergeLite(st.items, fresh);
  st.pending = mergeLite(st.pending, fresh);
  write(profileId, st);
}

/** Historia pobrana z chmury (nowe urządzenie) — łączymy z lokalną. */
export function mergeFetchedHistory(profileId: string, items: SessionLite[]): void {
  const st = read(profileId);
  st.items = mergeLite(st.items, items);
  st.fetched = true;
  write(profileId, st);
}

export function historyNeedsFetch(profileId: string): boolean {
  return !read(profileId).fetched;
}

export function pendingHistory(profileId: string): SessionLite[] {
  return read(profileId).pending;
}

export function markHistoryFlushed(profileId: string, sent: SessionLite[]): void {
  const st = read(profileId);
  const ids = new Set(sent.map((s) => s.id));
  st.pending = st.pending.filter((s) => !ids.has(s.id));
  st.lastFlush = Date.now();
  write(profileId, st);
}

/**
 * Kiedy wysłać paczkę historii: 10 serii albo gdy aplikacja się chowa,
 * albo gdy najstarsza czeka ponad dobę. Jedna paczka = 1 zapis na miesiąc.
 */
export function shouldFlushHistory(profileId: string, appHidden: boolean, now = Date.now()): boolean {
  const st = read(profileId);
  if (st.pending.length === 0) return false;
  if (appHidden || st.pending.length >= 10) return true;
  return now - Math.min(...st.pending.map((s) => s.t)) > 24 * 3600 * 1000;
}

/** Cała historia gracza: archiwum + bieżące serie z profilu. */
export function fullHistory(profileId: string, recent: SessionRecord[] = []): SessionLite[] {
  return mergeLite(read(profileId).items, recent.map(toLite));
}

export function onHistoryChange(cb: (profileId: string) => void): () => void {
  const h = (e: Event) => cb(String((e as CustomEvent).detail ?? ''));
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
