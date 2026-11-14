import { HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useHelp } from './HelpContext';

export const HELP_OPENED_KEY = 'mt_help_opened';

function helpOpenedBefore(): boolean {
  try {
    return window.localStorage.getItem(HELP_OPENED_KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * Wyraźny przycisk „Pomoc” w nagłówku. Dopóki ktoś nie otworzy pomocy pierwszy raz,
 * delikatnie pulsuje — żeby nowa osoba wiedziała, gdzie szukać instrukcji.
 */
export function HeaderHelpButton() {
  const { openHelp } = useHelp();
  const [fresh, setFresh] = useState(() => !helpOpenedBefore());

  useEffect(() => {
    const onOpened = () => setFresh(false);
    window.addEventListener('mt:help-opened', onOpened);
    return () => window.removeEventListener('mt:help-opened', onOpened);
  }, []);

  return (
    <button
      type="button"
      data-tour="help"
      onClick={() => openHelp('start')}
      aria-label="Pomoc — jak to działa?"
      title="Pomoc — jak to działa?"
      className={`relative min-h-[38px] min-w-[38px] sm:min-h-[40px] px-2 sm:px-3 rounded-xl border inline-flex items-center justify-center gap-1.5 text-sm font-bold cursor-pointer transition-colors shrink-0 ${
        fresh
          ? 'border-[var(--th-primary)] bg-[var(--th-primary)] text-[var(--th-primary-fg)]'
          : 'border-[var(--th-border)] bg-[var(--th-surface-muted)] text-[var(--th-text)] hover:border-[var(--th-primary)]'
      }`}
    >
      {fresh && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-xl ring-2 ring-[var(--th-primary)] animate-ping opacity-60 pointer-events-none"
        />
      )}
      <HelpCircle className="w-4 h-4" aria-hidden="true" />
      <span className="hidden sm:inline">Pomoc</span>
    </button>
  );
}
