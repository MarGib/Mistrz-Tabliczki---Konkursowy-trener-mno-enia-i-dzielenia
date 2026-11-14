/** Logika gier: fałszywe wyniki „prawie dobre” i dobór par z różnymi wynikami. */
import type { MathProblem } from '../types/math';

/** Wynik „prawie dobry” — typowa pomyłka dziecka (sąsiedni wiersz tabliczki, ±1/±2, zamienione cyfry). */
export function nearMiss(p: MathProblem, rng: () => number = Math.random): number {
  const ans = p.answer;
  const cands = new Set<number>();
  if (p.op === 'mul') {
    cands.add(ans + p.a);
    cands.add(ans - p.a);
    cands.add(ans + p.b);
    cands.add(ans - p.b);
  } else {
    cands.add(ans + 1);
    cands.add(ans - 1);
  }
  cands.add(ans + 1);
  cands.add(ans - 2);
  if (ans >= 10) {
    const s = String(ans);
    const rev = Number(s.split('').reverse().join(''));
    if (rev !== ans) cands.add(rev);
  }
  const list = [...cands].filter((n) => n > 0 && n !== ans);
  return list[Math.floor(rng() * list.length)] ?? ans + 1;
}

/** Pary: zadania z różnymi wynikami (żeby dopasowanie było jednoznaczne). */
export function distinctAnswers(problems: MathProblem[], n: number): MathProblem[] {
  const seen = new Set<number>();
  const out: MathProblem[] = [];
  for (const p of problems) {
    if (seen.has(p.answer)) continue;
    seen.add(p.answer);
    out.push(p);
    if (out.length >= n) break;
  }
  return out;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
