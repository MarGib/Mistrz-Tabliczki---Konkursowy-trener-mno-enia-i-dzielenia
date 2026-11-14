import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { HelpButton } from '../help/HelpButton';
import { useHelp } from '../help/HelpContext';
import {
  getInstallPrompt,
  isIos,
  isStandalone,
  onInstallPromptChange,
  runInstallPrompt,
} from '../pwa';

const DISMISS_KEY = 'mt_install_dismissed_until';

function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => onInstallPromptChange(() => force((x) => x + 1)), []);
  return getInstallPrompt();
}

/** Baner „Zainstaluj aplikację” — po zamknięciu wraca za 7 dni. */
export function InstallBanner() {
  const prompt = useInstallPrompt();
  const [hiddenUntil, setHiddenUntil] = useState(() => {
    try {
      return Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    } catch {
      return 0;
    }
  });

  if (isStandalone() || Date.now() < hiddenUntil) return null;
  const ios = isIos();
  if (!prompt && !ios) return null;

  const dismiss = () => {
    const until = Date.now() + 7 * 24 * 3600 * 1000;
    setHiddenUntil(until);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      // ignore
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-3" data-testid="install-banner">
      <div className="rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface)] p-3 flex items-center gap-3 shadow-sm">
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0 text-sm text-[var(--th-text)]">
          <p className="font-bold">Zainstaluj Mistrza Tabliczki</p>
          {prompt ? (
            <p className="text-xs text-[var(--th-text-muted)]">Ikonka na ekranie głównym, otwiera się jak aplikacja.</p>
          ) : (
            <p className="text-xs text-[var(--th-text-muted)]">
              Naciśnij <Share className="inline w-3.5 h-3.5 -mt-0.5" aria-label="Udostępnij" /> w Safari, a potem „Do ekranu początkowego”.
            </p>
          )}
        </div>
        <HelpButton section="install" label="Instalacja" />
        {prompt && (
          <button
            type="button"
            onClick={() => void runInstallPrompt()}
            className="min-h-[42px] px-4 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Zainstaluj
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ukryj na 7 dni"
          className="min-h-[42px] min-w-[42px] rounded-xl text-[var(--th-text-muted)] flex items-center justify-center cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
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
