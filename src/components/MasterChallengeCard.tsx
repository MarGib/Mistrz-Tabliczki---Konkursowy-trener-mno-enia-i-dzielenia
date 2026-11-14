import { ChevronRight, Crosshair, Gauge, Hash, Infinity as InfinityIcon, Sparkles } from 'lucide-react';
import { HelpButton } from '../help/HelpButton';
import { useMemo } from 'react';
import { buildMasterChallenge } from '../engine/masterChallenge';
import type { ActiveSeriesConfig, UserProfile } from '../types/math';

interface MasterChallengeCardProps {
  profile: UserProfile;
  pathDone: boolean;
  onStart: (config: ActiveSeriesConfig) => void;
}

/** Karta „Wyzwanie Mistrza” — poziomy bez końca, dopasowane do tempa gracza. */
export function MasterChallengeCard({ profile, pathDone, onStart }: MasterChallengeCardProps) {
  const ch = useMemo(() => buildMasterChallenge(profile), [profile]);
  const done = profile.masterLevel ?? 0;

  return (
    <div
      className="rounded-3xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, color-mix(in oklab, #7C3AED 80%, var(--th-primary)), color-mix(in oklab, #DB2777 65%, var(--th-primary)))',
      }}
      data-testid="master-challenge"
    >
      <InfinityIcon
        className="absolute -right-6 -bottom-8 w-40 h-40 opacity-10 pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-85 inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            {pathDone ? 'Ścieżka ukończona — gramy dalej!' : 'Bez końca · dopasowane do Ciebie'}
            <HelpButton
              section="master"
              label="Wyzwanie Mistrza"
              className="!min-w-[28px] !min-h-[28px] -my-1 !text-white/85 hover:!text-white"
            />
          </p>
          <h3 className="mt-1 font-display text-xl sm:text-2xl font-extrabold">
            Wyzwanie Mistrza — poziom {ch.level}
          </h3>
          <p className="mt-1 text-sm opacity-95">
            {ch.modeLabel} do {ch.maxRange}. Każdy zaliczony poziom podnosi poprzeczkę: większe liczby, więcej
            zadań i szybsze tempo — liczone z Twoich wyników.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
              <Hash className="w-3.5 h-3.5" aria-hidden="true" /> {ch.taskCount} zadań
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
              <Crosshair className="w-3.5 h-3.5" aria-hidden="true" /> celność min. {ch.passAccuracyPct}%
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
              <Gauge className="w-3.5 h-3.5" aria-hidden="true" /> tempo ≤ {ch.targetAvgTimeSec.toFixed(1).replace('.', ',')} s
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
              +{ch.rewardXp} XP
            </span>
          </div>
          {done > 0 && (
            <p className="mt-2 text-xs opacity-90">Zaliczone poziomy: {done}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onStart(ch.config)}
          className="shrink-0 min-h-[48px] px-5 rounded-2xl bg-white text-[#6D28D9] font-extrabold inline-flex items-center justify-center gap-1.5 shadow-sm active:translate-y-[1px] cursor-pointer"
        >
          Podejmij wyzwanie
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
