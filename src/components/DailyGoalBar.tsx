import { CheckCircle2, Target } from 'lucide-react';
import type { DailyGoalState } from '../engine/dailyGoal';

/** Cel na dziś (np. 3 serie) — jasne „na dziś wystarczy”. */
export function DailyGoalBar({ state }: { state: DailyGoalState }) {
  return (
    <div
      className={`rounded-2xl border px-3.5 py-2.5 flex items-center gap-3 ${
        state.complete ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-[var(--th-border)] bg-[var(--th-surface)]'
      }`}
      data-testid="daily-goal"
    >
      {state.complete ? (
        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" aria-hidden="true" />
      ) : (
        <Target className="w-6 h-6 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">
          {state.complete
            ? `Cel na dziś zaliczony! (${state.done} ${state.done === 1 ? 'seria' : state.done < 5 ? 'serie' : 'serii'})`
            : `Cel na dziś: ${state.done} z ${state.goal} serii`}
        </p>
        <div className="mt-1 h-2 rounded-full bg-[var(--th-surface-muted)] overflow-hidden" role="progressbar" aria-valuenow={state.done} aria-valuemin={0} aria-valuemax={state.goal}>
          <div className={`h-full rounded-full ${state.complete ? 'bg-emerald-500' : 'bg-[var(--th-primary)]'}`} style={{ width: `${Math.max(state.pct, 4)}%` }} />
        </div>
      </div>
    </div>
  );
}
