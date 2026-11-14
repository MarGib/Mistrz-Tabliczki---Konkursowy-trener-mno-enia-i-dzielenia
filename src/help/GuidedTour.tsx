/**
 * Przewodnik dla nowych osób: krok po kroku podświetla najważniejsze miejsca aplikacji.
 * Pokazuje się sam przy pierwszym wejściu na nowe konto; można go uruchomić ponownie z pomocy lub Konta.
 */
import { ArrowRight, Compass, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useHelp } from './HelpContext';

type TabId = 'trening' | 'turnieje' | 'statystyki' | 'szablony' | 'konto';

interface TourStep {
  target?: string;
  tab?: TabId;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    title: 'Cześć! Pokażę Ci aplikację',
    body: 'W kilku krokach zobaczysz, gdzie ćwiczyć, jak zdobywać medale, porównywać się z rodziną i gdzie szukać pomocy. Zajmie to pół minuty.',
  },
  {
    target: 'next-step',
    tab: 'trening',
    title: '1. Graj dalej',
    body: 'Najważniejszy przycisk. Aplikacja sama wybiera, co dziś ćwiczyć: następną kropkę na ścieżce albo powtórkę. Wpisujesz wynik na dużej klawiaturze i naciskasz „Sprawdź”.',
  },
  {
    target: 'path',
    tab: 'trening',
    title: '2. Ścieżka z kropkami',
    body: 'Moduły od × 2 do zadań do 1000. W każdym kilka krótkich kropek (2–3 minuty) i test modułu 🏆. Za kropki zbierasz gwiazdki. Bez żyć i kar — pomyłka to tylko wskazówka, co poćwiczyć.',
  },
  {
    target: 'quickstart',
    tab: 'trening',
    title: '3. Wolny trening',
    body: 'Chcesz po swojemu? Wybierz, co, ile (zadania albo minuty) i które tabliczki — albo „Tylko moje trudne”.',
  },
  {
    target: 'nav-turnieje',
    title: '4. Turnieje',
    body: 'Próby na czas o medale: brąz, srebro, złoto i Puchar. Za medal dostajesz certyfikat do wydrukowania.',
  },
  {
    target: 'nav-statystyki',
    title: '5. Statystyki i grupy',
    body: 'Tu wybierasz grupę (rodzinę, znajomych) i widzisz ranking, wykres postępów oraz „Wyzwania w grupie” — kogo możesz dogonić i ile brakuje.',
  },
  {
    target: 'nav-konto',
    title: '6. Konto',
    body: 'Hasło, stan synchronizacji z chmurą, instalacja aplikacji na telefonie i wylogowanie.',
  },
  {
    target: 'help',
    title: '7. Pomoc — zawsze pod ręką',
    body: 'Masz pytanie? Naciśnij „Pomoc” albo małe ikonki „?” przy różnych miejscach — otworzy się instrukcja z obrazkami.',
  },
];

const doneKey = (profileId: string) => `mt_tour_done_${profileId}`;

function isDone(profileId: string): boolean {
  try {
    return window.localStorage.getItem(doneKey(profileId)) === '1';
  } catch {
    return true;
  }
}

function findTarget(name: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return (
    all.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    }) ?? null
  );
}

interface GuidedTourProps {
  profileId: string;
  /** Czy pokazać automatycznie (nowe konto). */
  autoStart: boolean;
  /** Czy można teraz pokazywać (np. nie w trakcie serii). */
  enabled: boolean;
  onSelectTab: (tab: TabId) => void;
}

