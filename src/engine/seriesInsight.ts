import type { TaskAttempt } from '../types/math';

/** Jedno zdanie wniosku po serii — co konkretnie warto zapamiętać. */
export function seriesInsight(attempts: Pick<TaskAttempt, 'problem' | 'isCorrect' | 'timeMs' | 'usedHint'>[]): string | null {
  if (attempts.length === 0) return null;
  const sec = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');
  const fact = (a: (typeof attempts)[number]) => `${a.problem.display.replace(/\s*=?\s*\??$/, '')} = ${a.problem.answer}`;
  const wrong = attempts.filter((a) => !a.isCorrect);
  if (wrong.length > 0) {
    const list = Array.from(new Set(wrong.map(fact))).slice(0, 3);
    return list.length === 1 ? `Zapamiętaj: ${list[0]}.` : `Zapamiętaj: ${list.join(', ')}.`;
  }
  const slowest = [...attempts].sort((a, b) => b.timeMs - a.timeMs)[0];
  const avg = attempts.reduce((s, a) => s + a.timeMs, 0) / attempts.length;
  if (slowest.timeMs > Math.max(3500, avg * 1.8)) {
    return `Bez błędu! Najdłużej trwało ${fact(slowest)} (${sec(slowest.timeMs)} s) — warto je powtórzyć.`;
  }
  if (avg <= 2800) return `Bez błędu i szybko (średnio ${sec(avg)} s) — te działania znasz już na pamięć.`;
  return `Bez błędu! Średnio ${sec(avg)} s na zadanie — następnym razem spróbuj szybciej.`;
}
