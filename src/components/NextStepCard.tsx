import { Flame, Infinity as InfinityIcon, Map as MapIcon, Play } from 'lucide-react';
import type { NextStep } from '../engine/nextStep';
import type { ActiveSeriesConfig } from '../types/math';

const ICON = { review: Flame, stage: MapIcon, master: InfinityIcon } as const;
const KIND_LABEL = { review: 'Najpierw utrwalamy', stage: 'Następna kropka', master: 'Gramy dalej' } as const;

/** Jeden duży przycisk „Graj dalej” — aplikacja sama wybiera najlepszy następny krok. */
export function NextStepCard({ step, onStart }: { step: NextStep; onStart: (c: ActiveSeriesConfig) => void }) {
  const Icon = ICON[step.kind];
  return (
    <button
      type="button"
      onClick={() => onStart(step.config)}
      data-testid="next-step"
      data-tour="next-step"
      className="group w-full text-left rounded-3xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] border-b-[6px] border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[4px] transition-all cursor-pointer px-4 py-3.5 sm:px-6 sm:py-5 flex items-center gap-3.5 shadow-md"
    >
      <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-wider opacity-85">{KIND_LABEL[step.kind]}</span>
        <span className="block font-display text-lg sm:text-xl font-extrabold leading-tight">Graj dalej</span>
        <span className="block text-xs sm:text-sm font-semibold opacity-95 truncate">{step.label}</span>
        <span className="block text-[11px] sm:text-xs opacity-80 truncate">{step.detail}</span>
      </span>
      <span className="w-11 h-11 rounded-full bg-white text-[var(--th-primary)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
        <Play className="w-5 h-5 fill-current" aria-hidden="true" />
      </span>
    </button>
  );
}
