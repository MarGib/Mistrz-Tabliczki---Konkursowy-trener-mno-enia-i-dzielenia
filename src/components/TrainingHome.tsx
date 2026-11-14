import { useMemo, useState } from 'react';
import { HelpButton } from '../help/HelpButton';
import {
  AlarmClock,
  Bell,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import heroBannerImg from '../assets/images/hero_contest_banner_1794652992683.jpg';
import { LEVEL_STAGES } from '../data/curriculum';
import { MasterChallengeCard } from './MasterChallengeCard';
import { StagePath } from './StagePath';
import { NextStepCard } from './NextStepCard';
import { DailyGoalBar } from './DailyGoalBar';
import { dailyGoalState } from '../engine/dailyGoal';
import { chooseNextStep } from '../engine/nextStep';
import { hasAccountPassword } from '../engine/accountSecurity';
import {
  buildPlayerDiagnostics,
  buildReviewCalendar,
  formatFactEquation,
  formatFactPrompt,
  getReviewReminderBanner,
} from '../engine/reviewCalendar';
import { computeUserLevel } from '../engine/spacedRepetition';
import type {
  ActiveSeriesConfig,
  DeviceProfile,
  FamilyNotification,
  OperationMode,
  UserProfile,
} from '../types/math';
import { AvatarDisplay } from './AvatarDisplay';

interface TrainingHomeProps {
  profile: UserProfile;
  device: DeviceProfile;
  unreadNotifications: FamilyNotification[];
  onReopenProfilePicker: () => void;
  onOpenNotifications: () => void;
  onStartSeries: (config: ActiveSeriesConfig) => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
  onOpenTournaments: () => void;
}

const MODE_OPTIONS: { id: OperationMode; label: string; symbol: string }[] = [
  { id: 'mixed', label: 'Mieszany', symbol: '× ÷' },
  { id: 'mul', label: 'Mnożenie', symbol: '×' },
  { id: 'div', label: 'Dzielenie', symbol: '÷' },
];

export function TrainingHome({
  profile,
  device,
  unreadNotifications,
  onReopenProfilePicker,
  onOpenNotifications,
  onStartSeries,
  onOpenSettings,
  onOpenStats,
  onOpenTournaments,
}: TrainingHomeProps) {
  const [selectedMode, setSelectedMode] = useState<OperationMode>('mixed');
  const [seriesLength, setSeriesLength] = useState<number>(
    profile.settings.defaultSeriesLength
  );
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [expandedCoachPanel, setExpandedCoachPanel] = useState<
    'none' | 'diagnosis' | 'calendar'
  >('none');
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const levelInfo = computeUserLevel(profile.xp);
  const isProtected = hasAccountPassword(profile);
  const latestAlert = unreadNotifications[0];

  const diagnostics = useMemo(
    () => buildPlayerDiagnostics(profile.memories),
    [profile.memories]
  );
  const calendar = useMemo(
    () => buildReviewCalendar(profile.memories),
    [profile.memories]
  );
  const reviewReminder = useMemo(
    () => getReviewReminderBanner(profile.memories),
    [profile.memories]
  );

  const nextStep = useMemo(() => chooseNextStep(profile), [profile]);
  const goal = dailyGoalState(profile.sessions, profile.settings.dailyGoalSeries);

  const activeCalendarDay =
    calendar.days.find((d) => d.dateKey === selectedDayKey) ?? calendar.days[0];

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

  const handleStartRecommendedReview = (focusIds?: string[], customTitle?: string) => {
    const ids =
      focusIds && focusIds.length > 0
        ? focusIds
        : diagnostics.recommendedFocusIds;
    if (ids.length === 0) return;
    onStartSeries({
      title: customTitle ?? 'Powtórka SuperMemo: Plan na dziś',
      mode: 'mixed',
      maxRange: profile.settings.maxRange,
      taskCount: Math.max(8, Math.min(12, ids.length + 2)),
      focusFactIds: ids,
    });
  };

  const toggleCoachPanel = (panel: 'diagnosis' | 'calendar') => {
    setExpandedCoachPanel((prev) => (prev === panel ? 'none' : panel));
  };

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-3.5 sm:py-8 space-y-5 sm:space-y-7">
      {/* Contextual Alerts (only appear when genuinely relevant) */}
      {latestAlert && (
        <div
          className="bg-[var(--th-soft-tint)] border border-[var(--th-primary)] rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3"
          data-testid="home-unread-alert"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-[var(--th-text)] truncate">
                {latestAlert.title}
              </div>
              <div className="text-[11px] sm:text-xs text-[var(--th-text-muted)] truncate">
                {unreadNotifications.length > 1
                  ? `${latestAlert.message} (+${unreadNotifications.length - 1} więcej)`
                  : latestAlert.message}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenNotifications}
            className="min-h-[34px] px-3 py-1 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-xs font-bold shrink-0 cursor-pointer hover:opacity-90"
          >
            Zobacz
          </button>
        </div>
      )}

      <div className="space-y-2.5">
        <NextStepCard step={nextStep} onStart={onStartSeries} />
        {goal && <DailyGoalBar state={goal} />}
      </div>

      {reviewReminder && reviewReminder.hasDue && nextStep.kind !== 'review' && (
        <div
          className="bg-[var(--th-surface)] border border-[var(--th-accent)]/50 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          data-testid="home-review-reminder"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[var(--th-accent)] text-[var(--th-accent-fg)] flex items-center justify-center shrink-0">
              <AlarmClock className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-[var(--th-text)]">
                {reviewReminder.title}
              </div>
              <div className="text-[11px] sm:text-xs text-[var(--th-text-muted)] truncate">
                {reviewReminder.message}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              handleStartRecommendedReview(
                reviewReminder.focusFactIds,
                'Powtórka z Kalendarza (na dziś)'
              )
            }
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[var(--th-accent)] hover:bg-[var(--th-accent-hover)] text-[var(--th-accent-fg)] text-xs font-bold shrink-0 cursor-pointer"
          >
            Powtórz teraz ({reviewReminder.urgentCount})
          </button>
        </div>
      )}

      {/* Hero & Quick Practice Launcher (Training-First Landing View) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
        {/* Left: Coach & Quick Configurator */}
        <div className="lg:col-span-7 bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-4 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 sm:gap-4">
              <AvatarDisplay
                avatarId={profile.avatarId}
                customSpec={profile.customAvatarSpec}
                name={profile.name}
                sizeClass="w-14 h-14 sm:w-20 sm:h-20"
              />

              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-[var(--th-text-muted)]">
                  Poziom {levelInfo.level}: {levelInfo.title} · {device.label}
                  {(profile.schoolName || profile.className) &&
                    ` · ${[profile.schoolName, profile.className ? `kl. ${profile.className}` : null]
                      .filter(Boolean)
                      .join(' ')}`}
                </p>
                <h1 className="font-display text-xl sm:text-3xl font-extrabold text-[var(--th-text)] tracking-tight text-balance leading-snug">
                  Cześć {profile.name}! Gotowi na trening?
                </h1>
              </div>
            </div>

            {/* Isolated Active Account Strip */}
            <div className="mt-3 pt-3 border-t border-[var(--th-border)] flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--th-text-muted)]">
                {isProtected ? (
                  <Lock className="w-3.5 h-3.5 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
                )}
                <span>
                  Konto: <strong className="text-[var(--th-text)]">{profile.name}</strong>
                  {isProtected ? ' (z hasłem)' : ' (lokalne)'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="text-xs font-bold text-[var(--th-text-muted)] hover:text-[var(--th-text)] cursor-pointer"
                >
                  Hasło i profil
                </button>
                <button
                  type="button"
                  onClick={onReopenProfilePicker}
                  data-testid="switch-person-btn"
                  className="min-h-[32px] px-2.5 py-1 rounded-xl bg-[var(--th-surface-muted)] border border-[var(--th-border)] hover:border-[var(--th-primary)] text-xs font-bold text-[var(--th-text)] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-[var(--th-primary)]" aria-hidden="true" />
                  <span>Zmień osobę</span>
                </button>
              </div>
            </div>

            {/* Level XP Bar */}
            <div className="mt-3.5 bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-3 sm:p-4">
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
              <div className="h-2 bg-[var(--th-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--th-primary)] rounded-full transition-all duration-300"
                  style={{ width: `${levelInfo.progressPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] sm:text-xs text-[var(--th-text-muted)] tabular-nums">
                Postęp do kolejnego poziomu: {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP
              </p>
            </div>

            {/* Operation & Series Length Controls */}
            <div className="mt-4 space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs sm:text-sm font-bold text-[var(--th-text)]">
                    Wybierz tryb ćwiczeń
                  </span>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="text-xs font-semibold text-[var(--th-primary)] hover:underline cursor-pointer"
                  >
                    Zakres: do {profile.settings.maxRange} (Zmień)
                  </button>
                </div>
                <div
                  className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 sm:p-1.5 bg-[var(--th-surface-muted)] rounded-2xl border border-[var(--th-border)]"
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
                        className={`min-h-[42px] px-1.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap ${
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

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-bold text-[var(--th-text)]">
                  Długość serii
                </span>
                <div className="flex items-center gap-1.5 p-1 bg-[var(--th-surface-muted)] rounded-xl border border-[var(--th-border)]">
                  {[8, 10, 15, 20].map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setSeriesLength(len)}
                      className={`min-w-[40px] sm:min-w-[44px] min-h-[36px] px-2 rounded-lg text-xs sm:text-sm font-bold tabular-nums transition-colors cursor-pointer ${
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
          <div className="mt-4 sm:mt-6 pt-4 border-t border-[var(--th-border)] flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <button
                data-tour="quickstart"
              type="button"
              onClick={handleQuickCustomStart}
              className="flex-1 min-h-[48px] sm:min-h-[52px] px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-display text-base sm:text-lg font-bold border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" aria-hidden="true" />
              <span>Rozpocznij serię ({seriesLength} zadań)</span>
            </button>

            {diagnostics.recommendedFocusIds.length > 0 && (
              <button
                type="button"
                onClick={() => handleStartRecommendedReview()}
                className="min-h-[46px] sm:min-h-[52px] px-4 py-2.5 sm:py-3 rounded-2xl bg-[var(--th-accent)] hover:bg-[var(--th-accent-hover)] text-[var(--th-accent-fg)] font-bold text-xs sm:text-sm border-b-4 border-[var(--th-accent-dark)] active:border-b-2 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Brain className="w-4 h-4" aria-hidden="true" />
                <span>
                  Powtórka SuperMemo (
                  {calendar.dueNow.length > 0
                    ? calendar.dueNow.length
                    : diagnostics.recommendedFocusIds.length}
                  )
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Visual Contest Banner */}
        <div className="lg:col-span-5 bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl overflow-hidden flex flex-col">
          <div className="relative flex-1 min-h-[170px] sm:min-h-[200px] bg-[var(--th-surface-muted)]">
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
          <div className="p-4 sm:p-6 bg-[var(--th-surface)] border-t border-[var(--th-border)] space-y-2.5">
            <h2 className="font-display text-base sm:text-lg font-bold text-[var(--th-text)]">
              Najpierw trening i analiza tempa
            </h2>
            <p className="text-xs sm:text-sm text-[var(--th-text-muted)] leading-relaxed">
              Badamy każde działanie pod kątem błędów i czasu namysłu, układamy kalendarz
              powtórek i podsuwamy podpowiedzi. Gdy nabierzesz pewności — sprawdź się w turniejach!
            </p>
            <button
              type="button"
              onClick={onOpenTournaments}
              className="text-xs font-bold text-[var(--th-primary)] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Przejdź do Turniejów (opcjonalnie po treningu)</span>
            </button>
          </div>
        </div>
      </section>

      {/* Progressive-Disclosure Coach & Review Calendar Strip */}
      <section
        className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-4 sm:p-6 space-y-4"
        aria-labelledby="coach-strip-heading"
        data-testid="training-coach-section"
      >
        {diagnostics.totalMeasured === 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--th-soft-tint)] border border-[var(--th-soft-tint-border)] text-[var(--th-primary)] flex items-center justify-center shrink-0">
                <Brain className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="coach-strip-heading"
                  className="font-display text-base sm:text-lg font-bold text-[var(--th-text)]"
                >
                  Diagnoza i Kalendarz Powtórek
                </h2>
                <p className="text-xs sm:text-sm text-[var(--th-text-muted)]">
                  Po pierwszej serii zobaczysz tu swoje mocne i słabe strony, najwolniejsze
                  działania oraz harmonogram powtórek na kolejne dni.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleQuickCustomStart}
              className="min-h-[40px] px-4 rounded-xl bg-[var(--th-soft-tint)] border border-[var(--th-soft-tint-border)] text-xs font-bold text-[var(--th-primary)] hover:opacity-90 shrink-0 cursor-pointer"
            >
              Zacznij 1. diagnozę
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="coach-strip-heading"
                    className="font-display text-base sm:text-lg font-bold text-[var(--th-text)]"
                  >
                    Twój Trener i Plan Powtórek
                  </h2>
                  <span className="text-xs font-bold text-[var(--th-primary)] tabular-nums">
                    Na wyrywki: {diagnostics.masteredCount} · Do poprawy: {diagnostics.difficultCount} · Na dziś: {calendar.dueNow.length}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[var(--th-text-muted)]">
                  {diagnostics.recommendedSummary}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-expanded={expandedCoachPanel === 'diagnosis'}
                  onClick={() => toggleCoachPanel('diagnosis')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    expandedCoachPanel === 'diagnosis'
                      ? 'bg-[var(--th-primary)] border-[var(--th-primary)] text-[var(--th-primary-fg)]'
                      : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text)] hover:border-[var(--th-primary)]'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Mocne i słabe strony</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      expandedCoachPanel === 'diagnosis' ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  aria-expanded={expandedCoachPanel === 'calendar'}
                  onClick={() => toggleCoachPanel('calendar')}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    expandedCoachPanel === 'calendar'
                      ? 'bg-[var(--th-primary)] border-[var(--th-primary)] text-[var(--th-primary-fg)]'
                      : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text)] hover:border-[var(--th-primary)]'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Kalendarz powtórek ({calendar.totalScheduled7Days})</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      expandedCoachPanel === 'calendar' ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  onClick={onOpenStats}
                  className="min-h-[38px] px-2.5 text-xs font-bold text-[var(--th-primary)] hover:underline cursor-pointer"
                >
                  Pełne statystyki →
                </button>
              </div>
            </div>

            {/* Expandable Drawer A: Player Strengths, Weaknesses & Slowest Facts */}
            {expandedCoachPanel === 'diagnosis' && (
              <div
                className="pt-3 border-t border-[var(--th-border)] grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4"
                data-testid="coach-diagnosis-drawer"
              >
                {/* Weak spots */}
                <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--th-text)]">
                      Co wymaga poprawy
                    </span>
                    {diagnostics.weakestFacts.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleStartRecommendedReview(
                            diagnostics.weakestFacts.map((f) => f.id),
                            'Szlifowanie słabszych działań'
                          )
                        }
                        className="text-[11px] font-bold text-[var(--th-primary)] hover:underline cursor-pointer"
                      >
                        Ćwicz wszystkie
                      </button>
                    )}
                  </div>
                  {diagnostics.weakestFacts.length === 0 ? (
                    <p className="text-xs text-[var(--th-text-muted)]">
                      Brak błędnych działań — świetna celność!
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {diagnostics.weakestFacts.slice(0, 4).map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between gap-2 text-xs bg-[var(--th-surface)] border border-[var(--th-border)] rounded-xl px-2.5 py-1.5"
                        >
                          <span className="font-mono font-bold text-[var(--th-text)] tabular-nums">
                            {formatFactEquation(f)}
                          </span>
                          <span className="text-[11px] text-red-500 font-semibold tabular-nums">
                            {f.wrongCount} bł.
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Slowest facts */}
                <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--th-text)] inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[var(--th-primary)]" aria-hidden="true" />
                      Najdłuższy czas namysłu
                    </span>
                    {diagnostics.slowestFacts.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleStartRecommendedReview(
                            diagnostics.slowestFacts.slice(0, 5).map((f) => f.id),
                            'Trening szybkości reakcji'
                          )
                        }
                        className="text-[11px] font-bold text-[var(--th-primary)] hover:underline cursor-pointer"
                      >
                        Przyspiesz
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {diagnostics.slowestFacts.slice(0, 4).map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-2 text-xs bg-[var(--th-surface)] border border-[var(--th-border)] rounded-xl px-2.5 py-1.5"
                      >
                        <span className="font-mono font-bold text-[var(--th-text)] tabular-nums">
                          {formatFactEquation(f)}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-[var(--th-text-muted)] tabular-nums">
                          {(f.avgTimeMs / 1000).toFixed(1).replace('.', ',')} s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Strongest facts */}
                <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--th-text)] inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                      Twoje mocne strony
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600">
                      {diagnostics.accuracyPct}% celności
                    </span>
                  </div>
                  {diagnostics.strongestFacts.length === 0 ? (
                    <p className="text-xs text-[var(--th-text-muted)]">
                      Kolejne poprawne serie odblokują listę działań „na wyrywki”.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {diagnostics.strongestFacts.slice(0, 4).map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between gap-2 text-xs bg-[var(--th-surface)] border border-[var(--th-border)] rounded-xl px-2.5 py-1.5"
                        >
                          <span className="font-mono font-bold text-[var(--th-text)] tabular-nums">
                            {formatFactEquation(f)}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-emerald-600 tabular-nums">
                            {(f.avgTimeMs / 1000).toFixed(1).replace('.', ',')} s
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Expandable Drawer B: 7-Day Review Calendar */}
            {expandedCoachPanel === 'calendar' && (
              <div
                className="pt-3 border-t border-[var(--th-border)] space-y-3"
                data-testid="coach-calendar-drawer"
              >
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {calendar.days.map((day) => {
                    const isSelected = activeCalendarDay?.dateKey === day.dateKey;
                    return (
                      <button
                        key={day.dateKey}
                        type="button"
                        onClick={() => setSelectedDayKey(day.dateKey)}
                        className={`p-1 sm:p-2.5 rounded-xl sm:rounded-2xl border text-center cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)]'
                            : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] hover:border-[var(--th-primary)]'
                        }`}
                      >
                        <div className="text-[10px] sm:text-xs font-bold text-[var(--th-text)]">
                          {day.label}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-[var(--th-text-muted)] tabular-nums">
                          {day.shortDate}
                        </div>
                        <div
                          className={`mt-1 font-display text-sm sm:text-base font-extrabold tabular-nums ${
                            day.count > 0
                              ? day.isToday
                                ? 'text-[var(--th-accent)]'
                                : 'text-[var(--th-primary)]'
                              : 'text-[var(--th-text-muted)]'
                          }`}
                        >
                          {day.count}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {activeCalendarDay && (
                  <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--th-text)]">
                        {activeCalendarDay.label} ({activeCalendarDay.shortDate}) —{' '}
                        {activeCalendarDay.count}{' '}
                        {activeCalendarDay.count === 1
                          ? 'działanie do powtórki'
                          : 'działań do powtórki'}
                      </div>
                      <div className="mt-1 text-xs text-[var(--th-text-muted)] truncate">
                        {activeCalendarDay.count > 0
                          ? activeCalendarDay.facts
                              .slice(0, 6)
                              .map((f) => formatFactPrompt(f))
                              .join(' · ')
                          : 'Brak zaplanowanych powtórek na ten dzień.'}
                      </div>
                    </div>
                    {activeCalendarDay.count > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleStartRecommendedReview(
                            activeCalendarDay.facts.slice(0, 10).map((f) => f.id),
                            `Powtórka: ${activeCalendarDay.label} (${activeCalendarDay.shortDate})`
                          )
                        }
                        className="min-h-[38px] px-3.5 rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-xs font-bold shrink-0 cursor-pointer"
                      >
                        Przećwicz ten dzień
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Ścieżka Mistrza (Progressive Levels with Passing Thresholds) */}
      <section aria-labelledby="levels-heading" data-tour="path">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
          <div>
            <h2
              id="levels-heading"
              className="font-display text-xl sm:text-2xl font-extrabold text-[var(--th-text)]"
            >
              Ścieżka Mistrza — etapy i progi przejścia
              <HelpButton section="path" label="Ścieżka Mistrza" className="align-middle ml-1" />
            </h2>
            <p className="text-sm text-[var(--th-text-muted)]">
              Zdobywaj wymagany próg skuteczności w każdej serii, aby odblokować kolejne poziomy i odznaki.
            </p>
          </div>
        </div>

        {(() => {
          const pathDone = LEVEL_STAGES.every((st) => profile.completedStageIds.includes(st.id));
          const master = <MasterChallengeCard profile={profile} pathDone={pathDone} onStart={onStartSeries} />;
          // Po ukończeniu ścieżki Wyzwanie Mistrza jest na górze — to główna zabawa.
          return pathDone ? (
            <div className="space-y-4">
              {master}
              <StagePath profile={profile} onStart={onStartSeries} />
            </div>
          ) : (
            <div className="space-y-4">
              <StagePath profile={profile} onStart={onStartSeries} />
              {master}
            </div>
          );
        })()}
      </section>
    </div>
  );
}
