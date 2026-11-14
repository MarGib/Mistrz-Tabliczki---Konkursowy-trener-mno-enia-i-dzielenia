/**
 * Ścieżka Mistrza z kropkami: moduły (dawne etapy) w dwóch ligach, a w wybranym module krótka ścieżka
 * 3–5 kropek od najłatwiejszej do testu modułu. Bez żyć, bez kar — kropki można powtarzać do woli.
 */
import { Check, Lock, Play, Sparkles, Star, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LEVEL_STAGES } from '../data/curriculum';
import { KIND_META } from '../data/path';
import { stageToConfig } from '../engine/nextStep';
import { type ModuleView, SUGGESTED_LESSONS_PER_DAY, allModules, lessonToConfig, lessonsDoneToday } from '../engine/path';
import type { ActiveSeriesConfig, UserProfile } from '../types/math';

interface StagePathProps {
  profile: UserProfile;
  onStart: (config: ActiveSeriesConfig) => void;
}

const LEAGUES = [
  { id: 'podstawy', label: 'Podstawy', hint: 'tabliczka do 100', from: 1, to: 6 },
  { id: 'liga', label: '👑 Liga Mistrzów', hint: 'ponad 100', from: 7, to: 99 },
] as const;

function stageOf(id: string) {
  return LEVEL_STAGES.find((s) => s.id === id)!;
}

