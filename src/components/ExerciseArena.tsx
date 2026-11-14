import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HelpButton } from '../help/HelpButton';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Flame,
  Lightbulb,
  Music,
  RotateCcw,
  Target,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
} from 'lucide-react';
import type {
  ActiveSeriesConfig,
  AppSettings,
  AvatarSpec,
  DeviceProfile,
  FactMemory,
  MathProblem,
  SessionRecord,
  TaskAttempt,
} from '../types/math';
import { generateVisualHint, selectAdaptiveSeries } from '../engine/problemGenerator';
import {
  FAST_THRESHOLD_MS,
  calculateTaskPoints,
  checkStagePass,
  computeResponseQuality,
  computeTournamentMedal,
} from '../engine/spacedRepetition';
import { LEVEL_STAGES, TOURNAMENTS } from '../data/curriculum';
import { isMasterChallengePassed } from '../engine/masterChallenge';
import type { CertificateData } from '../engine/certificateCanvas';
import { CertificateDialog } from './CertificateDialog';
import {
  playTone,
  startBackgroundMusic,
  stopBackgroundMusic,
} from '../utils/sound';
import { CalculatorKeypad } from './CalculatorKeypad';
import { CelebrationBurst } from './CelebrationBurst';
import { VictoryPosterCard } from './VictoryPosterCard';
import { VisualHintCard } from './VisualHintCard';

interface ExerciseArenaProps {
  config: ActiveSeriesConfig;
  memories: Record<string, FactMemory>;
  settings: AppSettings;
  device: DeviceProfile;
  isDark?: boolean;
  playerName?: string;
  avatarSpec?: AvatarSpec;
  themePrimary?: string;
  themeAccent?: string;
  onUpdateSettings?: (partial: Partial<AppSettings>) => void;
  onCompleteSession: (session: SessionRecord, attempts: TaskAttempt[]) => void;
  onExit: () => void;
  onRestartWithFocus: (focusIds: string[], title: string) => void;
}

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(1).replace('.', ',');
}

