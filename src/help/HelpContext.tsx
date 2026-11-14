import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { HelpSectionId } from './helpContent';
import { HelpCenter } from './HelpCenter';

interface HelpApi {
  openHelp: (section?: HelpSectionId) => void;
}

const HelpCtx = createContext<HelpApi>({ openHelp: () => {} });

export function useHelp(): HelpApi {
  return useContext(HelpCtx);
}

/**
 * Pomoc otwiera się jako nakładka nad bieżącym ekranem. Otwarcie dodaje wpis w historii,
 * więc przycisk/gest „Wstecz” zamyka pomoc i zostawia użytkownika w tym samym miejscu.
 */
export function HelpProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<HelpSectionId | null>(null);
  const pushedRef = useRef(false);
  const savedScrollRef = useRef(0);

  const restoreScroll = () => {
    const y = savedScrollRef.current;
    window.requestAnimationFrame(() => window.scrollTo(0, y));
  };

  useEffect(() => {
    const onPop = () => {
      if (pushedRef.current) {
        pushedRef.current = false;
        setSection(null);
        restoreScroll();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openHelp = useCallback((id: HelpSectionId = 'start') => {
    try {
      window.localStorage.setItem('mt_help_opened', '1');
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('mt:help-opened'));
    savedScrollRef.current = window.scrollY;
    if (!pushedRef.current) {
      try {
        window.history.pushState({ mtHelp: true }, '');
        pushedRef.current = true;
      } catch {
        pushedRef.current = false;
      }
    }
    setSection(id);
  }, []);

  const closeHelp = useCallback(() => {
    if (pushedRef.current) {
      window.history.back(); // popstate zamknie nakładkę
    } else {
      setSection(null);
      restoreScroll();
    }
  }, []);

  return (
    <HelpCtx.Provider value={{ openHelp }}>
      {children}
      {section && <HelpCenter initialSection={section} onClose={closeHelp} />}
    </HelpCtx.Provider>
  );
}