export function StagePath({ profile, onStart }: StagePathProps) {
  const modules = useMemo(() => allModules(profile), [profile]);
  const current = modules.find((m) => m.open && !m.done) ?? modules[modules.length - 1];
  const doneCount = modules.filter((m) => m.done).length;
  const [league, setLeague] = useState<string>(stageOf(current.stageId).order >= 7 ? 'liga' : 'podstawy');
  const [picked, setPicked] = useState<string | null>(null);
  const lg = LEAGUES.find((l) => l.id === league) ?? LEAGUES[0];
  const inLeague = modules.filter((m) => {
    const o = stageOf(m.stageId).order;
    return o >= lg.from && o <= lg.to;
  });
  const selected =
    inLeague.find((m) => m.stageId === picked) ??
    inLeague.find((m) => m.stageId === current.stageId) ??
    inLeague.find((m) => m.open && !m.done) ??
    inLeague[0];
  const today = lessonsDoneToday(profile.sessions);

  return (
    <div className="space-y-3" data-testid="stage-path">
      {/* Postęp całej ścieżki */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 rounded-full bg-[var(--th-surface-muted)] overflow-hidden border border-[var(--th-border)]">
          <div className="h-full rounded-full bg-[var(--th-primary)] transition-all" style={{ width: `${Math.round((doneCount / modules.length) * 100)}%` }} />
        </div>
        <span className="text-xs font-bold tabular-nums text-[var(--th-text-muted)] shrink-0">
          {doneCount} / {modules.length} modułów
        </span>
      </div>

      {/* Ligi */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--th-surface-muted)] border border-[var(--th-border)]" role="tablist">
        {LEAGUES.map((l) => {
          const mods = modules.filter((m) => {
            const o = stageOf(m.stageId).order;
            return o >= l.from && o <= l.to;
          });
          const active = l.id === league;
          return (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setLeague(l.id);
                setPicked(null);
              }}
              className={`min-h-[44px] px-2 rounded-xl text-sm font-bold leading-tight cursor-pointer transition-colors ${
                active ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-sm' : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
              }`}
            >
              {l.label}
              <span className="block text-[11px] font-semibold text-[var(--th-text-muted)] tabular-nums">
                {l.hint} · {mods.filter((m) => m.done).length}/{mods.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Moduły ligi — małe kafelki */}
      <div className="flex flex-wrap gap-1.5" data-testid="module-chips">
        {inLeague.map((m) => {
          const st = stageOf(m.stageId);
          const sel = m.stageId === selected.stageId;
          return (
            <button
              key={m.stageId}
              type="button"
              onClick={() => setPicked(m.stageId)}
              aria-pressed={sel}
              title={st.title}
              className={`min-h-[40px] min-w-[52px] px-2.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer tabular-nums ${
                sel
                  ? 'border-[var(--th-primary)] bg-[var(--th-soft-tint)] text-[var(--th-text)]'
                  : m.done
                    ? 'border-[var(--th-soft-tint-border)] bg-[var(--th-surface)] text-[var(--th-primary)]'
                    : m.open
                      ? 'border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)]'
                      : 'border-[var(--th-border)] bg-[var(--th-surface-muted)] text-[var(--th-text-muted)]'
              }`}
            >
              {st.id === 'stage-bridge' ? '🌉' : st.order >= 8 ? st.order - 1 : st.order}
              {m.done ? <Check className="w-3.5 h-3.5" aria-label="ukończony" /> : m.open ? <span className="opacity-70">{m.doneCount}/{m.total}</span> : <Lock className="w-3 h-3" aria-label="zablokowany" />}
            </button>
          );
        })}
      </div>

      <ModulePath module={selected} profile={profile} onStart={onStart} />

      {today >= SUGGESTED_LESSONS_PER_DAY && (
        <p className="rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-950 px-3 py-2.5 text-sm font-semibold" data-testid="enough-today">
          🌙 Dziś już {today} nowe kropki — super robota! Mózg najlepiej utrwala wiedzę we śnie. Możesz grać dalej albo wrócić jutro.
        </p>
      )}
    </div>
  );
}

function ModulePath({ module: m, profile, onStart }: { module: ModuleView; profile: UserProfile; onStart: (c: ActiveSeriesConfig) => void }) {
  const st = stageOf(m.stageId);
  const nextIdx = m.lessons.findIndex((l) => l.state === 'open');
  const testIsNext = m.testState === 'open' && !m.done;
  const dots = [
    ...m.lessons.map((l, i) => ({
      key: l.def.id,
      label: l.def.title,
      kind: KIND_META[l.def.kind],
      state: l.state,
      stars: l.stars,
      current: i === nextIdx,
      start: () => onStart(lessonToConfig(l.def, profile.memories)),
    })),
    {
      key: 'test',
      label: `Test modułu: ${st.taskCount} zadań, próg ${st.passAccuracyPct}%`,
      kind: { emoji: '🏆', label: 'Test modułu' },
      state: m.testState,
      stars: 0,
      current: testIsNext,
      start: () => onStart(stageToConfig(st)),
    },
  ];

  return (
    <div className="rounded-3xl border border-[var(--th-border)] bg-[var(--th-surface)] p-4 sm:p-5 space-y-3" data-testid="module-path">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--th-primary)]">
            {st.id === 'stage-bridge' ? 'Moduł przejściowy' : `Moduł ${st.order >= 8 ? st.order - 1 : st.order}`}
            {m.done && ' · ukończony'}
          </p>
          <h3 className="font-display text-lg font-extrabold leading-snug">{st.title}</h3>
          <p className="text-sm text-[var(--th-text-muted)]">{st.subtitle}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-bold tabular-nums text-[var(--th-text-muted)]">
            {m.doneCount}/{m.total}
          </p>
          {m.maxStars > 0 && (
            <p className="text-xs font-bold tabular-nums text-amber-600 inline-flex items-center gap-0.5">
              <Star className="w-3.5 h-3.5 fill-current" aria-hidden="true" /> {m.stars}/{m.maxStars}
              {m.stars === m.maxStars && <span title="Korona modułu">👑</span>}
            </p>
          )}
        </div>
      </div>

      {/* Ścieżka kropek — zygzak */}
      <ol className="relative space-y-2.5 py-1">
        {dots.map((d, i) => {
          const offset = ['ml-0', 'ml-8 sm:ml-14', 'ml-14 sm:ml-24', 'ml-8 sm:ml-14'][i % 4];
          const locked = d.state === 'locked';
          const done = d.state === 'done';
          return (
            <li key={d.key} className={`flex items-center gap-3 scroll-mt-24 ${offset}`} data-current-dot={d.current ? '1' : undefined}>
              <button
                type="button"
                disabled={locked}
                onClick={d.start}
                aria-label={`${d.kind.label}: ${d.label}${done ? ' (zaliczona)' : locked ? ' (zablokowana)' : ''}`}
                data-testid={d.key === 'test' ? 'dot-test' : 'dot'}
                data-state={d.state}
                className={`relative w-16 h-16 rounded-full shrink-0 flex items-center justify-center text-2xl border-b-[5px] transition-transform cursor-pointer disabled:cursor-not-allowed [touch-action:manipulation] ${
                  done
                    ? 'bg-[var(--th-primary)] border-[var(--th-primary-dark)] text-[var(--th-primary-fg)]'
                    : locked
                      ? 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text-muted)]'
                      : 'bg-amber-400 border-amber-600 text-amber-950 hover:scale-105'
                } ${d.current ? 'ring-4 ring-amber-300 animate-pulse' : ''}`}
              >
                {locked ? <Lock className="w-6 h-6" aria-hidden="true" /> : d.key === 'test' ? <Trophy className="w-7 h-7" aria-hidden="true" /> : <span aria-hidden="true">{d.kind.emoji}</span>}
              </button>
              <div className="min-w-0">
                <p className={`text-sm font-bold leading-tight ${locked ? 'text-[var(--th-text-muted)]' : ''}`}>{d.label}</p>
                <p className="text-xs text-[var(--th-text-muted)]">
                  {d.kind.label}
                  {done && d.key !== 'test' && (
                    <span className="ml-1 text-amber-500 tracking-wider" aria-label={`${d.stars} z 3 gwiazdek`}>
                      {'★'.repeat(d.stars)}
                      <span className="text-[var(--th-border)]">{'★'.repeat(3 - d.stars)}</span>
                    </span>
                  )}
                </p>
                {d.current && (
                  <button type="button" onClick={d.start} className="mt-1 min-h-[36px] px-3 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer">
                    <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" /> Start
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {m.open && !m.done && m.testState === 'locked' && (
        <button
          type="button"
          onClick={() => onStart(stageToConfig(st))}
          className="w-full min-h-[44px] rounded-2xl border border-dashed border-[var(--th-primary)] text-sm font-bold text-[var(--th-primary)] inline-flex items-center justify-center gap-1.5 cursor-pointer"
          data-testid="skip-to-test"
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" /> Znam to — sprawdź mnie (od razu test modułu)
        </button>
      )}
      {!m.open && <p className="text-sm text-[var(--th-text-muted)]">🔒 Otworzy się po ukończeniu poprzedniego modułu.</p>}
    </div>
  );
}
