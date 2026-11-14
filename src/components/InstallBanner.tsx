import { type ReactNode, useEffect, useState } from 'react';
import { Download, MoreVertical, PlusSquare, Share, X } from 'lucide-react';
import { HelpButton } from '../help/HelpButton';
import { useHelp } from '../help/HelpContext';
import {
  type InstallPlatform,
  detectInstallPlatform,
  getInstallPrompt,
  isStandalone,
  onInstallPromptChange,
  runInstallPrompt,
} from '../pwa';

const DISMISS_KEY = 'mt_install_dismissed_until_v2';
const DISMISS_COUNT_KEY = 'mt_install_dismiss_count';
/** Po kolejnych zamknięciach propozycja wraca coraz rzadziej: 2, 4, 7, potem co 14 dni. */
const BACKOFF_DAYS = [2, 4, 7, 14];

function readNum(key: string): number {
  try {
    return Number(window.localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => onInstallPromptChange(() => force((x) => x + 1)), []);
  return getInstallPrompt();
}

function Steps({ platform }: { platform: InstallPlatform }) {
  const step = (n: number, body: ReactNode) => (
    <li className="flex items-start gap-2">
      <span className="w-5 h-5 rounded-full bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-[11px] font-extrabold inline-flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <span>{body}</span>
    </li>
  );
  const shareIcon = <Share className="inline w-4 h-4 -mt-0.5 text-[#007AFF]" aria-label="Udostępnij" />;
  if (platform === 'in-app') {
    return (
      <ol className="space-y-1.5">
        {step(1, <>Ta strona jest otwarta w aplikacji (np. Messenger). Naciśnij menu <b>⋯</b> w rogu.</>)}
        {step(2, <>Wybierz <b>„Otwórz w przeglądarce”</b> (Safari lub Chrome) — tam zainstalujesz aplikację.</>)}
      </ol>
    );
  }
  if (platform === 'android-menu') {
    return (
      <ol className="space-y-1.5">
        {step(1, <>Naciśnij menu <MoreVertical className="inline w-4 h-4 -mt-0.5" aria-label="menu" /> w prawym górnym rogu przeglądarki.</>)}
        {step(2, <>Wybierz <b>„Zainstaluj aplikację”</b> albo <b>„Dodaj do ekranu głównego”</b>.</>)}
      </ol>
    );
  }
  return (
    <ol className="space-y-1.5">
      {step(
        1,
        platform === 'ios-other' ? (
          <>Naciśnij {shareIcon} <b>Udostępnij</b> przy pasku adresu.</>
        ) : (
          <>Naciśnij {shareIcon} <b>Udostępnij</b> na dolnym pasku Safari (na iPadzie — u góry).</>
        )
      )}
      {step(2, <>Przewiń w dół i wybierz <b>„Do ekranu początkowego”</b> <PlusSquare className="inline w-4 h-4 -mt-0.5" aria-hidden="true" />.</>)}
      {step(3, <>Potwierdź <b>„Dodaj”</b>. Otwieraj grę z ikonki — bez pasków przeglądarki, na całym ekranie.</>)}
    </ol>
  );
}

/**
 * Propozycja instalacji jako aplikacji — pływa nad dolnym menu (telefon) albo w dolnym rogu (tablet, komputer).
 * Daje więcej miejsca na ekranie (bez pasków przeglądarki). Po zamknięciu wraca po kilku dniach.
 */
export function InstallBanner() {
  const prompt = useInstallPrompt();
  const [hiddenUntil, setHiddenUntil] = useState(() => readNum(DISMISS_KEY));
  const [ready, setReady] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  // Nie wyskakuje od razu po otwarciu — najpierw chwila na rozejrzenie się.
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  const platform = detectInstallPlatform(Boolean(prompt));
  const visible = ready && platform !== 'none' && Date.now() >= hiddenUntil;

  // Rezerwuje miejsce na dole strony, by baner nie zasłaniał treści.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--mt-install-h', visible ? (showSteps ? '190px' : '84px') : '0px');
    return () => root.style.setProperty('--mt-install-h', '0px');
  }, [visible, showSteps]);

  if (!visible) return null;

  const dismiss = () => {
    const count = readNum(DISMISS_COUNT_KEY);
    const days = BACKOFF_DAYS[Math.min(count, BACKOFF_DAYS.length - 1)];
    const until = Date.now() + days * 24 * 3600 * 1000;
    setHiddenUntil(until);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(until));
      window.localStorage.setItem(DISMISS_COUNT_KEY, String(count + 1));
    } catch {
      // ignore
    }
  };

  const install = async () => {
    if (platform === 'prompt') {
      const ok = await runInstallPrompt();
      if (!ok) dismiss();
    } else {
      setShowSteps((v) => !v);
    }
  };

  return (
    <div
      className="fixed z-[35] left-2 right-2 md:left-auto md:right-6 md:w-[420px] bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 animate-pop-in"
      data-testid="install-banner"
      role="region"
      aria-label="Instalacja aplikacji"
    >
      <div
        className="rounded-2xl border p-3 shadow-lg backdrop-blur-md"
        style={{
          background: 'color-mix(in srgb, var(--th-surface) 94%, transparent)',
          borderColor: 'color-mix(in oklab, var(--th-primary) 35%, var(--th-border))',
          boxShadow: '0 10px 30px -12px color-mix(in srgb, var(--th-primary) 55%, transparent)',
        }}
      >
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="w-11 h-11 rounded-xl shrink-0 shadow-sm" />
          <div className="flex-1 min-w-0 text-[var(--th-text)]">
            <p className="text-sm font-extrabold leading-tight">Zainstaluj Mistrza Tabliczki</p>
            <p className="text-xs text-[var(--th-text-muted)] leading-snug">
              {platform === 'in-app'
                ? 'Otwórz w przeglądarce, aby zainstalować.'
                : 'Pełny ekran bez pasków przeglądarki, start z ikonki.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void install()}
            className="min-h-[42px] px-3.5 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {!showSteps && <Download className="w-4 h-4" aria-hidden="true" />}
            {platform === 'prompt' ? 'Zainstaluj' : showSteps ? 'Zwiń' : 'Jak?'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Nie teraz"
            title="Nie teraz — przypomnę za kilka dni"
            className="min-h-[42px] min-w-[36px] rounded-xl text-[var(--th-text-muted)] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        {showSteps && (
          <div className="mt-3 pt-3 border-t border-[var(--th-border)] text-sm text-[var(--th-text)]">
            <Steps platform={platform} />
            <div className="mt-2 flex justify-end">
              <HelpButton section="install" label="Instalacja" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Stały przycisk w zakładce Konto: instaluje albo pokazuje instrukcję dla danego telefonu. */
export function InstallAppButton() {
  const prompt = useInstallPrompt();
  const { openHelp } = useHelp();
  if (isStandalone()) {
    return (
      <p className="text-xs font-semibold text-emerald-600" data-testid="install-status">
        ✓ Aplikacja jest zainstalowana na tym urządzeniu.
      </p>
    );
  }
  return (
    <button
      type="button"
      data-testid="install-app-btn"
      onClick={() => (prompt ? void runInstallPrompt() : openHelp('install'))}
      className="w-full min-h-[44px] px-4 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer hover:border-[var(--th-primary)]"
    >
      <Download className="w-4 h-4" aria-hidden="true" />
      Zainstaluj aplikację na tym urządzeniu
    </button>
  );
}
