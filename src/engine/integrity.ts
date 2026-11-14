/**
 * Uczciwa gra: wykrywanie nienaturalnych serii (boty, automaty, podpowiadanie przez AI),
 * masowego zakładania kont z jednego urządzenia i zgadywania haseł.
 *
 * Zasady:
 *  • Dziecko NIGDY nie jest karane za samo szybkie liczenie. Progi są ustawione poniżej ludzkich
 *    możliwości (3 dotknięcia: cyfra, cyfra, „Sprawdź” — to fizycznie ok. 0,6 s i więcej).
 *  • Mocny sygnał  → „do sprawdzenia”: wyniki znikają z rankingów grup do czasu decyzji opiekuna,
 *    ale gracz dalej może ćwiczyć (bez kar, bez utraty postępu).
 *  • Słaby sygnał  → „obserwacja”: tylko wpis dla administratora.
 *  • Decyzję „zablokuj” podejmuje wyłącznie człowiek w panelu administratora.
 */
import type { TaskAttempt } from '../types/math';

export type IntegrityLevel = 'ok' | 'watch' | 'pending';

export interface IntegritySignals {
  /** Czasy odpowiedzi bez zaokrągleń (ms). */
  rawTimesMs: number[];
  /** Zdarzenia klawiatury/dotyku wygenerowane przez skrypt (isTrusted === false). */
  untrustedEvents: number;
  /** Przeglądarka sterowana automatem (navigator.webdriver). */
  webdriver: boolean;
  /** Ile razy w trakcie zadania aplikacja była schowana (przełączenie okna/karty). */
  hiddenDuringTask: number;
  /** Ile z tych zadań zakończyło się poprawną odpowiedzią tuż po powrocie. */
  correctAfterHidden: number;
}

export interface IntegrityVerdict {
  level: IntegrityLevel;
  /** Krótkie kody powodów (do panelu). */
  reasons: string[];
  /** Mediana czasu odpowiedzi (ms). */
  medianMs: number;
}

export const REASON_LABELS: Record<string, string> = {
  automation: 'Sterowanie automatem (skrypt lub robot w przeglądarce)',
  superhuman: 'Odpowiedzi szybsze niż człowiek jest w stanie wpisać',
  'very-fast': 'Bardzo szybkie odpowiedzi przy niemal 100% poprawności',
  'robot-rhythm': 'Podejrzanie równe tempo (jak u maszyny)',
  'window-switch': 'Częste przełączanie okna w trakcie zadań (np. pytanie AI)',
  'many-accounts': 'Wiele kont założonych na jednym urządzeniu',
  'server-scan': 'Podejrzana seria znaleziona w danych na serwerze',
};

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Współczynnik zmienności (odchylenie / średnia). Człowiek: zwykle 0,3–0,8. Maszyna: blisko 0. */
export function variation(values: number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 0;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
  return sd / mean;
}

export const LIMITS = {
  minTasks: 10,
  superhumanMedianMs: 450,
  veryFastMedianMs: 700,
  robotVariation: 0.1,
  robotMaxMedianMs: 1500,
  hiddenCorrect: 3,
};

/** Progi dla gier dotykowych (jedno lub dwa stuknięcia zamiast wpisywania wyniku). */
export const GAME_LIMITS: Record<'truefalse' | 'pairs', Partial<typeof LIMITS>> = {
  // Prawda/fałsz: przeczytać działanie i stuknąć jeden z dwóch przycisków.
  truefalse: { minTasks: 12, superhumanMedianMs: 250, veryFastMedianMs: 380 },
  // Pary: dwa stuknięcia (działanie + wynik) i szukanie wyniku na planszy.
  pairs: { minTasks: 6, superhumanMedianMs: 300, veryFastMedianMs: 450 },
};

/** Ocena jednej serii. */
export function assessSeries(
  attempts: TaskAttempt[],
  signals: IntegritySignals,
  overrides: Partial<typeof LIMITS> = {}
): IntegrityVerdict {
  const L = { ...LIMITS, ...overrides };
  const reasons: string[] = [];
  const times = signals.rawTimesMs.length === attempts.length ? signals.rawTimesMs : attempts.map((a) => a.timeMs);
  const med = median(times);
  const n = attempts.length;
  const accuracy = n > 0 ? attempts.filter((a) => a.isCorrect).length / n : 0;
  let strong = false;

  if (signals.webdriver || signals.untrustedEvents >= 3) {
    reasons.push('automation');
    strong = true;
  }
  if (n >= L.minTasks && accuracy >= 0.9) {
    if (med < L.superhumanMedianMs) {
      reasons.push('superhuman');
      strong = true;
    } else if (med < L.veryFastMedianMs) {
      reasons.push('very-fast');
    }
    if (variation(times) < L.robotVariation && med < L.robotMaxMedianMs) {
      reasons.push('robot-rhythm');
    }
  }
  if (signals.correctAfterHidden >= L.hiddenCorrect) {
    reasons.push('window-switch');
  }
  // Dwa słabe sygnały naraz to już mocny sygnał.
  if (!strong && reasons.length >= 2) strong = true;

  return { level: strong ? 'pending' : reasons.length > 0 ? 'watch' : 'ok', reasons, medianMs: med };
}

/** Ocena serii zapisanych na serwerze (panel administratora) — działa też na zmodyfikowane aplikacje. */
export function serverSeriesSuspicious(s: { tasks: number; correct: number; avgMs: number }): boolean {
  if (s.tasks < LIMITS.minTasks) return false;
  // Czas jest zapisywany z dolnym limitem 300 ms, więc średnia ≤ 450 ms = większość odpowiedzi „w 0 s”.
  return s.correct / s.tasks >= 0.9 && s.avgMs > 0 && s.avgMs <= LIMITS.superhumanMedianMs;
}

