/**
 * Rekordy osobiste — nagroda zależna od postępu, a nie tylko od wyniku.
 * Porównujemy z wcześniejszymi seriami w tym samym przedziale (do 100 / powyżej 100).
 */
import type { SessionRecord } from '../types/math';

type Lite = Pick<SessionRecord, 'avgTimeMs' | 'accuracyPct' | 'totalTasks' | 'maxRange' | 'masterLevel'>;

const bucket = (r?: number) => ((r ?? 100) <= 100 ? 'do100' : 'ponad100');

export interface RecordNews {
  kind: 'tempo' | 'first-perfect';
  text: string;
}

export function personalRecord(past: Lite[], current: Lite): RecordNews | null {
  if (current.totalTasks < 8) return null;
  const same = past.filter((s) => s.totalTasks >= 8 && bucket(s.maxRange) === bucket(current.maxRange));
  const sec = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');
  if (current.accuracyPct >= 90 && current.avgTimeMs > 0) {
    const prev = same.filter((s) => s.accuracyPct >= 90 && s.avgTimeMs > 0);
    if (prev.length >= 2) {
      const best = Math.min(...prev.map((s) => s.avgTimeMs));
      if (current.avgTimeMs < best - 50) {
        return { kind: 'tempo', text: `Nowy rekord tempa: ${sec(current.avgTimeMs)} s na zadanie (poprzednio ${sec(best)} s)!` };
      }
    }
  }
  if (current.accuracyPct === 100 && current.totalTasks >= 10 && same.length >= 1 && !same.some((s) => s.accuracyPct === 100 && s.totalTasks >= 10)) {
    return { kind: 'first-perfect', text: 'Pierwsza seria bez ani jednego błędu! 🎯' };
  }
  return null;
}
