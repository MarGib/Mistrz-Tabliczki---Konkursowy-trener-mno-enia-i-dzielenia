import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { SessionRecord } from '../types/math';

/** Wynik gry / kropki: zaliczona czy nie, gwiazdki, co dalej. Bez kar i bez straszenia. */
export function GameResult({
  session,
  stars,
  summary,
  onExit,
  onAgain,
  onContinue,
}: {
  session: SessionRecord;
  stars: number;
  summary: string;
  onExit: () => void;
  onAgain: () => void;
  onContinue?: () => void;
}) {
  const ok = session.passedThreshold;
  return (
    <div className="max-w-xl mx-auto bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-sm" data-testid="game-result">
      <div className="text-5xl" aria-hidden="true">{ok ? '🎉' : '💪'}</div>
      <h2 className="font-display text-2xl font-extrabold">{ok ? 'Kropka zaliczona!' : 'Prawie! Spróbuj jeszcze raz'}</h2>
      {ok && (
        <p className="text-3xl tracking-widest text-amber-500" aria-label={`${stars} z 3 gwiazdek`} data-testid="stars">
          {'★'.repeat(stars)}
          <span className="text-[var(--th-border)]">{'★'.repeat(3 - stars)}</span>
        </p>
      )}
      <p className="text-base">{summary}</p>
      {!ok && <p className="text-sm text-[var(--th-text-muted)]">Każda próba się liczy — aplikacja zapamiętała, co poćwiczyć.</p>}
      <div className="grid sm:grid-cols-2 gap-2 pt-2">
        <button type="button" onClick={onAgain} className="min-h-[52px] rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface-muted)] font-bold inline-flex items-center justify-center gap-2 cursor-pointer">
          <RotateCcw className="w-4 h-4" aria-hidden="true" /> Jeszcze raz
        </button>
        <button
          type="button"
          onClick={ok && onContinue ? onContinue : onExit}
          className="min-h-[52px] rounded-2xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-bold border-b-4 border-[var(--th-primary-dark)] inline-flex items-center justify-center gap-2 cursor-pointer"
          data-testid="game-continue"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {ok ? 'Dalej po ścieżce' : 'Wróć do ścieżki'}
        </button>
      </div>
    </div>
  );
}