/* ---------------- Konta na jednym urządzeniu ---------------- */

const CREATED_KEY = 'mt_dev_created';
export const MAX_NEW_ACCOUNTS_PER_DAY = 3;
export const MANY_ACCOUNTS_TOTAL = 6;
const DAY_MS = 24 * 3600 * 1000;

function readList(key: string): number[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: number[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(list.slice(-50)));
  } catch {
    // brak pamięci urządzenia — trudno
  }
}

export function newAccountsGate(createdAt: number[], now = Date.now()): { allowed: boolean; today: number; total: number } {
  const today = createdAt.filter((t) => now - t < DAY_MS).length;
  return { allowed: today < MAX_NEW_ACCOUNTS_PER_DAY, today, total: createdAt.length };
}

/** Czy na tym urządzeniu można dziś założyć kolejne konto. */
export function canCreateAccountHere(): { allowed: boolean; message: string } {
  const g = newAccountsGate(readList(CREATED_KEY));
  return g.allowed
    ? { allowed: true, message: '' }
    : {
        allowed: false,
        message: `Na tym urządzeniu założono dziś już ${g.today} konta. Kolejne można założyć jutro — albo zaloguj się na istniejące konto.`,
      };
}

/** Zapamiętuje założenie konta; zwraca true, gdy kont na urządzeniu jest podejrzanie dużo. */
export function noteAccountCreatedHere(): boolean {
  const list = [...readList(CREATED_KEY), Date.now()];
  writeList(CREATED_KEY, list);
  return list.length >= MANY_ACCOUNTS_TOTAL;
}

/* ---------------- Zgadywanie haseł ---------------- */

const FAIL_KEY = 'mt_login_fails';
export const MAX_FAILS = 5;
export const FAIL_WINDOW_MS = 10 * 60 * 1000;
export const LOCK_MS = 5 * 60 * 1000;

export function lockoutLeftMs(fails: number[], now = Date.now()): number {
  const recent = fails.filter((t) => now - t < FAIL_WINDOW_MS);
  if (recent.length < MAX_FAILS) return 0;
  const last = Math.max(...recent);
  return Math.max(0, last + LOCK_MS - now);
}

/** Ile ms trzeba jeszcze poczekać przed kolejną próbą logowania na tym urządzeniu (0 = można). */
export function loginLockLeftMs(): number {
  return lockoutLeftMs(readList(FAIL_KEY));
}

export function noteLoginFailure(): void {
  writeList(FAIL_KEY, [...readList(FAIL_KEY).filter((t) => Date.now() - t < FAIL_WINDOW_MS), Date.now()]);
}

export function clearLoginFailures(): void {
  writeList(FAIL_KEY, []);
}

/* ---------------- Czujnik w trakcie gry ---------------- */

/** Dopisuje wynik czujnika do serii, gdy wyglądała nienaturalnie. */
export function attachIntegrity(
  session: { integrity?: { level: 'watch' | 'pending'; reasons: string[]; medianMs: number } },
  attempts: TaskAttempt[],
  signals: IntegritySignals,
  overrides: Partial<typeof LIMITS> = {}
): void {
  const v = assessSeries(attempts, signals, overrides);
  if (v.level !== 'ok') session.integrity = { level: v.level, reasons: v.reasons, medianMs: v.medianMs };
}

/**
 * Nasłuchuje zdarzeń w trakcie serii: zdarzenia wygenerowane skryptem i chowanie aplikacji.
 * Nie zbiera żadnych treści — tylko liczniki.
 */
export function createIntegritySensor() {
  let untrusted = 0;
  let hiddenNow = false;
  let hiddenDuringTask = 0;
  let correctAfterHidden = 0;
  let hiddenThisTask = false;
  const rawTimes: number[] = [];

  const onInput = (e: Event) => {
    if (!e.isTrusted) untrusted += 1;
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      if (!hiddenNow) {
        hiddenNow = true;
        hiddenThisTask = true;
      }
    } else {
      hiddenNow = false;
    }
  };

  return {
    start() {
      window.addEventListener('keydown', onInput, true);
      window.addEventListener('click', onInput, true);
      window.addEventListener('pointerdown', onInput, true);
      document.addEventListener('visibilitychange', onVisibility);
    },
    stop() {
      window.removeEventListener('keydown', onInput, true);
      window.removeEventListener('click', onInput, true);
      window.removeEventListener('pointerdown', onInput, true);
      document.removeEventListener('visibilitychange', onVisibility);
    },
    /** Wywołaj po każdej odpowiedzi. */
    answer(rawMs: number, correct: boolean) {
      rawTimes.push(Math.max(0, Math.round(rawMs)));
      if (hiddenThisTask) {
        hiddenDuringTask += 1;
        if (correct) correctAfterHidden += 1;
      }
      hiddenThisTask = false;
    },
    reset() {
      untrusted = 0;
      hiddenDuringTask = 0;
      correctAfterHidden = 0;
      hiddenThisTask = false;
      rawTimes.length = 0;
    },
    signals(): IntegritySignals {
      let webdriver = false;
      try {
        webdriver = Boolean((navigator as Navigator & { webdriver?: boolean }).webdriver);
      } catch {
        webdriver = false;
      }
      return { rawTimesMs: [...rawTimes], untrustedEvents: untrusted, webdriver, hiddenDuringTask, correctAfterHidden };
    },
  };
}
