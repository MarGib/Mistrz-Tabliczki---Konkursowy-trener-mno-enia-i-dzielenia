import { ArrowLeft, Check, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setGameActive } from '../autoUpdate';
import { nearMiss } from '../engine/games';
import { GAME_LIMITS, attachIntegrity, createIntegritySensor } from '../engine/integrity';
import { lessonStars } from '../engine/path';
import { buildSeriesProblems, makeSession } from '../engine/seriesRules';
import { computeResponseQuality } from '../engine/spacedRepetition';
import { playTone } from '../utils/sound';
import type { ActiveSeriesConfig, FactMemory, SessionRecord, TaskAttempt } from '../types/math';
import { GameResult } from './GameResult';

interface Props {
  config: ActiveSeriesConfig;
  memories: Record<string, FactMemory>;
  soundEnabled: boolean;
  onCompleteSession: (session: SessionRecord, attempts: TaskAttempt[]) => void;
  onExit: () => void;
  /** Zaliczona kropka → od razu następna kropka ścieżki. */
  onContinue?: () => void;
}

/** Gra „Prawda czy fałsz”: 60 sekund, dwa wielkie przyciski. Uczy wyłapywać „prawie dobre” wyniki. */
export function TrueFalseGame({ config, memories, soundEnabled, onCompleteSession, onExit, onContinue }: Props) {
  const [round, setRound] = useState(0);
  // Zadania losujemy raz na rundę. Pamięć z chwili startu — synchronizacja w tle
  // (nowy obiekt postępów) nie może podmieniać pytania, na które dziecko jeszcze nie odpowiedziało.
  const memoriesRef = useRef(memories);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const problems = useMemo(() => buildSeriesProblems({ ...config, gap: false, story: false }, memoriesRef.current), [config, round]);
  const shown = useMemo(() => problems.map((p) => (Math.random() < 0.5 ? p.answer : nearMiss(p))), [problems]);
  const [idx, setIdx] = useState(0);
  const [attempts, setAttempts] = useState<TaskAttempt[]>([]);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const [left, setLeft] = useState(config.timeLimitSec ?? 60);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const startRef = useRef(Date.now());
  const taskRef = useRef(Date.now());
  const attemptsRef = useRef<TaskAttempt[]>([]);
  attemptsRef.current = attempts;
  // Uczciwa gra: liczniki zdarzeń ze skryptu i chowania aplikacji (bez treści).
  const sensorRef = useRef<ReturnType<typeof createIntegritySensor> | null>(null);
  if (!sensorRef.current) sensorRef.current = createIntegritySensor();
  useEffect(() => {
    const sensor = sensorRef.current!;
    sensor.start();
    return () => sensor.stop();
  }, []);

  useEffect(() => {
    setGameActive(!session);
    return () => setGameActive(false);
  }, [session]);

  const finish = useCallback(() => {
    if (session) return;
    const s = makeSession(config, attemptsRef.current);
    attachIntegrity(s, attemptsRef.current, sensorRef.current!.signals(), GAME_LIMITS.truefalse);
    setSession(s);
    if (attemptsRef.current.length > 0) onCompleteSession(s, attemptsRef.current);
    playTone('finish', soundEnabled);
  }, [config, onCompleteSession, session, soundEnabled]);

  useEffect(() => {
    if (session) return;
    const limit = (config.timeLimitSec ?? 60) * 1000;
    const t = window.setInterval(() => {
      const l = Math.max(0, Math.ceil((limit - (Date.now() - startRef.current)) / 1000));
      setLeft(l);
      if (l <= 0) {
        window.clearInterval(t);
        finish();
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [config.timeLimitSec, finish, session]);

  const answer = useCallback(
    (saysTrue: boolean) => {
      if (session || flash || idx >= problems.length) return;
      const p = problems[idx];
      const isTrue = shown[idx] === p.answer;
      const correct = saysTrue === isTrue;
      const rawMs = Date.now() - taskRef.current;
      const timeMs = Math.max(250, rawMs);
      const att: TaskAttempt = {
        problem: p,
        userAnswer: shown[idx],
        isCorrect: correct,
        timeMs,
        usedHint: false,
        pointsEarned: correct ? 5 : 0,
        quality: computeResponseQuality(correct, timeMs, false),
      };
      sensorRef.current?.answer(rawMs, correct);
      setAttempts((a) => [...a, att]);
      setFlash(correct ? 'ok' : 'bad');
      playTone(correct ? 'correct' : 'wrong', soundEnabled, 1);
      window.setTimeout(
        () => {
          setFlash(null);
          setIdx((i) => i + 1);
          taskRef.current = Date.now();
          if (idx + 1 >= problems.length) finish();
        },
        correct ? 280 : 900
      );
    },
    [finish, flash, idx, problems, session, shown, soundEnabled]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'p') answer(true);
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'f') answer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer]);

  const correct = attempts.filter((a) => a.isCorrect).length;

  if (session) {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6">
        <GameResult
          session={session}
          stars={lessonStars(session, config)}
          summary={`Dobrze oceniono ${session.correctTasks} z ${session.totalTasks} działań (${session.accuracyPct}%). Cel: co najmniej ${config.passMinCorrect ?? 10} i 80%.`}
          onExit={onExit}
          onContinue={onContinue}
          onAgain={() => {
            memoriesRef.current = memories;
            sensorRef.current?.reset();
            setRound((r) => r + 1);
            setIdx(0);
            setAttempts([]);
            setSession(null);
            setLeft(config.timeLimitSec ?? 60);
            startRef.current = Date.now();
            taskRef.current = Date.now();
          }}
        />
      </div>
    );
  }

  const p = problems[idx];
  const wrongNow = flash === 'bad' && p && shown[idx] !== p.answer;
  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-3 sm:py-6 space-y-4 min-h-[calc(100svh-1.5rem)] flex flex-col" data-testid="truefalse-game">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onExit} className="min-h-[44px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] font-bold inline-flex items-center gap-1.5 cursor-pointer">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Zakończ
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--th-text-muted)] truncate">✅ {config.title}</p>
          <div className="h-3 rounded-full bg-[var(--th-border)] overflow-hidden">
            <div className="h-full bg-[var(--th-primary)] transition-all" style={{ width: `${(left / (config.timeLimitSec ?? 60)) * 100}%` }} />
          </div>
        </div>
        <p className="font-display font-bold tabular-nums" data-testid="time-left">⏱ {left} s · ✓ {correct}</p>
      </div>

      <div
        className={`flex-1 rounded-3xl border-2 flex flex-col items-center justify-center gap-3 p-6 transition-colors ${
          flash === 'ok' ? 'border-emerald-400 bg-emerald-50' : flash === 'bad' ? 'border-red-400 bg-red-50' : 'border-[var(--th-border)] bg-[var(--th-surface)]'
        }`}
      >
        <p className="text-sm font-bold text-[var(--th-text-muted)]">Czy to prawda?</p>
        <p className="font-display font-extrabold tabular-nums text-[clamp(3rem,12vw,6rem)] leading-none text-center" data-testid="tf-statement">
          {p ? `${p.display} = ${shown[idx]}` : ''}
        </p>
        <p className="h-6 text-base font-bold text-red-700">{wrongNow ? `Nie — ${p.display} = ${p.answer}` : flash === 'bad' ? 'To była prawda!' : ''}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => answer(true)}
          className="min-h-[clamp(80px,16vh,140px)] rounded-3xl bg-emerald-500 text-white font-display text-2xl sm:text-3xl font-extrabold border-b-[6px] border-emerald-700 active:border-b-2 active:translate-y-[3px] inline-flex items-center justify-center gap-2 cursor-pointer [touch-action:manipulation]"
          data-testid="tf-true"
        >
          <Check className="w-8 h-8" strokeWidth={3} aria-hidden="true" /> Prawda
        </button>
        <button
          type="button"
          onClick={() => answer(false)}
          className="min-h-[clamp(80px,16vh,140px)] rounded-3xl bg-red-500 text-white font-display text-2xl sm:text-3xl font-extrabold border-b-[6px] border-red-700 active:border-b-2 active:translate-y-[3px] inline-flex items-center justify-center gap-2 cursor-pointer [touch-action:manipulation]"
          data-testid="tf-false"
        >
          <X className="w-8 h-8" strokeWidth={3} aria-hidden="true" /> Fałsz
        </button>
      </div>
      <p className="text-center text-xs text-[var(--th-text-muted)] hidden sm:block">Klawiatura: ← prawda, → fałsz</p>
    </div>
  );
}
