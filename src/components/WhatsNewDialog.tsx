import { Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LATEST_RELEASE_ID, RELEASES, type ReleaseNote } from '../data/changelog';

const SEEN_KEY = 'mt_seen_release';

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function markReleaseSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, LATEST_RELEASE_ID);
  } catch {
    // ignore
  }
}

/** Wpisy, których ten gracz jeszcze nie widział (najwyżej 3 ostatnie). */
function unseenReleases(): ReleaseNote[] {
  const seen = readSeen();
  if (!seen) return RELEASES.slice(0, 1);
  return RELEASES.filter((r) => r.id > seen).slice(0, 3);
}

/**
 * Okienko „Co nowego” — pokazuje się raz po aktualizacji, gdy gracz wraca do aplikacji.
 * Nowi gracze (mniej niż 3 serie) go nie dostają — dla nich jest przewodnik po aplikacji.
 */
export function WhatsNewDialog({
  enabled,
  isNewPlayer,
  forceOpen,
  onClose,
}: {
  enabled: boolean;
  isNewPlayer: boolean;
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const [notes, setNotes] = useState<ReleaseNote[] | null>(null);

  useEffect(() => {
    if (forceOpen) {
      setNotes(RELEASES.slice(0, 3));
      return;
    }
    if (!enabled || notes) return;
    if (readSeen() === LATEST_RELEASE_ID) return;
    if (isNewPlayer) {
      markReleaseSeen();
      return;
    }
    const list = unseenReleases();
    if (list.length === 0) {
      markReleaseSeen();
      return;
    }
    // chwila oddechu po starcie, żeby nie zasłaniać ekranu w trakcie wczytywania
    const t = window.setTimeout(() => setNotes(list), 700);
    return () => window.clearTimeout(t);
  }, [enabled, isNewPlayer, forceOpen, notes]);

  if (!notes) return null;

  const close = () => {
    markReleaseSeen();
    setNotes(null);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/45 flex items-end sm:items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      onClick={close}
      data-testid="whats-new"
    >
      <div
        className="w-full max-w-md max-h-[85svh] overflow-y-auto rounded-3xl bg-[var(--th-surface)] text-[var(--th-text)] border border-[var(--th-border)] shadow-2xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[var(--th-primary)] text-[var(--th-primary-fg)] px-5 py-4 flex items-center gap-3">
          <Sparkles className="w-6 h-6 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p id="whats-new-title" className="font-display font-extrabold text-lg leading-tight">Co nowego?</p>
            <p className="text-xs opacity-90">Aplikacja właśnie się zaktualizowała</p>
          </div>
          <button type="button" onClick={close} aria-label="Zamknij" className="w-10 h-10 rounded-full hover:bg-white/15 flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {notes.map((r) => (
            <section key={r.id} className="space-y-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--th-text-muted)]">{r.date}</p>
                <h3 className="font-display font-extrabold text-base">{r.title}</h3>
              </div>
              <ul className="space-y-2">
                {r.items.map((it, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-snug">
                    <span className="text-lg leading-none shrink-0" aria-hidden="true">{it.emoji}</span>
                    <span>{it.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <button
            type="button"
            onClick={close}
            className="w-full min-h-[48px] rounded-2xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-display font-bold border-b-4 border-[var(--th-primary-dark)] cursor-pointer"
          >
            Super, gramy!
          </button>
        </div>
      </div>
    </div>
  );
}
