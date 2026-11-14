import { useState } from 'react';
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  Flame,
  Lock,
  Play,
  Sparkles,
  Target,
  UserPlus,
  Zap,
} from 'lucide-react';
import heroBannerImg from '../assets/images/hero_contest_banner_1794652992683.jpg';
import { LEVEL_STAGES } from '../data/curriculum';
import {
  computeUserLevel,
  getDifficultFacts,
  getDueFactCount,
} from '../engine/spacedRepetition';
import type {
  ActiveSeriesConfig,
  DeviceProfile,
  OperationMode,
  UserProfile,
} from '../types/math';
import { AvatarDisplay } from './AvatarDisplay';

interface TrainingHomeProps {
  profile: UserProfile;
  profiles: UserProfile[];
  device: DeviceProfile;
  onSwitchProfile: (profileId: string) => void;
  onStartSeries: (config: ActiveSeriesConfig) => void;
  onOpenSettings: () => void;
}

const MODE_OPTIONS: { id: OperationMode; label: string; symbol: string }[] = [
  { id: 'mixed', label: 'Mieszany', symbol: '× ÷' },
  { id: 'mul', label: 'Mnożenie', symbol: '×' },
  { id: 'div', label: 'Dzielenie', symbol: '÷' },
];

export function TrainingHome({
  profile,
  profiles,
  device,
  onSwitchProfile,
  onStartSeries,
  onOpenSettings,
}: TrainingHomeProps) {
  const [selectedMode, setSelectedMode] = useState<OperationMode>('mixed');
  const [seriesLength, setSeriesLength] = useState<number>(
    profile.settings.defaultSeriesLength
  );
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const levelInfo = computeUserLevel(profile.xp);
  const difficultFacts = getDifficultFacts(profile.memories, 8);
  const dueCount = getDueFactCount(profile.memories);

  const handleQuickCustomStart = () => {
    const modeLabel =
      selectedMode === 'mul'
        ? 'Mnożenie'
        : selectedMode === 'div'
        ? 'Dzielenie'
        : 'Mnożenie i Dzielenie';
    onStartSeries({
      title: `Trening: ${modeLabel} do ${profile.settings.maxRange}`,
      mode: selectedMode,
      maxRange: profile.settings.maxRange,
      taskCount: seriesLength,
    });
  };

  const handleStartWeakSpots = () => {
    const focusIds = difficultFacts.map((f) => f.id);
    onStartSeries({
      title: 'Powtórka SuperMemo: Trudne działania',
      mode: 'mixed',
      maxRange: profile.settings.maxRange,
      taskCount: Math.max(8, Math.min(12, focusIds.length + 3)),
      focusFactIds: focusIds,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-8">
      {/* Hero & Quick Practice Launcher (2-column balanced desktop split) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Coach & Quick Configurator */}
        <div className="lg:col-span-7 bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-4">
              <AvatarDisplay
                avatarId={profile.avatarId}
                customSpec={profile.customAvatarSpec}
                name={profile.name}
                sizeClass="w-16 h-16 sm:w-20 sm:h-20"
              />

              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-[var(--th-text-muted)]">
                  Poziom {levelInfo.level}: {levelInfo.title} · Widok: {device.label}
                </p>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--th-text)] tracking-tight text-balance">
                  Cześć {profile.name}! Gotowi na konkursowy trening?
                </h1>
              </div>
            </div>

            {/* Family Quick Player Switcher */}
            <div className="mt-4 pt-3 border-t border-[var(--th-border)]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-[var(--th-text-muted)]">
                  Kto teraz trenuje? (Rodzina: {profiles.length})
                </span>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="text-xs font-bold text-[var(--th-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Zarządzaj kontami</span>
                </button>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {profiles.map((member) => {
                  const isCurrent = member.id === profile.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => onSwitchProfile(member.id)}
                      aria-pressed={isCurrent}
                      className={`min-h-[40px] pl-1.5 pr-3 py-1 rounded-xl border text-xs font-bold inline-flex items-center gap-2 shrink-0 cursor-pointer transition-all whitespace-nowrap ${
                        isCurrent
                          ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)] text-[var(--th-text)]'
                          : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                      }`}
                    >
                      <AvatarDisplay
                        avatarId={member.avatarId}
                        customSpec={member.customAvatarSpec}
                        name={member.name}
                        sizeClass="w-7 h-7"
                      />
                      <span>{member.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Level XP Bar */}
            <div className="mt-4 bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-3.5 sm:p-4">
              <div className="flex items-center justify-between text-xs sm:text-sm font-semibold mb-1.5 tabular-nums">
                <span className="inline-flex items-center gap-1.5 text-[var(--th-text)]">
                  <Zap className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" />
                  {profile.xp} XP zdobytych
                </span>
                <span className="inline-flex items-center gap-1.5 text-[var(--th-text)]">
                  <Flame className="w-4 h-4 text-[var(--th-accent)]" aria-hidden="true" />
                  Seria {profile.streakDays} dni
                </span>
              </div>
              <div className="h-2.5 bg-[var(--th-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--th-primary)] rounded-full transition-all duration-300"
                  style={{ width: `${levelInfo.progressPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--th-text-muted)] tabular-nums">
                Postęp do kolejnego poziomu: {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP
              </p>
            </div>

            {/* Operation & Series Length Controls */}
            <div className="mt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-[var(--th-text)]">Wybierz tryb ćwiczeń</span>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="text-xs font-semibold text-[var(--th-primary)] hover:underline cursor-pointer"
                  >
                    Zakres: do {profile.settings.maxRange} (Zmień)
                  </button>
                </div>
                <div
                  className="grid grid-cols-3 gap-2 p-1.5 bg-[var(--th-surface-muted)] rounded-2xl border border-[var(--th-border)]"
                  role="group"
                  aria-label="Tryb działań"
                >
                  {MODE_OPTIONS.map((opt) => {
                    const active = selectedMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedMode(opt.id)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-sm border border-[var(--th-border)]'
                            : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                        }`}
                      >
                        <span className="font-mono text-[var(--th-primary)]">{opt.symbol}</span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-bold text-[var(--th-text)]">Długość serii</span>
                <div className="flex items-center gap-1.5 p-1 bg-[var(--th-surface-muted)] rounded-xl border border-[var(--th-border)]">
                  {[8, 10, 15, 20].map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setSeriesLength(len)}
                      className={`min-w-[44px] min-h-[38px] px-2.5 rounded-lg text-xs sm:text-sm font-bold tabular-nums transition-colors cursor-pointer ${
                        seriesLength === len
                          ? 'bg-[var(--th-surface)] text-[var(--th-text)] shadow-sm'
                          : 'text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Primary Launch Actions */}
          <div className="mt-6 pt-5 border-t border-[var(--th-border)] flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleQuickCustomStart}
              className="flex-1 min-h-[52px] px-5 py-3 rounded-2xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-display text-base sm:text-lg font-bold border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" aria-hidden="true" />
              <span>Rozpocznij serię ({seriesLength} zadań)</span>
            </button>

            {difficultFacts.length > 0 && (
              <button
                type="button"
                onClick={handleStartWeakSpots}
                className="min-h-[52px] px-4 py-3 rounded-2xl bg-[var(--th-accent)] hover:bg-[var(--th-accent-hover)] text-[var(--th-accent-fg)] font-bold text-sm border-b-4 border-[var(--th-accent-dark)] active:border-b-2 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Brain className="w-4 h-4" aria-hidden="true" />
                <span>Powtórka SuperMemo ({dueCount > 0 ? dueCount : difficultFacts.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Visual Contest Banner */}
        <div className="lg:col-span-5 bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl overflow-hidden flex flex-col">
          <div className="relative flex-1 min-h-[200px] bg-[var(--th-surface-muted)]">
            {!heroImgFailed ? (
              <img
                src={heroBannerImg}
                alt="Kolorowe klocki matematyczne i podium zwycięzców konkursu"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[var(--th-soft-tint)]">
                <Sparkles className="w-10 h-10 text-[var(--th-primary)] mb-2" aria-hidden="true" />
                <p className="font-display font-bold text-[var(--th-text)]">
                  Trening Konkursowy do {profile.settings.maxRange}
                </p>
              </div>
            )}
          </div>
          <div className="p-5 sm:p-6 bg-[var(--th-surface)] border-t border-[var(--th-border)]">
            <h2 className="font-display text-lg font-bold text-[var(--th-text)]">
              Inteligentna nauka na wyrywki
            </h2>
            <p className="mt-1 text-sm text-[var(--th-text-muted)] leading-relaxed">
              System mierzy czas każdego zadania, wyłapuje najtrudniejsze pary liczb i podsuwa
              wizualne triki, gdy dłużej się zastanawiasz.
            </p>
          </div>
        </div>
      </section>

      {/* Ścieżka Mistrza (Progressive Levels with Passing Thresholds) */}
      <section aria-labelledby="levels-heading">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
          <div>
            <h2
              id="levels-heading"
              className="font-display text-xl sm:text-2xl font-extrabold text-[var(--th-text)]"
            >
              Ścieżka Mistrza — etapy i progi przejścia
            </h2>
            <p className="text-sm text-[var(--th-text-muted)]">
              Zdobywaj wymagany próg skuteczności w każdej serii, aby odblokować kolejne poziomy i odznaki.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LEVEL_STAGES.map((stage) => {
            const isUnlocked = profile.unlockedStageIds.includes(stage.id);
            const isCompleted = profile.completedStageIds.includes(stage.id);

            const modeText =
              stage.mode === 'mul'
                ? 'Mnożenie'
                : stage.mode === 'div'
                ? 'Dzielenie'
                : 'Mieszany';

            return (
              <div
                key={stage.id}
                className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                  isCompleted
                    ? 'bg-[var(--th-soft-tint)] border-[var(--th-soft-tint-border)]'
                    : isUnlocked
                    ? 'bg-[var(--th-surface)] border-[var(--th-border)] shadow-sm'
                    : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--th-text-muted)]">
                    <span>
                      Poziom {stage.order} · {modeText} do {stage.maxRange}
                    </span>
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[var(--th-primary)] font-bold">
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        Zaliczony
                      </span>
                    ) : !isUnlocked ? (
                      <span className="inline-flex items-center gap-1 text-[var(--th-text-muted)]">
                        <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                        Zablokowany
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[var(--th-primary)] font-bold">
                        <Target className="w-3.5 h-3.5" aria-hidden="true" />
                        Aktywny
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 font-display text-lg font-bold text-[var(--th-text)]">
                    {stage.title}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--th-text-muted)]">{stage.subtitle}</p>

                  <div className="mt-3 pt-3 border-t border-[var(--th-border)] flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[var(--th-text-muted)] tabular-nums">
                    <span>{stage.taskCount} zadań</span>
                    <span aria-hidden="true">·</span>
                    <span>Próg: {stage.passAccuracyPct}%</span>
                    <span aria-hidden="true">·</span>
                    <span>Nagroda: +{stage.rewardXp} XP</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() =>
                    onStartSeries({
                      title: stage.title,
                      mode: stage.mode,
                      maxRange: stage.maxRange,
                      taskCount: stage.taskCount,
                      stageId: stage.id,
                      passAccuracyPct: stage.passAccuracyPct,
                      targetAvgTimeSec: stage.targetAvgTimeSec,
                    })
                  }
                  className={`mt-4 w-full min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all ${
                    isUnlocked
                      ? isCompleted
                        ? 'bg-[var(--th-surface)] hover:opacity-90 text-[var(--th-text)] border border-[var(--th-border)] cursor-pointer'
                        : 'bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] cursor-pointer'
                      : 'bg-[var(--th-surface-muted)] text-[var(--th-text-muted)] border border-[var(--th-border)] cursor-not-allowed'
                  }`}
                >
                  <span>{isCompleted ? 'Powtórz etap' : isUnlocked ? 'Wejdź do etapu' : 'Ukończ poprzedni etap'}</span>
                  {isUnlocked && <ChevronRight className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
