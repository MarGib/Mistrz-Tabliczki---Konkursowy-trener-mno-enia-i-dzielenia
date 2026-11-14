import { Lightbulb } from 'lucide-react';
import type { VisualHintData } from '../types/math';

interface VisualHintCardProps {
  hint: VisualHintData;
  isAutoTriggered?: boolean;
  isDark?: boolean;
}

export function VisualHintCard({
  hint,
  isAutoTriggered = false,
  isDark = false,
}: VisualHintCardProps) {
  const showDotGrid = hint.rows <= 10 && hint.cols <= 12;

  return (
    <div
      className={`animate-pop-in rounded-2xl p-3.5 sm:p-5 border ${
        isDark
          ? 'bg-amber-950/35 border-amber-700/60 text-amber-50'
          : 'bg-amber-50/90 border-amber-200 text-slate-800'
      }`}
      data-testid="visual-hint-card"
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center shrink-0 ${
            isDark
              ? 'bg-amber-900/60 border-amber-700 text-amber-300'
              : 'bg-amber-100 border-amber-200 text-amber-700'
          }`}
        >
          <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold ${
              isDark ? 'text-amber-300' : 'text-amber-800'
            }`}
          >
            <span>{hint.strategyTitle}</span>
            {isAutoTriggered && (
              <>
                <span aria-hidden="true">·</span>
                <span>Automatyczna wskazówka</span>
              </>
            )}
          </div>
          <p
            className={`mt-1 text-xs sm:text-base font-medium leading-snug ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            {hint.mnemonic}
          </p>
          <p
            className={`mt-1.5 font-mono text-xs sm:text-sm font-semibold rounded-lg px-2.5 py-1 inline-block tabular-nums border ${
              isDark
                ? 'bg-slate-900/70 border-amber-700/50 text-amber-200'
                : 'bg-white/80 border-amber-200/80 text-slate-700'
            }`}
          >
            {hint.decompositionText}
          </p>
        </div>
      </div>

      {/* Visual Grouping Diagram */}
      {showDotGrid && (
        <div
          className={`mt-3 pt-2.5 border-t ${
            isDark ? 'border-amber-700/40' : 'border-amber-200/70'
          }`}
        >
          {hint.visualType === 'array_split' ? (
            <div className="flex flex-col gap-1 items-start">
              {Array.from({ length: hint.rows }).map((_, rIdx) => {
                const isSecondPart = hint.splitRow !== undefined && rIdx >= hint.splitRow;
                return (
                  <div
                    key={rIdx}
                    className={`flex items-center gap-1 ${
                      hint.splitRow === rIdx
                        ? `mt-1 pt-1 border-t border-dashed ${
                            isDark ? 'border-amber-600/60' : 'border-amber-300'
                          }`
                        : ''
                    }`}
                  >
                    {Array.from({ length: hint.cols }).map((__, cIdx) => (
                      <span
                        key={cIdx}
                        className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-sm transition-transform ${
                          isSecondPart
                            ? 'bg-amber-500 border border-amber-600/30'
                            : 'bg-blue-500 border border-blue-600/30'
                        }`}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: hint.groupCount ?? 2 }).map((_, gIdx) => (
                <div
                  key={gIdx}
                  className={`border rounded-lg px-2 py-1.5 flex items-center gap-1 ${
                    isDark
                      ? 'bg-slate-900/70 border-amber-700/50'
                      : 'bg-white border-amber-200'
                  }`}
                  title={`Koszyk ${gIdx + 1}`}
                >
                  {Array.from({ length: Math.min(hint.groupSize ?? 2, 10) }).map((__, dIdx) => (
                    <span
                      key={dIdx}
                      className="w-2.5 h-2.5 rounded-full bg-emerald-500"
                    />
                  ))}
                  {(hint.groupSize ?? 0) > 10 && (
                    <span
                      className={`text-[11px] font-mono ${
                        isDark ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      +{(hint.groupSize ?? 0) - 10}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className={`mt-2 text-xs ${isDark ? 'text-amber-200/90' : 'text-slate-600'}`}>
            {hint.highlightNote}
          </p>
        </div>
      )}
    </div>
  );
}
