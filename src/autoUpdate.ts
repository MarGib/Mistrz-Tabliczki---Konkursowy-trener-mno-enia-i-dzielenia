/**
 * Samoczynna aktualizacja: aplikacja otwarta od dawna na tablecie / w trybie PWA
 * sprawdza, czy na serwerze jest nowsza wersja, i przeładowuje się w bezpiecznej chwili
 * (gdy dziecko wraca do aplikacji albo nic nie wpisuje) — bez ręcznego odświeżania.
 */
const SCRIPT_RE = /assets\/index-[\w-]+\.js/;

function currentBundle(): string | null {
  for (const s of Array.from(document.scripts)) {
    const m = s.src.match(SCRIPT_RE);
    if (m) return m[0];
  }
  return null;
}

let updateReady = false;

async function checkForUpdate(): Promise<boolean> {
  const mine = currentBundle();
  if (!mine || !navigator.onLine) return false;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const m = (await res.text()).match(SCRIPT_RE);
    if (m && m[0] !== mine) {
      updateReady = true;
      navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
    }
  } catch {
    // brak sieci — spróbujemy później
  }
  return updateReady;
}

function isBusy(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  // Nie przerywaj wpisywania (np. hasła czy wyniku).
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
}

function reloadIfSafe() {
  if (updateReady && document.visibilityState === 'visible' && !isBusy()) {
    window.location.reload();
  }
}

export function startAutoUpdate() {
  if (!import.meta.env.PROD) return;
  // Po powrocie do aplikacji: sprawdź i ewentualnie przeładuj.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    void checkForUpdate().then(reloadIfSafe);
  });
  window.addEventListener('online', () => void checkForUpdate());
  // Co 10 minut sprawdzaj; przeładuj tylko, gdy nikt nic nie wpisuje.
  window.setInterval(() => {
    void checkForUpdate().then(() => {
      if (updateReady && !isBusy()) window.setTimeout(reloadIfSafe, 1500);
    });
  }, 10 * 60_000);
  window.setTimeout(() => void checkForUpdate(), 30_000);
}

/** Do użycia przy błędzie połączenia: jeśli jest nowsza wersja, przeładuj od razu. */
export async function reloadIfNewVersion(): Promise<boolean> {
  const has = await checkForUpdate();
  if (has) window.location.reload();
  return has;
}
