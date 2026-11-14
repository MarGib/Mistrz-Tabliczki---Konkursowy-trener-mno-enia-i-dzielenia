import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setGameActive } from '../autoUpdate';
import { distinctAnswers, shuffle } from '../engine/games';
import { lessonStars } from '../engine/path';
import { buildSeriesProblems, makeSession } from '../engine/seriesRules';
import { computeResponseQuality } from '../engine/spacedRepetition';
import { playTone } from '../utils/sound';
import type { ActiveSeriesConfig, FactMemory, MathProblem, SessionRecord, TaskAttempt } from '../types/math';
import { GameResult } from './GameResult';
import { GAME_LIMITS, attachIntegrity, createIntegritySensor } from '../engine/integrity';

interface Props {
  config: ActiveSeriesConfig;
  memories: Record<string, FactMemory>;
  soundEnabled: boolean;
  onCompleteSession: (session: SessionRecord, attempts: TaskAttempt[]) => void;
  onExit: () => void;
  /** Zaliczona kropka → od razu następna kropka ścieżki. */
  onContinue?: () => void;
}

/** Gra „Pary”: połącz działanie z wynikiem. Odpoczynek od klawiatury, uczy kojarzenia. */
export function PairsGame({ config, memories, soundEnabled, onCompleteSession, onExit, onContinue }: Props) {
  // Pamięć z chwili startu — synchronizacja w tle nie może przetasować planszy w trakcie gry.
  const memoriesRef = useRef(memories);
  const n = config.taskCount || 6;
  const [round, setRound] = useState(0);
  const problems: MathProblem[] = useMemo(
    () => distinctAnswers(buildSeriesProblems({ ...config, gap: false, story: false, taskCount: n * 3 }, memoriesRef.current), n),
    [config, n, round] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const answers = useMemo(() => shuffle(problems.map((p) => p.answer)), [problems]);
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [errored, setErrored] = useState<Set<string>>(new Set());
  const [shake, setShake] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<TaskAttempt[]>([]);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [left, setLeft] = useState<number | null>(config.timeLimitSec ?? null);
  const startRef = useRef(Date.now());
  const lastRef = useRef(Date.now());
  const sensorRef = useRef<ReturnType<typeof createIntegritySensor> | null>(null);
  if (!sensorRef.current) sensorRef.current = createIntegritySensor();
  useEffect(() => {
    const sensor = sensorRef.current!;
    sensor.start();
    return () => sensor.stop();
  }, []);
  const stateRef = useRef({ attempts, matched });
  stateRef.current = { attempts, matched };

  useEffect(() => {
    setGameActive(!session);
    return () => setGameActive(false);
  }, [session]);

  const finish = useCallback(
    (atts: TaskAttempt[], matchedNow: Set<string>) => {
      if (session) return;
      // niedopasowane pary (koniec czasu) liczą się jako błędne
      const missing = problems
        .filter((p) => !matchedNow.has(p.id))
        .map<TaskAttempt>((p) => ({ problem: p, userAnswer: -1, isCorrect: false, timeMs: 5000, usedHint: false, pointsEarned: 0, quality: 1 }));
      const all = [...atts, ...missing];
      const s = makeSession(config, all);
      // Ocena tylko dopasowanych par (brakujące z końca czasu to nie odpowiedzi).
      attachIntegrity(s, atts, sensorRef.current!.signals(), GAME_LIMITS.pairs);
      setSession(s);
      onCompleteSession(s, all);
      playTone('finish', soundEnabled);
    },
    [config, onCompleteSession, problems, session, soundEnabled]
  );

  useEffect(() => {
    if (!config.timeLimitSec || session) return;
    const limit = config.timeLimitSec * 1000;
    const t = window.setInterval(() => {
      const l = Math.max(0, Math.ceil((limit - (Date.now() - startRef.current)) / 1000));
      setLeft(l);
      if (l <= 0) {
        window.clearInterval(t);
        finish(stateRef.current.attempts, stateRef.current.matched);
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [config.timeLimitSec, finish, session]);

  const pickAnswer = (value: number, i: number) => {
    if (!selected || session) return;
    const p = problems.find((x) => x.id === selected)!;
    if (p.answer === value) {
      const rawMs = Date.now() - lastRef.current;
      const timeMs = Math.max(400, rawMs);
      lastRef.current = Date.now();
      const firstTry = !errored.has(p.id);
      const att: TaskAttempt = {
        problem: p,
        userAnswer: value,
        isCorrect: firstTry,
        timeMs,
        usedHint: false,
        pointsEarned: firstTry ? 8 : 2,
        quality: computeResponseQuality(firstTry, timeMs, false),
      };
      sensorRef.current?.answer(rawMs, firstTry);
      const nextAtt = [...attempts, att];
      const nextMatched = new Set(matched).add(p.id);
      setAttempts(nextAtt);
      setMatched(nextMatched);
      setSelected(null);
      playTone('correct', soundEnabled, nextMatched.size);
      if (nextMatched.size === problems.length) window.setTimeout(() => finish(nextAtt, nextMatched), 400);
    } else {
      setErrored((e) => new Set(e).add(p.id));
      setShake(i);
      playTone('wrong', soundEnabled);
      window.setTimeout(() => setShake(null), 400);
    }
  };

  if (session) {
    const mistakes = errored.size;
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6">
        <GameResult
          session={session}
          stars={lessonStars(session, config)}
          summary={`Połączono ${matched.size} z ${problems.length} par${mistakes ? `, pomyłki przy ${mistakes}` : ' bez pomyłki'}.`}
          onExit={onExit}
          onContinue={onContinue}
          onAgain={() => {
            memoriesRef.current = memories;
            sensorRef.current?.reset();
            setRound((r) => r + 1);
            setMatched(new Set());
            setErrored(new Set());
            setAttempts([]);
            setSelected(null);
            setSession(null);
            setLeft(config.timeLimitSec ?? null);
            startRef.current = Date.now();
            lastRef.current = Date.now();
          }}
        />
      </div>
    );
  }

  const card = 'min-h-[clamp(56px,10vh,96px)] rounded-2xl border-2 font-display font-extrabold tabular-nums text-[clamp(1.25rem,3.6vh,2rem)] flex items-center justify-center px-2 transition-all cursor-pointer [touch-action:manipulation]';
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-6 space-y-4" data-testid="pairs-game">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onExit} className="min-h-[44px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-surface)] font-bold inline-flex items-center gap-1.5 cursor-pointer">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Zakończ
        </button>
        <p className="flex-1 min-w-0 text-sm font-semibold truncate">🧩 {config.title}</p>
        <p className="font-display font-bold tabular-nums">
          {matched.size}/{problems.length}
          {left !== null && <span data-testid="time-left"> · ⏱ {left} s</span>}
        </p>
      </div>
      <p className="text-sm text-[var(--th-text-muted)]">Dotknij działania, a potem jego wyniku.</p>
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <div className="space-y-2.5">
          {problems.map((p) => {
            const done = matched.has(p.id);
            const sel = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={done}
                onClick={() => setSelected(sel ? null : p.id)}
                className={`${card} w-full ${
                  done
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 opacity-60'
                    : sel
                      ? 'border-[var(--th-primary)] bg-[var(--th-soft-tint)] scale-[1.03]'
                      : 'border-[var(--th-border)] bg-[var(--th-surface)]'
                }`}
                data-testid="pair-problem"
              >
                {p.display}
              </button>
            );
          })}
        </div>
        <div className="space-y-2.5">
          {answers.map((a, i) => {
            const p = problems.find((x) => x.answer === a)!;
            const done = matched.has(p.id);
            return (
              <button
                key={`${a}-${i}`}
                type="button"
                disabled={done || !selected}
                onClick={() => pickAnswer(a, i)}
                className={`${card} w-full ${
                  done
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 opacity-60'
                    : shake === i
                      ? 'border-red-400 bg-red-50 animate-shake'
                      : 'border-[var(--th-border)] bg-[var(--th-surface-muted)]'
                } ${!selected && !done ? 'opacity-80' : ''}`}
                data-testid="pair-answer"
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