export function ExerciseArena({
  config,
  memories,
  settings,
  device,
  isDark = false,
  playerName = 'Uczeń',
  avatarSpec,
  themePrimary = '#16A34A',
  themeAccent = '#F59E0B',
  onUpdateSettings,
  onCompleteSession,
  onExit,
  onRestartWithFocus,
}: ExerciseArenaProps) {
  const [problems, setProblems] = useState<MathProblem[]>(() =>
    selectAdaptiveSeries({
      mode: config.mode,
      maxRange: config.maxRange,
      count: config.taskCount,
      memories,
      focusFactIds: config.focusFactIds,
    })
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [attempts, setAttempts] = useState<TaskAttempt[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [hintAutoTriggered, setHintAutoTriggered] = useState(false);
  // Użytkownik zwinął podpowiedź w tym zadaniu — nie otwieraj jej ponownie automatycznie.
  const [hintDismissed, setHintDismissed] = useState(false);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    points: number;
    timeMs: number;
    correctAnswer: number;
  } | null>(null);
  const [shakeWrong, setShakeWrong] = useState(false);
  const [elapsedTaskMs, setElapsedTaskMs] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [burstLabel, setBurstLabel] = useState('');
  const [tickPulse, setTickPulse] = useState(false);

  const taskStartRef = useRef<number>(Date.now());
  const seriesStartRef = useRef<number>(Date.now());
  const recordedRef = useRef(false);
  const lastTickSecRef = useRef<number>(-1);

  const currentProblem = problems[currentIndex];
  const isCompactPhone = device.category === 'telefon';
  const musicEnabled = settings.musicEnabled ?? true;

  // Soft pace countdown target per task (in seconds)
  const paceTargetSec = useMemo(() => {
    if (config.targetAvgTimeSec) {
      return Math.max(6, Math.round(config.targetAvgTimeSec * 1.6));
    }
    return 10;
  }, [config.targetAvgTimeSec]);

  // Manage background music lifecycle inside Arena
  useEffect(() => {
    if (musicEnabled && !isFinished) {
      startBackgroundMusic();
    } else {
      stopBackgroundMusic();
    }
    return () => {
      stopBackgroundMusic();
    };
  }, [musicEnabled, isFinished]);

  // Live task timer + automatic smart visual hint + clock tick when time runs low
  useEffect(() => {
    if (isFinished || feedback !== null) return;

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - taskStartRef.current;
      setElapsedTaskMs(elapsed);

      if (
        settings.autoHintDelaySec > 0 &&
        elapsed >= settings.autoHintDelaySec * 1000 &&
        !showHint &&
        !hintDismissed
      ) {
        setShowHint(true);
        setHintAutoTriggered(true);
      }

      // Play subtle clock ticking in the final 4 seconds of the pace window
      const elapsedSec = Math.floor(elapsed / 1000);
      const warnStartSec = Math.max(3, paceTargetSec - 4);
      if (
        elapsedSec >= warnStartSec &&
        elapsedSec <= paceTargetSec &&
        elapsedSec !== lastTickSecRef.current
      ) {
        lastTickSecRef.current = elapsedSec;
        const urgent = elapsedSec >= paceTargetSec - 1;
        playTone(urgent ? 'tickUrgent' : 'tick', settings.soundEnabled);
        setTickPulse(true);
        window.setTimeout(() => setTickPulse(false), 180);
      }
    }, 150);

    return () => window.clearInterval(timer);
  }, [
    feedback,
    isFinished,
    paceTargetSec,
    settings.autoHintDelaySec,
    settings.soundEnabled,
    showHint,
    hintDismissed,
  ]);

  const visualHint = useMemo(() => {
    if (!currentProblem) return null;
    return generateVisualHint(currentProblem);
  }, [currentProblem]);

  const ensureAudioStarted = useCallback(() => {
    if (musicEnabled && !isFinished) {
      startBackgroundMusic();
    }
  }, [isFinished, musicEnabled]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (feedback !== null || isFinished) return;
      ensureAudioStarted();
      playTone('tap', settings.soundEnabled);
      setInputValue((prev) => {
        if (prev.length >= 5) return prev;
        if (prev === '0') return digit;
        return prev + digit;
      });
    },
    [ensureAudioStarted, feedback, isFinished, settings.soundEnabled]
  );

  const handleBackspace = useCallback(() => {
    if (feedback !== null || isFinished) return;
    playTone('tap', settings.soundEnabled);
    setInputValue((prev) => prev.slice(0, -1));
  }, [feedback, isFinished, settings.soundEnabled]);

  const handleClear = useCallback(() => {
    if (feedback !== null || isFinished) return;
    playTone('tap', settings.soundEnabled);
    setInputValue('');
  }, [feedback, isFinished, settings.soundEnabled]);

  const advanceToNext = useCallback(
    (nextAttempts: TaskAttempt[]) => {
      if (currentIndex + 1 >= problems.length) {
        setIsFinished(true);
        stopBackgroundMusic();
        playTone('finish', settings.soundEnabled);
        setBurstKey((k) => k + 1);
        setBurstLabel('Seria ukończona!');

        if (!recordedRef.current) {
          recordedRef.current = true;
          const totalTimeMs = nextAttempts.reduce((acc, a) => acc + a.timeMs, 0);
          const correctTasks = nextAttempts.filter((a) => a.isCorrect).length;
          const thresholdPct = config.passAccuracyPct ?? 70;
          const stagePass = checkStagePass(correctTasks, nextAttempts.length, thresholdPct);
          const accuracyPct = stagePass.accuracyPct;
          const passed = config.masterLevel
            ? isMasterChallengePassed(
                accuracyPct,
                nextAttempts.length > 0 ? totalTimeMs / nextAttempts.length : 0,
                thresholdPct,
                config.targetAvgTimeSec ?? 99
              )
            : stagePass.passed;
          const earned = nextAttempts.reduce((acc, a) => acc + a.pointsEarned, 0);

          const session: SessionRecord = {
            id: `sess-${Date.now()}`,
            timestamp: Date.now(),
            mode: config.mode,
            seriesTitle: config.title,
            stageId: config.stageId,
            tournamentId: config.tournamentId,
            maxRange: config.maxRange,
            masterLevel: config.masterLevel,
            targetAvgTimeSec: config.targetAvgTimeSec,
            totalTasks: nextAttempts.length,
            correctTasks,
            accuracyPct,
            totalTimeMs,
            avgTimeMs:
              nextAttempts.length > 0
                ? Math.round(totalTimeMs / nextAttempts.length)
                : 0,
            pointsEarned: earned,
            passedThreshold: passed,
            thresholdPct: config.passAccuracyPct,
            attempts: nextAttempts,
          };
          onCompleteSession(session, nextAttempts);
        }
      } else {
        setCurrentIndex((prev) => prev + 1);
        setInputValue('');
        setFeedback(null);
        setShowHint(false);
        setHintAutoTriggered(false);
        setHintDismissed(false);
        setElapsedTaskMs(0);
        lastTickSecRef.current = -1;
        taskStartRef.current = Date.now();
      }
    },
    [
      config.mode,
      config.passAccuracyPct,
      config.stageId,
      config.title,
      config.tournamentId,
      currentIndex,
      onCompleteSession,
      problems.length,
      settings.soundEnabled,
    ]
  );

  const handleSubmit = useCallback(() => {
    if (!currentProblem || inputValue.length === 0 || feedback !== null || isFinished) {
      return;
    }

    ensureAudioStarted();
    const numeric = Number.parseInt(inputValue, 10);
    const timeMs = Math.max(300, Date.now() - taskStartRef.current);
    const isCorrect = numeric === currentProblem.answer;
    const nextStreak = isCorrect ? streak + 1 : 0;
    const points = calculateTaskPoints(isCorrect, timeMs, showHint, streak);
    const quality = computeResponseQuality(isCorrect, timeMs, showHint);

    if (isCorrect) {
      if (nextStreak >= 3 && nextStreak % 3 === 0) {
        playTone('streak', settings.soundEnabled, nextStreak);
      } else {
        playTone('correct', settings.soundEnabled, nextStreak);
      }
      const praise =
        nextStreak >= 5
          ? `Super seria ${nextStreak}×! +${points} XP`
          : timeMs <= FAST_THRESHOLD_MS
          ? `Na wyrywki! +${points} XP`
          : nextStreak >= 3
          ? `Seria ${nextStreak}×! +${points} XP`
          : `Świetnie! +${points} XP`;
      setBurstLabel(praise);
      setBurstKey((k) => k + 1);
    } else {
      playTone('wrong', settings.soundEnabled);
      setShakeWrong(true);
      setShowHint(true);
      window.setTimeout(() => setShakeWrong(false), 380);
    }

    const attempt: TaskAttempt = {
      problem: currentProblem,
      userAnswer: numeric,
      isCorrect,
      timeMs,
      usedHint: showHint,
      pointsEarned: points,
      quality,
    };

    const nextAttempts = [...attempts, attempt];
    setAttempts(nextAttempts);
    setStreak(nextStreak);
    if (nextStreak > bestStreak) {
      setBestStreak(nextStreak);
    }
    setTotalPoints((prev) => prev + points);
    setFeedback({
      isCorrect,
      points,
      timeMs,
      correctAnswer: currentProblem.answer,
    });

    if (isCorrect) {
      window.setTimeout(() => {
        advanceToNext(nextAttempts);
      }, 950);
    }
  }, [
    advanceToNext,
    attempts,
    currentProblem,
    ensureAudioStarted,
    feedback,
    inputValue,
    isFinished,
    settings.soundEnabled,
    showHint,
    streak,
  ]);

  // Allow Enter key to advance after a wrong answer feedback
  useEffect(() => {
    if (!feedback || feedback.isCorrect || isFinished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advanceToNext(attempts);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advanceToNext, attempts, feedback, isFinished]);

  const handleRestartSeries = () => {
    const fresh = selectAdaptiveSeries({
      mode: config.mode,
      maxRange: config.maxRange,
      count: config.taskCount,
      memories,
      focusFactIds: config.focusFactIds,
    });
    setProblems(fresh);
    setCurrentIndex(0);
    setInputValue('');
    setAttempts([]);
    setStreak(0);
    setBestStreak(0);
    setTotalPoints(0);
    setShowHint(false);
    setHintAutoTriggered(false);
    setHintDismissed(false);
    setFeedback(null);
    setElapsedTaskMs(0);
    setIsFinished(false);
    setBurstKey(0);
    lastTickSecRef.current = -1;
    recordedRef.current = false;
    taskStartRef.current = Date.now();
    seriesStartRef.current = Date.now();
  };

  if (isFinished) {
    const totalTimeMs = attempts.reduce((acc, a) => acc + a.timeMs, 0);
    const avgTimeMs = attempts.length > 0 ? Math.round(totalTimeMs / attempts.length) : 0;
    const correctCount = attempts.filter((a) => a.isCorrect).length;
    const accuracyPct =
      attempts.length > 0 ? Math.round((correctCount / attempts.length) * 100) : 0;
    const passed = config.masterLevel
      ? isMasterChallengePassed(accuracyPct, avgTimeMs, config.passAccuracyPct ?? 85, config.targetAvgTimeSec ?? 99)
      : config.passAccuracyPct
      ? accuracyPct >= config.passAccuracyPct
      : true;

    const sortedByTime = [...attempts].sort((a, b) => b.timeMs - a.timeMs);
    const hardOrSlowIds = Array.from(
      new Set(
        attempts
          .filter((a) => !a.isCorrect || a.timeMs > 4500 || a.usedHint)
          .map((a) => a.problem.id)
      )
    );

    const tournament = config.tournamentId
      ? TOURNAMENTS.find((t) => t.id === config.tournamentId)
      : undefined;
    const medal = tournament
      ? computeTournamentMedal(tournament, accuracyPct, Math.round(totalTimeMs / 1000))
      : null;

    const stageDef = config.stageId ? LEVEL_STAGES.find((st) => st.id === config.stageId) : undefined;
    const certificate: CertificateData | null =
      tournament && medal && medal !== 'brak'
        ? {
            kind: 'tournament',
            playerName,
            title: tournament.title,
            distinction: { puchar: 'Puchar Mistrza', zloto: 'Złoty Medal', srebro: 'Srebrny Medal', braz: 'Brązowy Medal' }[medal],
            accuracyPct,
            tasks: attempts.length,
            totalTimeSec: totalTimeMs / 1000,
            avgTimeSec: avgTimeMs / 1000,
            maxRange: config.maxRange,
            dateMs: Date.now(),
            primaryColor: themePrimary,
            accentColor: themeAccent,
          }
        : passed && (stageDef || config.masterLevel)
        ? {
            kind: stageDef ? 'stage' : 'master',
            playerName,
            title: stageDef ? stageDef.title : config.title,
            distinction: stageDef?.badgeName,
            accuracyPct,
            tasks: attempts.length,
            avgTimeSec: avgTimeMs / 1000,
            totalTimeSec: totalTimeMs / 1000,
            maxRange: config.maxRange,
            dateMs: Date.now(),
            primaryColor: themePrimary,
            accentColor: themeAccent,
          }
        : null;

    const medalLabels: Record<string, string> = {
      puchar: 'Puchar Mistrza (100% + Złoty Czas)',
      zloto: 'Złoty Medal',
      srebro: 'Srebrny Medal',
      braz: 'Brązowy Medal',
      brak: 'Poniżej progu kwalifikacji',
    };

    return (
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10 animate-pop-in">
        <div className="relative bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-6 sm:p-8 shadow-sm overflow-hidden">
          {passed && (
            <CelebrationBurst
              triggerKey={burstKey}
              variant="grand"
              label={medal && medal !== 'brak' ? medalLabels[medal] : 'Brawo! Seria ukończona'}
              streak={5}
            />
          )}

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--th-border)]">
            <div>
              <p className="text-xs font-semibold text-[var(--th-text-muted)]">
                Podsumowanie serii · {config.title}
              </p>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[var(--th-text)]">
                {passed
                  ? 'Świetna robota! Seria zaliczona'
                  : 'Dobry trening! Jeszcze chwila do progu'}
              </h1>
              {config.passAccuracyPct && (
                <p className="mt-1 text-sm text-[var(--th-text-muted)]">
                  Próg przejścia: <strong className="tabular-nums text-[var(--th-text)]">{config.passAccuracyPct}%</strong>{' '}
                  · Twój wynik: <strong className="tabular-nums text-[var(--th-text)]">{accuracyPct}%</strong>
                </p>
              )}
              {config.masterLevel && config.targetAvgTimeSec && (
                <p className="mt-1 text-sm text-[var(--th-text-muted)]">
                  Limit tempa: <strong className="tabular-nums text-[var(--th-text)]">{config.targetAvgTimeSec.toFixed(1).replace('.', ',')} s</strong>{' '}
                  · Twoje tempo: <strong className="tabular-nums text-[var(--th-text)]">{formatSeconds(avgTimeMs)} s</strong>
                  {passed && <span className="block font-bold text-[var(--th-primary)]">Awans! Następny poziom Wyzwania Mistrza odblokowany.</span>}
                </p>
              )}
              {medal && (
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-amber-500">
                  <Award className="w-4 h-4" aria-hidden="true" />
                  <span>Wynik turniejowy: {medalLabels[medal]}</span>
                </p>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-3 bg-[var(--th-soft-tint)] border border-[var(--th-soft-tint-border)] rounded-2xl px-4 py-3">
              <Zap className="w-6 h-6 text-[var(--th-primary)]" aria-hidden="true" />
              <div>
                <div className="text-xs font-medium text-[var(--th-text-muted)]">Zdobyte punkty</div>
                <div className="font-display text-2xl font-bold text-[var(--th-primary)] tabular-nums">
                  +{totalPoints} XP
                </div>
              </div>
            </div>
          </div>

          {/* 4-column Summary Metrics */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 my-6">
            <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-4">
              <div className="text-xs font-medium text-[var(--th-text-muted)]">Skuteczność</div>
              <div className="mt-1 font-display text-2xl font-bold text-[var(--th-text)] tabular-nums">
                {accuracyPct}%
              </div>
              <div className="text-xs text-[var(--th-text-muted)] tabular-nums">
                {correctCount} z {attempts.length} zadań
              </div>
            </div>

            <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-4">
              <div className="text-xs font-medium text-[var(--th-text-muted)]">Czas całej serii</div>
              <div className="mt-1 font-display text-2xl font-bold text-[var(--th-text)] tabular-nums">
                {formatSeconds(totalTimeMs)} s
              </div>
              <div className="text-xs text-[var(--th-text-muted)]">Łączny czas namysłu</div>
            </div>

            <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-4">
              <div className="text-xs font-medium text-[var(--th-text-muted)]">Średnio na zadanie</div>
              <div className="mt-1 font-display text-2xl font-bold text-[var(--th-text)] tabular-nums">
                {formatSeconds(avgTimeMs)} s
              </div>
              <div className="text-xs text-[var(--th-text-muted)]">
                {avgTimeMs <= FAST_THRESHOLD_MS ? 'Tempo na wyrywki!' : 'Cel: poniżej 2,8 s'}
              </div>
            </div>

            <div className="bg-[var(--th-surface-muted)] border border-[var(--th-border)] rounded-2xl p-4">
              <div className="text-xs font-medium text-[var(--th-text-muted)]">Wymaga uwagi</div>
              <div className="mt-1 font-display text-2xl font-bold text-[var(--th-text)] tabular-nums">
                {hardOrSlowIds.length}
              </div>
              <div className="text-xs text-[var(--th-text-muted)]">Zadań do powtórki</div>
            </div>
          </div>

          {/* Shareable Graphical Souvenir Card (WhatsApp / PNG / Social) */}
          <div className="relative z-10 mb-6">
            <VictoryPosterCard
              payload={{
                playerName,
                seriesTitle: config.title,
                accuracyPct,
                correctCount,
                totalTasks: attempts.length,
                totalTimeSec: totalTimeMs / 1000,
                avgTimeSec: avgTimeMs / 1000,
                pointsEarned: totalPoints,
                streakBest: Math.max(bestStreak, streak),
                passed,
                isStageOrTournament: Boolean(config.stageId || config.tournamentId),
                badgeOrMedalTitle:
                  medal && medal !== 'brak'
                    ? medalLabels[medal]
                    : config.stageId && passed
                    ? LEVEL_STAGES.find((s) => s.id === config.stageId)?.badgeName
                    : undefined,
                primaryColor: themePrimary,
                accentColor: themeAccent,
                avatarSpec,
              }}
            />
          </div>

          {certificate && (
            <div className="relative z-10 mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-amber-600 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-display font-extrabold">Zdobyto certyfikat!</p>
                  <p className="text-sm">Wydrukuj go albo pokaż rodzinie — z Twoim imieniem i wynikiem.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCertOpen(true)}
                className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Award className="w-4 h-4" aria-hidden="true" /> Zobacz certyfikat
              </button>
            </div>
          )}
          {certOpen && certificate && <CertificateDialog data={certificate} onClose={() => setCertOpen(false)} />}

          {/* Per-Task Timing Breakdown */}
          <div className="relative z-10">
            <h2 className="font-display text-lg font-bold text-[var(--th-text)]">
              Czas namysłu nad każdym działaniem (od najdłuższego)
            </h2>
            <p className="text-sm text-[var(--th-text-muted)] mb-3">
              Aplikacja zapamiętała wyniki w algorytmie SuperMemo — trudne lub wolne działania wrócą częściej.
            </p>
            <div className="divide-y divide-[var(--th-border)] border border-[var(--th-border)] rounded-2xl overflow-hidden">
              {sortedByTime.map((att, idx) => {
                const statusLabel = !att.isCorrect
                  ? `Błąd (wpisano ${att.userAnswer})`
                  : att.timeMs <= FAST_THRESHOLD_MS && !att.usedHint
                  ? 'Na wyrywki'
                  : att.timeMs > 5000
                  ? 'Długi namysł'
                  : 'Dobrze';
                return (
                  <div
                    key={`${att.problem.id}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[var(--th-surface)] text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          !att.isCorrect
                            ? 'bg-red-500'
                            : att.timeMs <= FAST_THRESHOLD_MS
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="font-display font-bold text-base text-[var(--th-text)] tabular-nums">
                        {att.problem.display} = {att.problem.answer}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs sm:text-sm tabular-nums">
                      <span
                        className={`font-semibold ${
                          !att.isCorrect
                            ? 'text-red-500'
                            : att.timeMs <= FAST_THRESHOLD_MS
                            ? 'text-emerald-500'
                            : 'text-amber-500'
                        }`}
                      >
                        {statusLabel}
                      </span>
                      <span className="text-[var(--th-text-muted)]" aria-hidden="true">·</span>
                      <span className="font-mono font-semibold text-[var(--th-text)]">
                        {formatSeconds(att.timeMs)} s
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Actions */}
          <div className="relative z-10 mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={onExit}
              className="px-5 py-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface-muted)] text-[var(--th-text)] font-semibold hover:opacity-90 transition-colors cursor-pointer"
            >
              Wróć do panelu
            </button>

            <div className="flex flex-col sm:flex-row gap-3">
              {hardOrSlowIds.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onRestartWithFocus(
                      hardOrSlowIds,
                      'Powtórka najtrudniejszych z serii'
                    )
                  }
                  className="px-5 py-3 rounded-xl bg-[var(--th-accent)] hover:bg-[var(--th-accent-hover)] text-[var(--th-accent-fg)] font-bold border-b-4 border-[var(--th-accent-dark)] active:border-b-2 active:translate-y-[2px] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Target className="w-4 h-4" aria-hidden="true" />
                  <span>Przećwicz trudne ({hardOrSlowIds.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleRestartSeries}
                className="px-5 py-3 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-bold border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Zagraj serię ponownie</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progressPct = Math.round(((currentIndex + (feedback ? 1 : 0)) / problems.length) * 100);
  const elapsedSec = elapsedTaskMs / 1000;
  const remainingPaceSec = Math.max(0, paceTargetSec - elapsedSec);
  const pacePct = Math.max(0, Math.min(100, (remainingPaceSec / paceTargetSec) * 100));
  const isTimeWarning =
    feedback === null && elapsedSec >= Math.max(3, paceTargetSec - 4) && elapsedSec <= paceTargetSec + 1;
  const isTimeExpired = feedback === null && elapsedSec > paceTargetSec + 1;

  return (
    <div
      className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6"
      data-testid="exercise-arena"
    >
      {/* Top Arena Progress, Audio Controls & Exit Bar */}
      <div className="flex items-center justify-between gap-2.5 sm:gap-4 mb-4 sm:mb-6">
        <button
          type="button"
          onClick={onExit}
          aria-label="Zakończ serię i wróć"
          className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] hover:opacity-90 text-[var(--th-text)] font-semibold text-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Zakończ</span>
        </button>

        {/* Progress Bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--th-text-muted)] mb-1.5 tabular-nums gap-2">
            <span className="truncate">{config.title}</span>
            <span className="shrink-0">
              Zadanie {currentIndex + 1} z {problems.length}
            </span>
          </div>
          <div className="h-3 bg-[var(--th-border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--th-primary)] rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Audio / Music Toggles + Live XP & Streak */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {onUpdateSettings && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onUpdateSettings({ musicEnabled: !musicEnabled })}
                aria-label={musicEnabled ? 'Wyłącz muzykę w tle' : 'Włącz muzykę w tle'}
                aria-pressed={musicEnabled}
                title={musicEnabled ? 'Muzyka w tle: włączona' : 'Muzyka w tle: wyłączona'}
                className={`min-h-[40px] min-w-[40px] px-2.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  musicEnabled
                    ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)] text-[var(--th-primary)]'
                    : 'bg-[var(--th-surface)] border-[var(--th-border)] text-[var(--th-text-muted)]'
                }`}
              >
                <Music className="w-4 h-4" aria-hidden="true" />
                <span className="hidden md:inline">{musicEnabled ? 'Muzyka' : 'Cisza'}</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                aria-label={settings.soundEnabled ? 'Wyłącz dźwięki' : 'Włącz dźwięki'}
                aria-pressed={settings.soundEnabled}
                title={settings.soundEnabled ? 'Dźwięki: włączone' : 'Dźwięki: wyłączone'}
                className={`min-h-[40px] min-w-[40px] px-2 rounded-xl border inline-flex items-center justify-center cursor-pointer transition-colors ${
                  settings.soundEnabled
                    ? 'bg-[var(--th-surface)] border-[var(--th-border)] text-[var(--th-text)]'
                    : 'bg-[var(--th-surface)] border-[var(--th-border)] text-[var(--th-text-muted)]'
                }`}
              >
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <VolumeX className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          )}

          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold tabular-nums">
            {streak >= 2 && (
              <span className="inline-flex items-center gap-1 text-amber-500">
                <Flame className="w-4 h-4" aria-hidden="true" />
                {streak}×
              </span>
            )}
            <span className="text-[var(--th-primary)]">+{totalPoints} XP</span>
          </div>
        </div>
      </div>

      {/* Main Responsive Stage: 2 Columns on Desktop/Landscape Tablet, Stacked on Phone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 [@media(max-height:720px)]:gap-2.5 sm:gap-6 items-start">
        {/* Left / Top Stage: Equation Card + Visual Hint */}
        <div className="lg:col-span-7 flex flex-col gap-3 sm:gap-4">
          <div
            className={`relative bg-[var(--th-surface)] border rounded-3xl p-5 sm:p-8 [@media(max-height:720px)]:p-3.5 shadow-sm transition-colors overflow-hidden ${
              shakeWrong
                ? 'animate-shake border-red-500'
                : isTimeWarning
                ? 'border-amber-500'
                : 'border-[var(--th-border)]'
            }`}
          >
            {/* Star & Confetti Celebration Burst on Correct Answer */}
            {feedback?.isCorrect && (
              <CelebrationBurst
                triggerKey={burstKey}
                variant="correct"
                label={burstLabel}
                streak={streak}
              />
            )}

            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--th-text-muted)] mb-2">
              <span>
                {currentProblem?.op === 'mul' ? 'Mnożenie' : 'Dzielenie'} · Zakres do {config.maxRange}
              </span>
              {settings.showLiveTimer && (
                <span
                  data-testid="live-task-timer"
                  className={`inline-flex items-center gap-1.5 font-mono tabular-nums transition-transform duration-150 ${
                    tickPulse ? 'scale-110' : 'scale-100'
                  } ${
                    isTimeWarning
                      ? 'text-amber-500 font-bold'
                      : isTimeExpired
                      ? 'text-[var(--th-text-muted)]'
                      : 'text-[var(--th-text)]'
                  }`}
                >
                  <Clock
                    className={`w-3.5 h-3.5 ${
                      isTimeWarning ? 'text-amber-500' : 'text-[var(--th-text-muted)]'
                    }`}
                    aria-hidden="true"
                  />
                  {formatSeconds(elapsedTaskMs)} s
                  {isTimeWarning && (
                    <span className="ml-1 text-[11px] font-sans font-bold text-amber-500">
                      (Czas na bonus!)
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Soft Time Pace Bar */}
            {settings.showLiveTimer && (
              <div
                className="h-1.5 w-full bg-[var(--th-surface-muted)] rounded-full overflow-hidden mb-4 sm:mb-5"
                aria-hidden="true"
              >
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    isTimeWarning
                      ? 'bg-amber-500'
                      : isTimeExpired
                      ? 'bg-slate-400'
                      : 'bg-[var(--th-primary)]'
                  }`}
                  style={{ width: `${pacePct}%` }}
                />
              </div>
            )}

            {/* Big Equation Display */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 pt-3 pb-1 sm:pt-8 sm:pb-6">
              <span
                className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--th-text)] tabular-nums"
                data-testid="equation-text"
              >
                {currentProblem?.display}
              </span>
              <span className="font-display text-4xl sm:text-6xl font-bold text-[var(--th-text-muted)]">
                =
              </span>
              <div
                aria-label="Wpisana odpowiedź"
                data-testid="answer-display"
                className={`min-w-[92px] sm:min-w-[124px] h-16 sm:h-20 px-4 rounded-2xl border-2 flex items-center justify-center font-display text-4xl sm:text-5xl font-extrabold tabular-nums transition-colors ${
                  feedback
                    ? feedback.isCorrect
                      ? isDark
                        ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300'
                        : 'bg-emerald-50 border-emerald-500 text-emerald-700'
                      : isDark
                      ? 'bg-red-950/60 border-red-400 text-red-300'
                      : 'bg-red-50 border-red-400 text-red-700'
                    : inputValue.length > 0
                    ? 'bg-[var(--th-soft-tint)] border-[var(--th-primary)] text-[var(--th-text)]'
                    : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text-muted)]'
                }`}
              >
                {inputValue.length > 0 ? inputValue : '?'}
              </div>
            </div>

            {/* Stały slot pod działaniem: przycisk podpowiedzi / podpowiedź / informacja zwrotna.
                Ma stałą wysokość, więc nic nie przesuwa działania ani klawiatury. */}
            <div
              data-testid="hint-slot"
              className={`relative mt-2 sm:mt-4 h-[124px] sm:h-[140px] [@media(max-height:720px)]:h-[100px] [@media(max-height:720px)]:mt-1 rounded-2xl border px-3 sm:px-4 py-2 sm:py-3 overflow-hidden transition-colors ${
                feedback
                  ? feedback.isCorrect
                    ? isDark
                      ? 'bg-emerald-950/45 border-emerald-700 text-emerald-100'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : isDark
                    ? 'bg-red-950/45 border-red-700 text-red-100'
                    : 'bg-red-50 border-red-200 text-red-900'
                  : showHint && visualHint
                  ? isDark
                    ? 'bg-amber-950/40 border-amber-700/60'
                    : 'bg-amber-50 border-amber-200'
                  : 'border-transparent'
              }`}
            >
              {feedback ? (
                feedback.isCorrect ? (
                  <div className="h-full flex items-center justify-center gap-2.5 text-center">
                    <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-500" aria-hidden="true" />
                    <div className="text-sm sm:text-base font-semibold">
                      {feedback.timeMs <= FAST_THRESHOLD_MS
                        ? 'Błyskawicznie na wyrywki!'
                        : 'Brawo, poprawna odpowiedź!'}{' '}
                      <span className="tabular-nums font-bold whitespace-nowrap">
                        +{feedback.points} XP · {formatSeconds(feedback.timeMs)} s
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 text-sm sm:text-base font-semibold">
                        <XCircle className="w-5 h-5 shrink-0 text-red-500" aria-hidden="true" />
                        <span className="truncate">
                          Wynik:{' '}
                          <strong className="font-display text-xl tabular-nums">
                            {feedback.correctAnswer}
                          </strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => advanceToNext(attempts)}
                        className="min-h-[44px] px-4 rounded-xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] text-sm font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <span>Następne</span>
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                    {visualHint && (
                      <div className="flex-1 min-h-0">
                        <VisualHintCard hint={visualHint} isDark={isDark} bare />
                      </div>
                    )}
                  </div>
                )
              ) : showHint && visualHint ? (
                <VisualHintCard
                  hint={visualHint}
                  isAutoTriggered={hintAutoTriggered}
                  isDark={isDark}
                  onCollapse={() => {
                    setShowHint(false);
                    setHintAutoTriggered(false);
                    setHintDismissed(true);
                  }}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowHint(true);
                      setHintAutoTriggered(false);
                    }}
                    className={`min-h-[48px] px-5 rounded-2xl text-sm sm:text-base font-semibold border flex items-center gap-2 transition-colors cursor-pointer ${
                      isDark
                        ? 'text-amber-200 bg-amber-950/50 hover:bg-amber-900/50 border-amber-700/60'
                        : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200'
                    }`}
                  >
                    <Lightbulb className="w-5 h-5" aria-hidden="true" />
                    <span>Pokaż podpowiedź</span>
                  </button>
                  <HelpButton section="hints" label="Podpowiedzi" className="absolute right-2 bottom-2" />
                  <span className="text-xs text-[var(--th-text-muted)] hidden lg:inline">
                    Możesz też użyć klawiatury komputera (0–9, Enter)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right / Bottom Stage: Calculator Keypad */}
        <div className="lg:col-span-5">
          <CalculatorKeypad
            value={inputValue}
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onClear={handleClear}
            onSubmit={handleSubmit}
            disabled={feedback !== null}
            compact={isCompactPhone}
            submitLabel={feedback && !feedback.isCorrect ? 'Sprawdzono' : 'Sprawdź'}
          />
        </div>
      </div>
    </div>
  );
}
