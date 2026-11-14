import { useMemo, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  Play,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { computeFamilySummary } from '../engine/familyStats';
import {
  getDifficultFacts,
  getDueFactCount,
  getSlowestFacts,
} from '../engine/spacedRepetition';
import type { ActiveSeriesConfig, FactMemory, UserProfile } from '../types/math';
import { AvatarDisplay } from './AvatarDisplay';
import { ProgressTrendChart } from './ProgressTrendChart';

interface StatsViewProps {
  profile: UserProfile;
  profiles: UserProfile[];
  isDark?: boolean;
  onSwitchProfile: (profileId: string) => void;
  onStartFocusedDrill: (config: ActiveSeriesConfig) => void;
}

const MASTERY_LABELS: Record<FactMemory['mastery'], string> = {
  nowe: 'Nowe',
  trudne: 'Trudne',
  w_trakcie: 'W trakcie',
  opanowane: 'Opanowane',
  mistrzowskie: 'Na wyrywki',
};

export function StatsView({
  profile,
  profiles,
  isDark = false,
  onSwitchProfile,
  onStartFocusedDrill,
}: StatsViewProps) {
  const [matrixFilter, setMatrixFilter] = useState<'all' | 'difficult'>('all');

  const familySummary = useMemo(() => computeFamilySummary(profiles), [profiles]);

  const memoriesList = useMemo(
    () => Object.values(profile.memories).filter((m) => m.attempts > 0),
    [profile.memories]
  );

  const difficultFacts = useMemo(
    () => getDifficultFacts(profile.memories, 10),
    [profile.memories]
  );
  const slowestFacts = useMemo(
    () => getSlowestFacts(profile.memories, 8),
    [profile.memories]
  );

  const dueCount = getDueFactCount(profile.memories);

  const masteredCount = memoriesList.filter(
    (m) => m.mastery === 'opanowane' || m.mastery === 'mistrzowskie'
  ).length;

  const avgTimeMs =
    memoriesList.length > 0
      ? Math.round(
          memoriesList.reduce((sum, m) => sum + m.avgTimeMs, 0) / memoriesList.length
        )
      : 0;

  const totalAttempts = memoriesList.reduce((sum, m) => sum + m.attempts, 0);
  const totalCorrect = memoriesList.reduce((sum, m) => sum + m.correctCount, 0);
  const overallAccuracy =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const recentSessions = profile.sessions.slice(-10);

  const handleDrillHard = () => {
    const ids = difficultFacts.slice(0, 8).map((m) => m.id);
    if (ids.length === 0) return;
    onStartFocusedDrill({
      title: 'Trening najtrudniejszych działań',
      mode: 'mixed',
      maxRange: profile.settings.maxRange,
      taskCount: Math.max(8, ids.length),
      focusFactIds: ids,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--th-text)]">
            Statystyki Rodziny i Pamięć SuperMemo
          </h1>
          <p className="mt-1 text-sm sm:text-base text-[var(--th-text-muted)]">
            Zobacz, jak idzie całej rodzinie ({profiles.map((p) => p.name).join(', ')}), porównuj szybkość na wykresie i ćwicz najtrudniejsze działania.
          </p>
        </div>
        {difficultFacts.length > 0 && (
          <button
            type="button"
            onClick={handleDrillHard}
            className="min-h-[46px] px-5 py-2.5 rounded-2xl bg-[var(--th-accent)] hover:bg-[var(--th-accent-hover)] text-[var(--th-accent-fg)] font-bold text-sm border-b-4 border-[var(--th-accent-dark)] active:border-b-2 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            <span>Przećwicz najtrudniejsze ({Math.min(8, difficultFacts.length)})</span>
          </button>
        )}
      </div>

      {/* Whole-Family Mutual Leaderboard & Aggregate Metrics */}
      <section
        aria-labelledby="family-stats-heading"
        className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-6 space-y-5"
        data-testid="family-stats-section"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[var(--th-border)]">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[var(--th-primary)]" aria-hidden="true" />
            <div>
              <h2
                id="family-stats-heading"
                className="font-display text-xl font-bold text-[var(--th-text)]"
              >
                Statystyki Całej Rodziny ({profiles.length} graczy)
              </h2>
              <p className="text-xs text-[var(--th-text-muted)]">
                Wszyscy widzą swoje postępy wzajemnie — przełącz profil jednym kliknięciem i pobij rodzinny rekord!
              </p>
            </div>
          </div>

          {familySummary.fastestMember && (
            <div className="text-xs font-bold text-[var(--th-primary)] tabular-nums">
              Najszybszy refleks: {familySummary.fastestMember.name} (
              {familySummary.fastestMember.avgTimeSec?.toFixed(2).replace('.', ',')} s)
            </div>
          )}
        </div>

        {/* 4 Collective Family KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-4">
            <div className="text-xs font-semibold text-[var(--th-text-muted)]">
              Łączne punkty rodziny
            </div>
            <div className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[var(--th-text)] tabular-nums">
              {familySummary.totalXp} XP
            </div>
            <div className="text-xs text-[var(--th-text-muted)]">
              Lider: {familySummary.xpLeader?.name ?? '—'}
            </div>
          </div>

          <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-4">
            <div className="text-xs font-semibold text-[var(--th-text-muted)]">
              Rozwiązane zadania razem
            </div>
            <div className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[var(--th-text)] tabular-nums">
              {familySummary.totalSolvedTasks}
            </div>
            <div className="text-xs text-[var(--th-text-muted)] tabular-nums">
              W {familySummary.totalSessions} seriach treningowych
            </div>
          </div>

          <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-4">
            <div className="text-xs font-semibold text-[var(--th-text-muted)]">
              Średnia celność rodziny
            </div>
            <div className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[var(--th-text)] tabular-nums">
              {familySummary.familyAvgAccuracyPct}%
            </div>
            <div className="text-xs text-[var(--th-text-muted)]">
              Najcelniej: {familySummary.mostAccurateMember?.name ?? '—'}
            </div>
          </div>

          <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-4">
            <div className="text-xs font-semibold text-[var(--th-text-muted)]">
              Średnie tempo rodziny
            </div>
            <div className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[var(--th-text)] tabular-nums">
              {familySummary.familyAvgTimeSec !== null
                ? `${familySummary.familyAvgTimeSec.toFixed(1).replace('.', ',')} s`
                : '—'}
            </div>
            <div className="text-xs text-[var(--th-text-muted)]">Cel na wyrywki: poniżej 2,8 s</div>
          </div>
        </div>

        {/* Family Standings Cards / Table */}
        <div className="divide-y divide-[var(--th-border)] border border-[var(--th-border)] rounded-2xl overflow-hidden">
          {familySummary.members.map((member, idx) => {
            const isActive = member.profileId === profile.id;
            return (
              <div
                key={member.profileId}
                className={`p-3.5 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                  isActive ? 'bg-[var(--th-soft-tint)]' : 'bg-[var(--th-surface)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 font-display font-extrabold text-sm text-[var(--th-text-muted)] tabular-nums shrink-0">
                    {idx === 0 ? (
                      <Crown className="w-4 h-4 text-amber-500 inline" aria-label="1. miejsce" />
                    ) : (
                      `${idx + 1}.`
                    )}
                  </span>
                  <AvatarDisplay
                    avatarId={member.avatarId}
                    customSpec={member.customAvatarSpec}
                    name={member.name}
                    sizeClass="w-11 h-11"
                  />
                  <div className="min-w-0">
                    <div className="font-display font-bold text-base text-[var(--th-text)] truncate">
                      {member.name} {isActive ? '(Twój widok)' : ''}
                    </div>
                    <div className="text-xs text-[var(--th-text-muted)] tabular-nums">
                      Poziom {member.level} ({member.levelTitle}) · Seria {member.streakDays} dni
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between md:justify-end gap-x-5 gap-y-2 text-xs sm:text-sm tabular-nums">
                  <div className="text-left sm:text-right">
                    <div className="text-[11px] text-[var(--th-text-muted)]">Punkty</div>
                    <div className="font-display font-bold text-[var(--th-primary)] inline-flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                      {member.xp} XP
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-[11px] text-[var(--th-text-muted)]">Skuteczność</div>
                    <div className="font-bold text-[var(--th-text)]">
                      {member.solvedTasks > 0 ? `${member.accuracyPct}%` : 'Brak'}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-[11px] text-[var(--th-text-muted)]">Śr. czas</div>
                    <div className="font-mono font-bold text-[var(--th-text)]">
                      {member.avgTimeSec !== null
                        ? `${member.avgTimeSec.toFixed(1).replace('.', ',')} s`
                        : '—'}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-[11px] text-[var(--th-text-muted)]">Serie</div>
                    <div className="font-bold text-[var(--th-text)]">
                      {member.sessionsCount}
                    </div>
                  </div>

                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => onSwitchProfile(member.profileId)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[var(--th-surface-muted)] hover:border-[var(--th-primary)] border border-[var(--th-border)] text-xs font-bold text-[var(--th-text)] cursor-pointer whitespace-nowrap"
                    >
                      Przełącz na {member.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Active User 4-column Summary Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--th-text-muted)]">
            <span>Opanowane ({profile.name})</span>
            <CheckCircle2 className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-[var(--th-text)] tabular-nums">
            {masteredCount}
          </div>
          <p className="mt-1 text-xs text-[var(--th-text-muted)]">
            z {memoriesList.length} przećwiczonych faktów
          </p>
        </div>

        <div className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--th-text-muted)]">
            <span>Średni czas ({profile.name})</span>
            <Clock className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-[var(--th-text)] tabular-nums">
            {avgTimeMs > 0 ? `${(avgTimeMs / 1000).toFixed(1).replace('.', ',')} s` : '—'}
          </div>
          <p className="mt-1 text-xs text-[var(--th-text-muted)]">Cel na wyrywki: poniżej 2,8 s</p>
        </div>

        <div className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--th-text-muted)]">
            <span>Skuteczność ({profile.name})</span>
            <TrendingUp className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-[var(--th-text)] tabular-nums">
            {overallAccuracy}%
          </div>
          <p className="mt-1 text-xs text-[var(--th-text-muted)] tabular-nums">
            {totalCorrect} poprawnych z {totalAttempts} prób
          </p>
        </div>

        <div className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--th-text-muted)]">
            <span>Kolejka SuperMemo</span>
            <Brain className="w-4 h-4 text-[var(--th-accent)]" aria-hidden="true" />
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-[var(--th-text)] tabular-nums">
            {dueCount}
          </div>
          <p className="mt-1 text-xs text-[var(--th-text-muted)]">Działań gotowych do utrwalenia</p>
        </div>
      </section>

      {/* Historical Progress Chart + Slowest/Hardest Facts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Progress Over Recent Sessions (Recharts) */}
        <section className="lg:col-span-7 bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-[var(--th-text)]">
            Tendencja szybkości i skuteczności całej rodziny
          </h2>
          <p className="text-sm text-[var(--th-text-muted)] mb-4">
            Porównuj średni czas odpowiedzi w kolejnych seriach dla poszczególnych członków rodziny.
          </p>

          <ProgressTrendChart
            profiles={profiles}
            activeProfileId={profile.id}
            isDark={isDark}
          />

          {recentSessions.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[var(--th-border)] space-y-2.5">
              <h3 className="text-xs font-bold text-[var(--th-text-muted)]">
                Ostatnie ukończone serie ({profile.name})
              </h3>
              {recentSessions.slice(-4).reverse().map((sess) => {
                const avgSec = (sess.avgTimeMs / 1000).toFixed(1).replace('.', ',');
                return (
                  <div
                    key={sess.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-2xl bg-[var(--th-surface-muted)] border border-[var(--th-border)]"
                  >
                    <div className="sm:w-48 min-w-0">
                      <div className="text-xs font-semibold text-[var(--th-text-muted)] tabular-nums">
                        {new Date(sess.timestamp).toLocaleDateString('pl-PL')} · {sess.totalTasks} zadań
                      </div>
                      <div className="font-semibold text-sm text-[var(--th-text)] truncate">
                        {sess.seriesTitle}
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs font-semibold mb-1 tabular-nums">
                        <span className="text-[var(--th-primary)]">Skuteczność: {sess.accuracyPct}%</span>
                        <span className="text-[var(--th-text-muted)]">Śr. czas: {avgSec} s</span>
                      </div>
                      <div className="h-2 bg-[var(--th-border)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--th-primary)] rounded-full"
                          style={{ width: `${sess.accuracyPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Hardest & Slowest Facts List */}
        <section className="lg:col-span-5 bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-display text-lg font-bold text-[var(--th-text)]">
              Nad czym najdłużej się zastanawiasz?
            </h2>
          </div>
          <p className="text-sm text-[var(--th-text-muted)] mb-4">
            Zadania posortowane według czasu namysłu i błędów ({profile.name}).
          </p>

          {slowestFacts.length === 0 ? (
            <div className="py-10 text-center bg-[var(--th-surface-muted)] rounded-2xl border border-[var(--th-border)] text-sm text-[var(--th-text-muted)]">
              Brak zmierzonych zadań — zacznij trening, aby odkryć najtrudniejsze pary liczb.
            </div>
          ) : (
            <div className="divide-y divide-[var(--th-border)] border border-[var(--th-border)] rounded-2xl overflow-hidden">
              {slowestFacts.map((fact) => {
                const eq =
                  fact.op === 'mul'
                    ? `${fact.a} × ${fact.b} = ${fact.answer}`
                    : `${fact.a} ÷ ${fact.b} = ${fact.answer}`;
                return (
                  <div
                    key={fact.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 bg-[var(--th-surface)] text-sm"
                  >
                    <div>
                      <div className="font-display font-bold text-base text-[var(--th-text)] tabular-nums">
                        {eq}
                      </div>
                      <div className="text-xs text-[var(--th-text-muted)] tabular-nums">
                        {MASTERY_LABELS[fact.mastery]} · Błędów: {fact.wrongCount}/{fact.attempts}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-xs sm:text-sm font-bold text-[var(--th-text)] bg-[var(--th-surface-muted)] border border-[var(--th-border)] px-2.5 py-1 rounded-lg tabular-nums">
                        {(fact.avgTimeMs / 1000).toFixed(1).replace('.', ',')} s
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onStartFocusedDrill({
                            title: `Szlifowanie: ${eq}`,
                            mode: fact.op,
                            maxRange: profile.settings.maxRange,
                            taskCount: 8,
                            focusFactIds: [fact.id],
                          })
                        }
                        aria-label={`Ćwicz działanie ${eq}`}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[var(--th-soft-tint)] hover:opacity-90 text-[var(--th-primary)] text-xs font-bold cursor-pointer transition-colors"
                      >
                        Ćwicz
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Interactive 10x10 Multiplication Mastery Matrix */}
      <section className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--th-text)]">
              Mapa Mistrzostwa Tabliczki Mnożenia (2–10) · {profile.name}
            </h2>
            <p className="text-sm text-[var(--th-text-muted)]">
              Kliknij dowolne pole, aby przećwiczyć wybrane działanie w serii powtórkowej.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-xl self-start">
            <button
              type="button"
              onClick={() => setMatrixFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                matrixFilter === 'all'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-sm'
                  : 'text-[var(--th-text-muted)]'
              }`}
            >
              Wszystkie
            </button>
            <button
              type="button"
              onClick={() => setMatrixFilter('difficult')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                matrixFilter === 'difficult'
                  ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-sm'
                  : 'text-[var(--th-text-muted)]'
              }`}
            >
              Tylko trudne
            </button>
          </div>
        </div>

        {/* Accessible Text + Color Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[var(--th-text-muted)] mb-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Na wyrywki
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Opanowane
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-400 inline-block" /> W trakcie
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-500 inline-block" /> Trudne
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-300 inline-block" /> Jeszcze niećwiczone
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[540px] grid grid-cols-10 gap-1.5">
            <div className="h-9 flex items-center justify-center font-mono text-xs font-bold text-[var(--th-text-muted)]">
              ×
            </div>
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((col) => (
              <div
                key={`hdr-${col}`}
                className="h-9 flex items-center justify-center font-display text-sm font-bold text-[var(--th-text-muted)]"
              >
                {col}
              </div>
            ))}

            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((row) => (
              <div key={`row-${row}`} className="contents">
                <div className="h-10 flex items-center justify-center font-display text-sm font-bold text-[var(--th-text-muted)]">
                  {row}
                </div>
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((col) => {
                  const id = `mul:${row}x${col}`;
                  const mem = profile.memories[id];
                  const mastery = mem?.mastery ?? 'nowe';
                  const dimmed =
                    matrixFilter === 'difficult' &&
                    mastery !== 'trudne' &&
                    mastery !== 'w_trakcie';

                  const colorMap: Record<FactMemory['mastery'], string> = {
                    mistrzowskie: 'bg-emerald-500 text-white hover:bg-emerald-600',
                    opanowane: 'bg-blue-500 text-white hover:bg-blue-600',
                    w_trakcie: 'bg-amber-300 text-amber-950 hover:bg-amber-400',
                    trudne: 'bg-red-500 text-white hover:bg-red-600',
                    nowe: 'bg-[var(--th-surface-muted)] text-[var(--th-text-muted)] border border-[var(--th-border)] hover:opacity-80',
                  };

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        onStartFocusedDrill({
                          title: `Trening pola ${row} × ${col}`,
                          mode: 'mixed',
                          maxRange: Math.max(100, profile.settings.maxRange),
                          taskCount: 8,
                          focusFactIds: [id, `div:${row * col}/${row}`],
                        })
                      }
                      title={`${row} × ${col} = ${row * col} (${MASTERY_LABELS[mastery]})`}
                      className={`h-10 rounded-lg font-mono text-xs font-bold tabular-nums transition-all cursor-pointer ${
                        colorMap[mastery]
                      } ${dimmed ? 'opacity-25' : 'opacity-100'}`}
                    >
                      {row * col}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
