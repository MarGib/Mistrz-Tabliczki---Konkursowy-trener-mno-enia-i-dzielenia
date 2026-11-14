/**
 * Ścieżka Mistrza w zwartej formie: dwie ligi (zakładki), duża karta „następny etap”
 * i krótka lista pozostałych etapów — zamiast długiej listy dużych kart.
 */
import { CheckCircle2, ChevronRight, Lock, Play, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LEVEL_STAGES } from '../data/curriculum';
import { stageStatus, stageToConfig } from '../engine/nextStep';
import type { ActiveSeriesConfig, LevelStage, UserProfile } from '../types/math';

interface StagePathProps {
  profile: UserProfile;
  onStart: (config: ActiveSeriesConfig) => void;
}

const LEAGUES = [
  { id: 'podstawy', label: 'Podstawy', hint: 'do 100', from: 1, to: 6 },
  { id: 'liga', label: '👑 Liga Mistrzów', hint: 'ponad 100', from: 7, to: 99 },
] as const;

function modeText(stage: LevelStage): string {
  return stage.mode === 'mul' ? 'Mnożenie' : stage.mode === 'div' ? 'Dzielenie' : 'Mix';
}

export function StagePath({ profile, onStart }: StagePathProps) {
  const status = useMemo(() => stageStatus(profile), [profile]);

  const next = LEVEL_STAGES.find((s) => status.get(s.id) === 'open') ?? null;
  const doneCount = LEVEL_STAGES.filter((s) => status.get(s.id) === 'done').length;
  const defaultLeague = next && next.order >= 7 ? 'liga' : doneCount >= 6 ? 'liga' : 'podstawy';
  const [league, setLeague] = useState<string>(defaultLeague);
  const current = LEAGUES.find((l) => l.id === league) ?? LEAGUES[0];
  const stages = LEVEL_STAGES.filter((s) => s.order >= current.from && s.order <= current.to);
  const featured = next && stages.includes(next) ? next : null;
  const pct = Math.round((doneCount / LEVEL_STAGES.length) * 100);

  return (
    <div className="space-y-3">
      {/* Postęp całej ścieżki */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 rounded-full bg-[var(--th-surface-muted)] overflow-hidden border border-[var(--th-border)]">
          <div className="h-full rounded-full bg-[var(--th-primary)] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-bold tabular-nums text-[var(--th-text-muted)] shrink-0">
          {doneCount} / {LEVEL_STAGES.length} etapów
        </span>
      </div>

      {/* Zakładki lig */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--th-surface-muted)] border border-[var(--th-border)]" role="tablist">
        {LEAGUES.map((l) => {
          const inLeague = LEVEL_STAGES.filter((s) => s.order >= l.from && s.order <= l.to);
          const d = inLeague.filter((s) => status.get(s.id) === 'done').length;
          const active = l.id === league;
          return (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setLeague(l.id)}
              className={`min-h-[44px] px-2 rounded-xl text-sm font-bold leading-tight cursor-pointer transition-colors ${
                active
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-sm'
                  : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              {l.label}
              <span className="block text-[11px] font-semibold text-[var(--th-text-muted)] tabular-nums">
                {l.hint} · {d}/{inLeague.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Następny etap — duża karta */}
      {featured && (
        <div className="rounded-2xl border-2 border-[var(--th-primary)] bg-[var(--th-surface)] p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--th-primary)]">
              Następny etap · {featured.order}
            </p>
            <h3 className="font-display text-lg font-extrabold text-[var(--th-text)] leading-snug">{featured.title}</h3>
            <p className="text-sm text-[var(--th-text-muted)]">{featured.subtitle}</p>
            <p className="mt-1 text-xs font-semibold text-[var(--th-text-muted)] tabular-nums">
              {featured.taskCount} zadań · próg {featured.passAccuracyPct}% · +{featured.rewardXp} XP
            </p>
          </div>
          <button
            type="button"
            onClick={() => onStart(stageToConfig(featured))}
            className="shrink-0 min-h-[48px] px-5 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-bold inline-flex items-center justify-center gap-1.5 border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] cursor-pointer"
          >
            <Play className="w-4 h-4" aria-hidden="true" /> Graj
          </button>
        </div>
      )}

      {/* Zwarta lista etapów ligi */}
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {stages
          .filter((s) => s !== featured)
          .map((stage) => {
            const st = status.get(stage.id);
            const done = st === 'done';
            const locked = st === 'locked';
            return (
              <li key={stage.id}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onStart(stageToConfig(stage))}
                  className={`w-full min-h-[56px] px-3 py-2 rounded-2xl border text-left flex items-center gap-3 transition-colors ${
                    done
                      ? 'bg-[var(--th-soft-tint)] border-[var(--th-soft-tint-border)] cursor-pointer hover:border-[var(--th-primary)]'
                      : locked
                      ? 'bg-[var(--th-surface-muted)] border-[var(--th-border)] opacity-65 cursor-not-allowed'
                      : 'bg-[var(--th-surface)] border-[var(--th-border)] cursor-pointer hover:border-[var(--th-primary)]'
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0 font-display font-extrabold text-sm ${
                      done
                        ? 'bg-[var(--th-primary)] text-[var(--th-primary-fg)]'
                        : 'bg-[var(--th-surface-muted)] text-[var(--th-text-muted)] border border-[var(--th-border)]'
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-5 h-5" aria-label="zaliczony" /> : stage.order}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[var(--th-text)] truncate">{stage.title}</span>
                    <span className="block text-xs text-[var(--th-text-muted)] truncate">
                      {modeText(stage)} do {stage.maxRange} · {stage.taskCount} zad. · próg {stage.passAccuracyPct}%
                    </span>
                  </span>
                  {locked ? (
                    <Lock className="w-4 h-4 text-[var(--th-text-muted)] shrink-0" aria-label="zablokowany" />
                  ) : done ? (
                    <RotateCcw className="w-4 h-4 text-[var(--th-text-muted)] shrink-0" aria-label="powtórz" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
      </ul>
      {current.id === 'podstawy' && doneCount >= 6 && (
        <button
          type="button"
          onClick={() => setLeague('liga')}
          className="w-full min-h-[44px] rounded-2xl border border-dashed border-[var(--th-primary)] text-sm font-bold text-[var(--th-primary)] cursor-pointer"
        >
          Podstawy zaliczone — przejdź do Ligi Mistrzów →
        </button>
      )}
    </div>
  );
}