export function GuidedTour({ profileId, autoStart, enabled, onSelectTab }: GuidedTourProps) {
  const { openHelp } = useHelp();
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Automatyczny start dla nowego konta (po chwili, gdy ekran się ułoży).
  useEffect(() => {
    if (!enabled || !autoStart || isDone(profileId)) return;
    const t = window.setTimeout(() => setStep(0), 1200);
    return () => window.clearTimeout(t);
  }, [profileId, autoStart, enabled]);

  // Ręczne uruchomienie z pomocy / Konta.
  useEffect(() => {
    const start = () => setStep(0);
    window.addEventListener('mt:start-tour', start);
    return () => window.removeEventListener('mt:start-tour', start);
  }, []);

  const finish = useCallback(() => {
    setStep(null);
    setRect(null);
    try {
      window.localStorage.setItem(doneKey(profileId), '1');
    } catch {
      // ignore
    }
  }, [profileId]);

  const current = step !== null ? STEPS[step] : null;

  // Przełącz zakładkę i przewiń do podświetlanego elementu.
  useEffect(() => {
    if (!current) return;
    if (current.tab) onSelectTab(current.tab);
    if (!current.target) {
      setRect(null);
      return;
    }
    const t = window.setTimeout(() => {
      const el = findTarget(current.target!);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      // Element w stałym pasku (dolne menu) jest zawsze widoczny; reszta — przewijamy do niego.
      const fixedParent = getComputedStyle(el).position === 'fixed' || el.closest('nav.fixed');
      if (!fixedParent) {
        // Element na środku ekranu (wysoki — od góry, pod nagłówkiem), żeby zmieściła się też karta przewodnika.
        const tall = r.height > window.innerHeight * 0.4;
        const targetTop = tall ? 80 : window.innerHeight * 0.3 - r.height / 2;
        window.scrollBy({ top: r.top - Math.max(70, targetTop), behavior: 'auto' });
      }
      window.setTimeout(() => setRect(el.getBoundingClientRect()), 120);
    }, current.tab ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [current, onSelectTab]);

  // Aktualizacja pozycji przy przewijaniu / obrocie ekranu.
  useLayoutEffect(() => {
    if (!current?.target) return;
    const update = () => {
      const el = findTarget(current.target!);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [current]);

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, finish]);

  if (!current || step === null) return null;

  const last = step === STEPS.length - 1;
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(360, vw - 24);
  let cardStyle: React.CSSProperties;
  // Bardzo wysokie elementy podświetlamy tylko u góry — reszta ekranu zostaje na kartę.
  const shown = rect
    ? ({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: Math.min(rect.height, vh * 0.4),
        bottom: rect.top + Math.min(rect.height, vh * 0.4),
      } as const)
    : null;
  if (shown) {
    const rect = shown;
    const below = rect.bottom + 12;
    const spaceBelow = vh - below;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), vw - cardW - 12);
    cardStyle =
      spaceBelow > 220
        ? { top: below, left, width: cardW }
        : { bottom: vh - rect.top + 12, left, width: cardW };
  } else {
    cardStyle = { top: Math.max(12, vh / 2 - 130), left: (vw - cardW) / 2, width: cardW };
  }

  return (
    <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true" aria-label="Przewodnik po aplikacji">
      {shown ? (
        <div
          className="fixed rounded-2xl pointer-events-none transition-all duration-300"
          style={{
            top: shown.top - pad,
            left: shown.left - pad,
            width: shown.width + pad * 2,
            height: shown.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.62)',
            outline: '3px solid var(--th-primary)',
            outlineOffset: '2px',
          }}
        >
          <span className="absolute inset-0 rounded-2xl ring-4 ring-[var(--th-primary)] animate-ping opacity-40" />
        </div>
      ) : (
        <div className="fixed inset-0 bg-slate-900/60" />
      )}
      {/* Kliknięcie w tło nic nie robi — przewodnik zamyka „Pomiń” lub „Gotowe”. */}
      <div
        className="fixed rounded-3xl bg-[var(--th-surface)] text-[var(--th-text)] shadow-2xl p-4 space-y-3 border-2 border-[var(--th-primary)] animate-pop-in"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-lg font-extrabold leading-snug inline-flex items-center gap-2">
            {step === 0 && <Compass className="w-5 h-5 text-[var(--th-primary)] shrink-0" aria-hidden="true" />}
            {current.title}
          </p>
          <button
            type="button"
            onClick={finish}
            aria-label="Zamknij przewodnik"
            className="min-w-[36px] min-h-[36px] rounded-xl text-[var(--th-text-muted)] inline-flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm leading-relaxed">{current.body}</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-label={`Krok ${step + 1} z ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-5 bg-[var(--th-primary)]' : 'w-1.5 bg-[var(--th-border)]'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {!last && (
              <button
                type="button"
                onClick={finish}
                className="min-h-[42px] px-3 rounded-xl text-sm font-bold text-[var(--th-text-muted)] cursor-pointer"
              >
                Pomiń
              </button>
            )}
            {last && (
              <button
                type="button"
                onClick={() => {
                  finish();
                  window.setTimeout(() => openHelp('start'), 200);
                }}
                className="min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] text-sm font-bold cursor-pointer"
              >
                Otwórz pomoc
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => (last ? finish() : setStep(step + 1))}
              className="min-h-[42px] px-4 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {step === 0 ? 'Zaczynamy' : last ? 'Gotowe' : 'Dalej'}
              {!last && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
