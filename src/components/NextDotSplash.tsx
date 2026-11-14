import { Map as MapIcon, Play } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { PathStep } from '../engine/nextStep';

const KIND_HINT: Record<string, string> = {
  'Trening w punkt': 'Kilka zadań tylko z tych tabliczek — spokojnie, ale z pamięci.',
  Luka: 'Brakuje jednej liczby, np. „? × 6 = 42”. Znajdź ją.',
  'Wyścig z czasem': 'Masz 60 sekund — ile zdążysz dobrze policzyć?',
  'Prawda czy fałsz': 'Pokażemy działanie z wynikiem. Ty decydujesz: prawda czy fałsz.',
  Pary: 'Połącz każde działanie z jego wynikiem.',
  Historyjka: 'Krótkie zadania z życia — przeczytaj i policz.',
  'Twoje najtrudniejsze': 'Działania, które sprawiały Ci kłopot. Teraz je pokonasz!',
  'Test modułu': 'Pokaż, czego się nauczyłeś. Zaliczony test otwiera następny moduł.',
};

/** Krótki ekran „co teraz” między kropkami ścieżki — żeby nikt się nie zgubił. */
export function NextDotSplash({
  step,
  newModule,
  onStart,
  onBack,
}: {
  step: PathStep;
  newModule: boolean;
  onStart: () => void;
  onBack: () => void;
}) {
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    startRef.current?.focus();
  }, []);

  return (
    <div className="max-w-xl mx-auto px-3 py-6 sm:py-10" data-testid="next-dot-splash">
      <div className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--th-primary)]">
          {newModule ? '🎉 Nowy moduł!' : `Kropka ${step.position} z ${step.total}`}
        </p>
        <p className="text-sm font-semibold text-[var(--th-text-muted)]">{step.stageTitle}</p>

        {/* Mini ścieżka: gdzie jestem w module */}
        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          {Array.from({ length: step.total }, (_, i) => (
            <span
              key={i}
              className={`h-3 rounded-full transition-all ${
                i + 1 < step.position
                  ? 'w-3 bg-[var(--th-primary)]'
                  : i + 1 === step.position
                  ? 'w-8 bg-amber-400'
                  : 'w-3 bg-[var(--th-border)]'
              }`}
            />
          ))}
        </div>

        <div className="text-6xl" aria-hidden="true">{step.emoji}</div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--th-text-muted)]">Teraz: {step.kindLabel}</p>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight">{step.label}</h2>
        </div>
        {KIND_HINT[step.kindLabel] && <p className="text-base">{KIND_HINT[step.kindLabel]}</p>}

        <button
          ref={startRef}
          type="button"
          onClick={onStart}
          className="w-full min-h-[56px] rounded-2xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-display text-lg font-bold border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] inline-flex items-center justify-center gap-2 cursor-pointer"
          data-testid="splash-start"
        >
          <Play className="w-5 h-5 fill-current" aria-hidden="true" /> Zaczynamy
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full min-h-[44px] rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface-muted)] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <MapIcon className="w-4 h-4" aria-hidden="true" /> Pokaż całą ścieżkę
        </button>
      </div>
    </div>
  );
}
