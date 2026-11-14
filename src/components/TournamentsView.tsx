import { useState } from 'react';
import { Award, Clock, Medal, Play, Target, Trophy } from 'lucide-react';
import trophyImg from '../assets/images/trophy_contest_cup_1794652990997.jpg';
import { TOURNAMENTS } from '../data/curriculum';
import type { ActiveSeriesConfig, MedalTier, UserProfile } from '../types/math';

interface TournamentsViewProps {
  profile: UserProfile;
  profiles: UserProfile[];
  onStartTournament: (config: ActiveSeriesConfig) => void;
}

const MEDAL_LABELS: Record<MedalTier, string> = {
  brak: 'Brak medalu',
  braz: 'Brązowy Medal',
  srebro: 'Srebrny Medal',
  zloto: 'Złoty Medal',
  puchar: 'Puchar Mistrza',
};

type TourneyScope = 'all' | 'group' | 'school' | 'class';

export function TournamentsView({
  profile,
  profiles,
  onStartTournament,
}: TournamentsViewProps) {
  const [selectedTourneyId, setSelectedTourneyId] = useState<string>(TOURNAMENTS[0].id);
  const [scope, setScope] = useState<TourneyScope>('all');
  const [trophyFailed, setTrophyFailed] = useState(false);

  const selectedTourney =
    TOURNAMENTS.find((t) => t.id === selectedTourneyId) ?? TOURNAMENTS[0];
  const userBest = profile.tournamentBests[selectedTourney.id];

  // Merge all group/class/school members who played this tournament + contest peers
  const groupEntries = profiles
    .map((member) => {
      const best = member.tournamentBests[selectedTourney.id];
      if (!best) return null;
      const isActive = member.id === profile.id;
      const cohort = [member.schoolName, member.className].filter(Boolean).join(' · ');
      return {
        name: isActive ? `${member.name} (Ty)` : member.name,
        scorePct: best.bestAccuracyPct,
        timeSec: best.bestTimeSec,
        city: isActive ? cohort || 'Twój wynik' : cohort || 'Grupa',
        schoolName: member.schoolName,
        className: member.className,
        isUser: isActive,
        isFamily: !isActive,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const filteredGroupEntries = groupEntries.filter((entry) => {
    if (scope === 'school' && profile.schoolName) {
      return entry.schoolName === profile.schoolName;
    }
    if (scope === 'class' && profile.schoolName && profile.className) {
      return (
        entry.schoolName === profile.schoolName &&
        entry.className === profile.className
      );
    }
    return true;
  });

  const leaderboard = [
    ...(scope === 'all'
      ? selectedTourney.simulatedPeers.map((p) => ({
          ...p,
          isUser: false,
          isFamily: false,
        }))
      : []),
    ...filteredGroupEntries,
  ].sort((a, b) => {
    if (b.scorePct !== a.scorePct) return b.scorePct - a.scorePct;
    return a.timeSec - b.timeSec;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-8">
      {/* Header Banner */}
      <section className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-8 flex flex-col md:flex-row items-center gap-6">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-[var(--th-border)] shrink-0 bg-[var(--th-surface-muted)] flex items-center justify-center">
          {!trophyFailed ? (
            <img
              src={trophyImg}
              alt="Złoty puchar konkursu matematycznego"
              referrerPolicy="no-referrer"
              onError={() => setTrophyFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <Trophy className="w-12 h-12 text-amber-500" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 text-center md:text-left">
          <p className="text-xs sm:text-sm font-semibold text-[var(--th-primary)]">
            Arena Konkursowa · Zakres tabliczki do {profile.settings.maxRange}
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-[var(--th-text)]">
            Turnieje Konkursowe i Rozgrywki na Czas
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-[var(--th-text-muted)] max-w-2xl">
            Rywalizuj ze znajomymi, kolegami z klasy lub innymi szkołami w warunkach prawdziwego konkursu matematycznego. Zdobądź Brąz, Srebro, Złoto lub Puchar Mistrza!
          </p>
        </div>
      </section>

      {/* Tournament Cards + Live Leaderboard Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TOURNAMENTS.map((tourney) => {
            const best = profile.tournamentBests[tourney.id];
            const isSelected = tourney.id === selectedTourney.id;
            const effectiveRange = Math.max(tourney.maxRange, profile.settings.maxRange);

            return (
              <div
                key={tourney.id}
                className={`rounded-2xl border p-5 flex flex-col justify-between transition-all bg-[var(--th-surface)] ${
                  isSelected
                    ? 'border-[var(--th-primary)] ring-2 ring-[var(--th-primary)]/20'
                    : 'border-[var(--th-border)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--th-text-muted)]">
                    <span>
                      {tourney.taskCount} zadań · Próg {tourney.passAccuracyPct}%
                    </span>
                    <span className="text-[var(--th-primary)] font-bold tabular-nums">
                      +{tourney.rewardXp} XP
                    </span>
                  </div>

                  <h2 className="mt-2 font-display text-lg font-bold text-[var(--th-text)]">
                    {tourney.title}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--th-text-muted)] leading-snug">
                    {tourney.description}
                  </p>

                  <div className="mt-3 pt-3 border-t border-[var(--th-border)] text-xs text-[var(--th-text-muted)] space-y-1 tabular-nums">
                    <div className="flex items-center justify-between">
                      <span>Złoto (czas):</span>
                      <strong className="text-[var(--th-text)]">≤ {tourney.goldTimeSec} s</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Srebro (czas):</span>
                      <strong className="text-[var(--th-text)]">≤ {tourney.silverTimeSec} s</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Twój najlepszy wynik:</span>
                      <strong className="text-[var(--th-primary)]">
                        {best
                          ? `${best.bestAccuracyPct}% (${best.bestTimeSec} s)`
                          : 'Jeszcze brak'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onStartTournament({
                        title: tourney.title,
                        mode: tourney.mode,
                        maxRange: effectiveRange,
                        taskCount: tourney.taskCount,
                        tournamentId: tourney.id,
                        passAccuracyPct: tourney.passAccuracyPct,
                      })
                    }
                    className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-bold text-sm border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                    <span>Start turnieju</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTourneyId(tourney.id)}
                    aria-label={`Pokaż ranking dla ${tourney.title}`}
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)] text-[var(--th-primary)]'
                        : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text)] hover:opacity-90'
                    }`}
                  >
                    Ranking
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Selected Tournament Standings & Medal Rules */}
        <div className="lg:col-span-5 bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-[var(--th-border)]">
            <div>
              <p className="text-xs font-semibold text-[var(--th-text-muted)]">Tabela wyników (Grupa i Goście)</p>
              <h2 className="font-display text-xl font-bold text-[var(--th-text)]">
                {selectedTourney.title}
              </h2>
            </div>
            <Award className="w-6 h-6 text-amber-500 shrink-0" aria-hidden="true" />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: 'Wszyscy' },
                { id: 'group', label: 'Tylko grupa' },
                ...(profile.schoolName ? [{ id: 'school', label: 'Moja szkoła' }] : []),
                ...(profile.schoolName && profile.className
                  ? [{ id: 'class', label: `Klasa ${profile.className}` }]
                  : []),
              ] as { id: TourneyScope; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScope(opt.id)}
                className={`min-h-[32px] px-2.5 py-1 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                  scope === opt.id
                    ? 'bg-[var(--th-primary)] border-[var(--th-primary)] text-[var(--th-primary-fg)]'
                    : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {userBest ? (
            <div className="my-4 bg-[var(--th-soft-tint)] border border-[var(--th-soft-tint-border)] rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-[var(--th-text-muted)]">Twój zdobyty tytuł ({profile.name})</div>
                <div className="font-display text-lg font-bold text-[var(--th-text)]">
                  {MEDAL_LABELS[userBest.medal]}
                </div>
              </div>
              <div className="text-right tabular-nums">
                <div className="font-display text-lg font-bold text-[var(--th-primary)]">
                  {userBest.bestAccuracyPct}%
                </div>
                <div className="text-xs text-[var(--th-text-muted)]">{userBest.bestTimeSec} s</div>
              </div>
            </div>
          ) : (
            <div className="my-4 bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-4 text-sm text-[var(--th-text-muted)]">
              Rozegraj ten turniej, aby wpisać swój wynik na tablicę i porównać się z innymi graczami!
            </div>
          )}

          <div className="divide-y divide-[var(--th-border)]">
            {leaderboard.length === 0 && (
              <div className="py-5 text-center text-xs text-[var(--th-text-muted)]">
                Brak jeszcze wyników w wybranym zakresie — rozegraj ten turniej jako pierwszy!
              </div>
            )}
            {leaderboard.map((entry, idx) => (
              <div
                key={`${entry.name}-${idx}`}
                className={`py-3 px-3 rounded-xl flex items-center justify-between gap-3 text-sm ${
                  entry.isUser
                    ? 'bg-[var(--th-soft-tint)] font-bold text-[var(--th-text)]'
                    : entry.isFamily
                    ? 'bg-[var(--th-surface-muted)] font-semibold text-[var(--th-text)]'
                    : 'text-[var(--th-text-muted)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 font-display font-bold text-[var(--th-text-muted)] tabular-nums">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[var(--th-text)]">{entry.name}</div>
                    <div className="text-xs text-[var(--th-text-muted)] font-normal">{entry.city}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 tabular-nums shrink-0">
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--th-text)]">
                    <Target className="w-3.5 h-3.5 text-[var(--th-primary)]" aria-hidden="true" />
                    {entry.scorePct}%
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-[var(--th-text-muted)]">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    {entry.timeSec} s
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-[var(--th-border)] flex items-center gap-2 text-xs text-[var(--th-text-muted)]">
            <Medal className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
            <span>
              Puchar Mistrza wymaga 100% poprawności w czasie poniżej {selectedTourney.goldTimeSec} s.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
