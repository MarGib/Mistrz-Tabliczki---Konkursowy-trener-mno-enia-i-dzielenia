import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { HelpButton } from '../help/HelpButton';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'mt_install_dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Proponuje dodanie aplikacji do ekranu głównego (Android: systemowy przycisk, iPhone: krótka instrukcja). */
export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isStandalone()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const onInstalled = () => setDeferred(null);
    window.addEventListener('appinstalled', onInstalled);
    if (isIos()) setShowIos(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (dismissed || isStandalone() || (!deferred && !showIos)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
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
          {deferred ? (
            <p className="text-xs text-[var(--th-text-muted)]">Ikonka na ekranie głównym, otwiera się jak aplikacja.</p>
          ) : (
            <p className="text-xs text-[var(--th-text-muted)]">
              Naciśnij <Share className="inline w-3.5 h-3.5 -mt-0.5" aria-label="Udostępnij" /> w Safari, a potem „Do ekranu początkowego”.
            </p>
          )}
        </div>
        <HelpButton section="install" label="Instalacja" />
        {deferred && (
          <button
            type="button"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice.catch(() => null);
              setDeferred(null);
            }}
            className="min-h-[42px] px-4 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Zainstaluj
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Nie pokazuj więcej"
          className="min-h-[42px] min-w-[42px] rounded-xl text-[var(--th-text-muted)] flex items-center justify-center cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
