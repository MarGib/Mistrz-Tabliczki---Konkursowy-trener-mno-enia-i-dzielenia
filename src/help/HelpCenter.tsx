import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Compass, Lightbulb, Search, X } from 'lucide-react';
import { helpSuggestions, searchHelp } from './helpSearch';
import { HelpRequestForm } from '../components/HelpRequestForm';
import { HELP_CHAPTERS, HELP_SECTIONS, type HelpSectionId } from './helpContent';

/** Uruchamia przewodnik po aplikacji (nasłuchuje go GuidedTour). */
export function startGuidedTour() {
  window.dispatchEvent(new CustomEvent('mt:start-tour'));
}

interface HelpCenterProps {
  initialSection: HelpSectionId;
  onClose: () => void;
}

export function HelpCenter({ initialSection, onClose }: HelpCenterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const hits = useMemo(() => (query.trim() ? searchHelp(query) : null), [query]);
  const suggestions = useMemo(() => helpSuggestions(query), [query]);
  const visibleIds = useMemo(() => (hits ? new Set(hits.map((h) => h.section.id)) : null), [hits]);
  const openSection = (id: HelpSectionId, label?: string) => {
    setFocused(false);
    setActive(-1);
    if (label) setQuery(label);
    window.setTimeout(() => jump(id), 50);
  };

  useEffect(() => {
    // „Jak zacząć” otwieramy od spisu treści; pozostałe rozdziały — od razu na właściwym miejscu.
    if (initialSection === 'start') return;
    const el = document.getElementById(`help-${initialSection}`);
    if (el && scrollRef.current) {
      scrollRef.current.scrollTop = el.offsetTop - 64;
    }
  }, [initialSection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const jump = (id: HelpSectionId) => {
    const el = document.getElementById(`help-${id}`);
    if (el && scrollRef.current) scrollRef.current.scrollTo({ top: el.offsetTop - 64, behavior: 'smooth' });
  };

  const renderSection = (s: (typeof HELP_SECTIONS)[number]) => (
                <section
                  key={s.id}
                  id={`help-${s.id}`}
                  className={`rounded-3xl border p-4 space-y-3 bg-[var(--th-surface)] ${
                    s.id === initialSection ? 'border-[var(--th-primary)] border-2' : 'border-[var(--th-border)]'
                  }`}
                >
                  <h3 className="font-display text-lg font-extrabold">{s.title}</h3>
                  <p className="text-sm">{s.lead}</p>
                  <ol className="space-y-1.5">
                    {s.steps.map((step, i) => (
                      <li key={i} className="flex gap-2.5 text-sm">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--th-primary)] text-[var(--th-primary-fg)] text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                  {s.image && (
                    <img
                      src={`${import.meta.env.BASE_URL}${s.image}`}
                      alt={s.imageAlt ?? ''}
                      loading="lazy"
                      className="w-full rounded-2xl border border-[var(--th-border)] bg-white"
                    />
                  )}
                  {s.tip && (
                    <p className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-950 px-3 py-2 flex gap-2">
                      <Lightbulb className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{s.tip}</span>
                    </p>
                  )}
                  {s.id === 'forgot' && (
                    <div className="rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface-muted)] p-3">
                      <HelpRequestForm />
                    </div>
                  )}
                  {s.id === 'tour' && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        window.setTimeout(startGuidedTour, 350);
                      }}
                      className="w-full min-h-[46px] rounded-2xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Compass className="w-5 h-5" aria-hidden="true" /> Uruchom przewodnik
                    </button>
                  )}
                </section>
  );

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label="Pomoc">
      <button
        type="button"
        aria-label="Zamknij pomoc"
        onClick={onClose}
        className="hidden md:block flex-1 bg-black/40 cursor-default"
      />
      <div
        ref={scrollRef}
        className="relative w-full md:max-w-xl h-full overflow-y-auto bg-[var(--th-canvas)] text-[var(--th-text)] shadow-2xl"
        data-testid="help-center"
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2.5 bg-[var(--th-surface)] border-b border-[var(--th-border)]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-3 rounded-xl border border-[var(--th-border)] font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Wróć
          </button>
          <h2 className="font-display text-lg font-extrabold">Jak to działa?</h2>
        </div>

        <div className="sticky top-[60px] z-10 px-4 pt-3 pb-2 bg-[var(--th-canvas)]" data-testid="help-search">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--th-text-muted)]" aria-hidden="true" />
            <input
              type="text"
              inputMode="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(-1);
                setFocused(true);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(suggestions.length - 1, a + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(-1, a - 1));
                } else if (e.key === 'Enter') {
                  const pick = active >= 0 ? suggestions[active] : null;
                  if (pick) openSection(pick.id, pick.kind === 'question' ? pick.label : undefined);
                  else if (hits?.[0]) openSection(hits[0].section.id);
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  setQuery('');
                }
              }}
              placeholder="Szukaj, np. hasło, grupa, internet…"
              aria-label="Szukaj w pomocy"
              autoComplete="off"
              enterKeyHint="search"
              className="w-full min-h-[48px] rounded-2xl border-2 border-[var(--th-border)] focus:border-[var(--th-primary)] outline-none bg-[var(--th-surface)] pl-10 pr-10 text-base"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Wyczyść wyszukiwanie"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            {focused && suggestions.length > 0 && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 mt-1.5 rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface)] shadow-xl overflow-hidden"
                data-testid="help-suggestions"
              >
                {!query.trim() && <li className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase text-[var(--th-text-muted)]">Często szukane</li>}
                {suggestions.map((sg, i) => (
                  <li key={`${sg.kind}-${sg.label}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => openSection(sg.id, sg.kind === 'question' ? sg.label : undefined)}
                      className={`w-full text-left px-3 py-2.5 text-sm inline-flex items-center gap-2 cursor-pointer ${i === active ? 'bg-[var(--th-soft-tint)]' : ''}`}
                    >
                      <span aria-hidden="true">{sg.kind === 'question' ? '❓' : '📄'}</span>
                      <span className="font-semibold">{sg.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {hits && (
            <p className="mt-1.5 text-xs text-[var(--th-text-muted)]" aria-live="polite">
              {hits.length > 0 ? `Znaleziono: ${hits.length} ${hits.length === 1 ? 'dział' : hits.length < 5 ? 'działy' : 'działów'}` : 'Nic nie znaleziono — spróbuj innego słowa albo napisz do opiekuna (dział „Nie pamiętam hasła”).'}
            </p>
          )}
        </div>

        {!hits && (
        <nav className="px-4 pt-4 space-y-3" aria-label="Spis treści pomocy">
          {HELP_CHAPTERS.map((ch) => (
            <div key={ch.id}>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--th-text-muted)] mb-1">
                {ch.emoji} {ch.title}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {HELP_SECTIONS.filter((s) => s.chapter === ch.id).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => jump(s.id)}
                    className={`min-h-[36px] px-3 rounded-full border text-xs font-bold cursor-pointer text-left ${
                      s.id === initialSection
                        ? 'bg-[var(--th-primary)] border-[var(--th-primary)] text-[var(--th-primary-fg)]'
                        : 'bg-[var(--th-surface)] border-[var(--th-border)]'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        )}

        <div className="px-4 py-4 space-y-5">
          {hits && hits.map((h) => renderSection(h.section))}
          {!hits && HELP_CHAPTERS.filter((ch) => !visibleIds || HELP_SECTIONS.some((s) => s.chapter === ch.id && visibleIds.has(s.id))).map((ch) => (
            <div key={ch.id} className="space-y-4">
              <h2 className="font-display text-xl font-extrabold pt-2 border-b border-[var(--th-border)] pb-1">
                {ch.emoji} {ch.title}
              </h2>
              {HELP_SECTIONS.filter((s) => s.chapter === ch.id && (!visibleIds || visibleIds.has(s.id))).map((s) => (
                renderSection(s)
              ))}
            </div>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-2xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-bold cursor-pointer"
          >
            Wróć do aplikacji
          </button>
        </div>
      </div>
    </div>
  );
}
