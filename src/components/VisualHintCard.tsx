import { Lightbulb, X } from 'lucide-react';
import type { VisualHintData, VisualHintPart } from '../types/math';

interface VisualHintCardProps {
  hint: VisualHintData;
  isAutoTriggered?: boolean;
  isDark?: boolean;
  /** Zwija podpowiedź z powrotem do ikonki żarówki. */
  onCollapse?: () => void;
  /** Tryb bez nagłówka (np. pod informacją o błędnej odpowiedzi). */
  bare?: boolean;
}

/**
 * Kompaktowa podpowiedź „na jedno spojrzenie”.
 * Mieści się w stałym slocie karty zadania, więc nie przesuwa działania ani klawiatury.
 */
export function VisualHintCard({
  hint,
  isAutoTriggered = false,
  isDark = false,
  onCollapse,
  bare = false,
}: VisualHintCardProps) {
  return (
    <div className="animate-pop-in h-full flex flex-col justify-center gap-1.5" data-testid="visual-hint-card">
      {!bare && (
        <div className="flex items-center justify-between gap-2 min-h-[28px]">
          <div
            className={`flex items-center gap-1.5 min-w-0 text-xs sm:text-sm font-semibold ${
              isDark ? 'text-amber-300' : 'text-amber-800'
            }`}
          >
            <Lightbulb className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {hint.shortTip ?? hint.strategyTitle}
              {isAutoTriggered && <span className="sr-only"> (automatyczna podpowiedź)</span>}
            </span>
          </div>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Schowaj podpowiedź"
              className={`shrink-0 min-h-[44px] min-w-[44px] -my-2 -mr-2 rounded-xl flex items-center justify-center cursor-pointer ${
                isDark ? 'text-amber-200 hover:bg-amber-900/40' : 'text-amber-800 hover:bg-amber-100'
              }`}
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {hint.division ? (
        <DivisionLadder division={hint.division} isDark={isDark} />
      ) : hint.parts && hint.parts.length > 0 ? (
        <PartsRow parts={hint.parts} joiner={hint.joiner ?? '+'} isDark={isDark} />
      ) : (
        <p
          className={`font-mono text-lg sm:text-xl font-bold tabular-nums ${
            isDark ? 'text-amber-100' : 'text-slate-800'
          }`}
        >
          {hint.decompositionText}
        </p>
      )}
    </div>
  );
}

function toneClasses(tone: VisualHintPart['tone'], isDark: boolean) {
  if (tone === 'blue') {
    return isDark
      ? 'bg-blue-900/70 border-blue-400 text-blue-50'
      : 'bg-blue-100 border-blue-500 text-blue-950';
  }
  return isDark
    ? 'bg-amber-900/70 border-amber-400 text-amber-50'
    : 'bg-amber-100 border-amber-500 text-amber-950';
}

function PartBlock({ part, isDark, grow }: { part: VisualHintPart; isDark: boolean; grow: number }) {
  return (
    <div
      className={`min-w-[68px] sm:min-w-[84px] rounded-xl border-2 px-2 py-1 flex flex-col items-center justify-center leading-none ${toneClasses(
        part.tone,
        isDark
      )}`}
      style={{ flexGrow: grow, flexBasis: 0 }}
    >
      <span className="text-[11px] sm:text-xs font-semibold opacity-80 tabular-nums whitespace-nowrap">
        {part.label}
      </span>
      <span className="font-display text-2xl sm:text-3xl font-extrabold tabular-nums mt-0.5">
        {part.value}
      </span>
    </div>
  );
}

function PartsRow({
  parts,
  joiner,
  isDark,
}: {
  parts: VisualHintPart[];
  joiner: '+' | '−' | 'half';
  isDark: boolean;
}) {
  const opClass = `font-display text-2xl sm:text-3xl font-extrabold shrink-0 ${
    isDark ? 'text-slate-200' : 'text-slate-700'
  }`;
  const maxValue = Math.max(...parts.map((p) => p.value), 1);

  if (joiner === 'half' || parts.length === 1) {
    return (
      <div className="flex items-stretch gap-2 w-full" aria-label="Rozkład działania">
        <PartBlock part={parts[0]} isDark={isDark} grow={1} />
        {joiner === 'half' && (
          <span className={`${opClass} self-center whitespace-nowrap`}>: 2</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-1.5 sm:gap-2 w-full" aria-label="Rozkład działania">
      {parts.map((part, idx) => (
        <div key={part.label} className="contents">
          {idx > 0 && <span className={`${opClass} self-center`}>{joiner}</span>}
          {/* Długość klocka proporcjonalna do wartości, ale z minimum na czytelny napis */}
          <PartBlock part={part} isDark={isDark} grow={Math.max(0.35, part.value / maxValue)} />
        </div>
      ))}
    </div>
  );
}

function DivisionLadder({
  division,
  isDark,
}: {
  division: NonNullable<VisualHintData['division']>;
  isDark: boolean;
}) {
  const { divisor, dividend, anchorK, anchorValue, multiples } = division;
  const chipBase =
    'shrink-0 rounded-lg border-2 px-1.5 sm:px-2 py-1 font-display text-lg sm:text-xl font-extrabold tabular-nums leading-none';
  return (
    <div className="flex flex-col gap-1.5" aria-label="Liczenie wielokrotnościami">
      <p
        className={`font-display text-xl sm:text-2xl font-extrabold tabular-nums leading-none ${
          isDark ? 'text-slate-100' : 'text-slate-900'
        }`}
      >
        {divisor} × <span className={isDark ? 'text-amber-300' : 'text-amber-600'}>?</span> = {dividend}
      </p>
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-hidden">
        {anchorK > 0 && (
          <span className={`${chipBase} ${toneClasses('blue', isDark)}`}>
            <span className="text-[11px] font-semibold opacity-80 mr-1">{anchorK}×</span>
            {anchorValue}
          </span>
        )}
        {multiples.map((m) => (
          <span
            key={m}
            className={`${chipBase} ${
              m === dividend
                ? toneClasses('amber', isDark)
                : isDark
                ? 'bg-slate-800 border-slate-600 text-slate-100'
                : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
