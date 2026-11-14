/**
 * Cichy release.
 *
 * Nowa wersja pobiera się w tle (service worker), a podmienia się tylko w bezpiecznej chwili:
 *  • gdy aplikacja jest schowana (dziecko wyszło do innej aplikacji / zablokowało ekran) — przeładowanie
 *    dzieje się niewidocznie, a po powrocie od razu widać nową wersję i okienko „Co nowego”,
 *  • albo w chwili powrotu do aplikacji (zanim dziecko zacznie coś robić) — nigdy w trakcie serii zadań
 *    i nigdy podczas pisania. Gdy aplikacja jest na ekranie, nic się nie przeładowuje.
 * Postęp zapisuje się na bieżąco na urządzeniu, więc przeładowanie niczego nie gubi.
 */
const SCRIPT_RE = /assets\/index-[\w-]+\.js/;
export const JUST_UPDATED_KEY = 'mt_just_updated';

function currentBundle(): string | null {
  for (const s of Array.from(document.scripts)) {
    const m = s.src.match(SCRIPT_RE);
    if (m) return m[0];
  }
  return null;
}

let updateReady = false;
let gameActive = false;
let hiddenTimer: number | null = null;

/** Ekran gry zgłasza, że trwa seria zadań — wtedy nie przeładowujemy. */
export function setGameActive(active: boolean) {
  gameActive = active;
}

async function checkForUpdate(): Promise<boolean> {
  if (updateReady) return true;
  const mine = currentBundle();
  if (!mine || !navigator.onLine) return false;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const m = (await res.text()).match(SCRIPT_RE);
    if (m && m[0] !== mine) {
      updateReady = true;
      // service worker pobiera nową wersję w tle — po przeładowaniu działa ona także offline
      navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
    }
  } catch {
    // brak sieci — spróbujemy później
  }
  return updateReady;
}

function isBusy(): boolean {
  if (gameActive) return true;
  const el = document.activeElement as HTMLElement | null;
  // Nie przerywaj wpisywania (np. hasła czy wiadomości).
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'));
}

function doReload() {
  try {
    window.sessionStorage.setItem(JUST_UPDATED_KEY, '1');
  } catch {
    // ignore
  }
  window.location.reload();
}

function reloadIfSafe() {
  if (updateReady && !isBusy()) doReload();
}

export function startAutoUpdate() {
  if (!import.meta.env.PROD) return;
  document.addEventListener('visibilitychange', () => {
    if (hiddenTimer) {
      window.clearTimeout(hiddenTimer);
      hiddenTimer = null;
    }
    if (document.visibilityState === 'hidden') {
      // Aplikacja schowana: podmień wersję niewidocznie (seria zadań i tak jest wtedy zapisana).
      hiddenTimer = window.setTimeout(() => {
        void checkForUpdate().then((ok) => {
          if (ok && document.visibilityState === 'hidden' && !gameActive) doReload();
        });
      }, 1500);
      return;
    }
    void checkForUpdate().then(reloadIfSafe);
  });
  window.addEventListener('online', () => void checkForUpdate());
  // Co 10 minut tylko sprawdzamy (i pobieramy w tle) — podmiana nastąpi, gdy aplikacja zostanie schowana.
  window.setInterval(() => void checkForUpdate(), 10 * 60_000);
  window.setTimeout(() => void checkForUpdate(), 30_000);
}

/** Przy błędzie połączenia: jeśli jest nowsza wersja i nikt nie gra — przeładuj. */
export async function reloadIfNewVersion(): Promise<boolean> {
  const has = await checkForUpdate();
  if (has && !isBusy()) doReload();
  return has;
}
