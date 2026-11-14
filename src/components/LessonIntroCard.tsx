import { Lightbulb, Play } from 'lucide-react';
import type { LessonIntro } from '../types/math';

/** Karta „Poznaj” — sposób liczenia pokazany przed zadaniami. Bez presji czasu. */
export function LessonIntroCard({ intro, onStart }: { intro: LessonIntro; onStart: () => void }) {
  return (
    <div className="max-w-2xl mx-auto bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-5 sm:p-8 shadow-sm space-y-5" data-testid="lesson-intro">
      <div className="flex items-start gap-3">
        <span className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <Lightbulb className="w-6 h-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--th-text-muted)]">👀 Poznaj sposób</p>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold leading-tight">{intro.title}</h2>
        </div>
      </div>
      <p className="text-base sm:text-lg leading-relaxed">{intro.text}</p>
      <ul className="grid sm:grid-cols-2 gap-2">
        {intro.examples.map((ex) => (
          <li
            key={ex}
            className="rounded-2xl bg-[var(--th-soft-tint)] border border-[var(--th-soft-tint-border)] px-4 py-3 font-display text-lg sm:text-xl font-bold tabular-nums"
          >
            {ex}
          </li>
        ))}
      </ul>
      <p className="text-sm text-[var(--th-text-muted)]">Teraz kilka zadań bez pośpiechu. Podpowiedź jest pod przyciskiem 💡.</p>
      <button
        type="button"
        onClick={onStart}
        className="w-full min-h-[56px] rounded-2xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-display text-lg font-bold border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] inline-flex items-center justify-center gap-2 cursor-pointer"
        data-testid="lesson-intro-start"
      >
        <Play className="w-5 h-5 fill-current" aria-hidden="true" /> Zaczynamy
      </button>
    </div>
  );
}
