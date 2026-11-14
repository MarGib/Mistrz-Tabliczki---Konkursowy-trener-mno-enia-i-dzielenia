import { ArrowRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * „Jak teraz gramy” — kilka kart z nowymi zasadami, raz dla każdego gracza po wprowadzeniu ścieżki z kropkami.
 * Proste słowa, bez molocha. Można otworzyć ponownie z Konta i z Instrukcji.
 */
const RULES_KEY = (profileId: string) => `mt_rules_v2_${profileId}`;

/** Wydanie ścieżki z kropkami (14.11.2026, 22:30). Okno pokazujemy tylko tym, którzy grali wcześniej. */
const PATH_RELEASE_MS = Date.UTC(2026, 10, 14, 21, 30);
export function playedBeforePath(sessions: { timestamp: number }[] | undefined): boolean {
  return (sessions ?? []).some((s) => s.timestamp < PATH_RELEASE_MS);
}

export function rulesSeen(profileId: string): boolean {
  try {
    return window.localStorage.getItem(RULES_KEY(profileId)) === '1';
  } catch {
    return true;
  }
}

function markSeen(profileId: string) {
  try {
    window.localStorage.setItem(RULES_KEY(profileId), '1');
  } catch {
    // ignore
  }
}

const CARDS: { emoji: string; title: string; text: string; points?: string[] }[] = [
  {
    emoji: '🗺️',
    title: 'Nowa ścieżka z kropkami',
    text: 'Każdy moduł to kilka krótkich kropek, po 2–3 minuty. Idziemy od najłatwiejszych tabliczek do najtrudniejszych.',
    points: ['👀 Poznaj — sposób liczenia', '🎯 ❓ ✅ 🧩 ⏱️ — ćwiczenia i gry', '🏆 Test modułu — na koniec'],
  },
  {
    emoji: '▶️',
    title: 'Nie musisz nic wybierać',
    text: 'Duży zielony przycisk „Graj dalej” zawsze prowadzi do następnej kropki albo do powtórki tego, co ucieka z pamięci.',
  },
  {
    emoji: '⭐',
    title: 'Gwiazdki, test i „Znam to”',
    text: 'Za kropkę dostajesz 1–3 gwiazdki — możesz je poprawiać. Po kropkach otwiera się test modułu. Umiesz już? „Znam to — sprawdź mnie” i od razu test.',
    points: ['Zaliczone wcześniej etapy zostały zaliczone — nic nie znika', 'Nowy moduł 🌉 Most do Ligi przygotowuje do Ligi Mistrzów'],
  },
  {
    emoji: '🎲',
    title: 'Albo graj po swojemu',
    text: 'Wolny trening: sam wybierasz, co, ile minut lub zadań, które tabliczki — albo „Tylko moje trudne”.',
  },
  {
    emoji: '💚',
    title: 'Bez żyć, bez kar, bez stresu',
    text: 'Pomyłka to tylko wskazówka, co poćwiczyć. 3 kropki dziennie to świetny wynik — mózg najlepiej utrwala wiedzę we śnie.',
  },
];

export function HowWePlayDialog({
  profileId,
  enabled,
  forceOpen,
  onClose,
}: {
  profileId: string;
  enabled: boolean;
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setI(0);
      setOpen(true);
      return;
    }
    if (!enabled || rulesSeen(profileId)) return;
    const t = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(t);
  }, [enabled, forceOpen, profileId]);

  if (!open) return null;
  const close = () => {
    markSeen(profileId);
    setOpen(false);
    onClose?.();
  };
  const c = CARDS[i];
  const last = i === CARDS.length - 1;

  return (
    <div className="fixed inset-0 z-[82] bg-black/45 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="how-title" data-testid="how-we-play">
      <div className="w-full max-w-md rounded-3xl bg-[var(--th-surface)] text-[var(--th-text)] border border-[var(--th-border)] shadow-2xl p-6 space-y-4 animate-pop-in">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--th-text-muted)]">Jak teraz gramy · {i + 1}/{CARDS.length}</p>
          <button type="button" onClick={close} aria-label="Zamknij" className="w-10 h-10 -m-2 rounded-full hover:bg-[var(--th-surface-muted)] flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-5xl" aria-hidden="true">{c.emoji}</div>
        <h2 id="how-title" className="font-display text-2xl font-extrabold leading-tight">{c.title}</h2>
        <p className="text-base leading-relaxed">{c.text}</p>
        {c.points && (
          <ul className="space-y-1.5">
            {c.points.map((p) => (
              <li key={p} className="rounded-xl bg-[var(--th-soft-tint)] border border-[var(--th-soft-tint-border)] px-3 py-2 text-sm font-semibold">
                {p}
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-1.5 justify-center" aria-hidden="true">
          {CARDS.map((_, k) => (
            <span key={k} className={`h-2 rounded-full transition-all ${k === i ? 'w-6 bg-[var(--th-primary)]' : 'w-2 bg-[var(--th-border)]'}`} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (last ? close() : setI(i + 1))}
          className="w-full min-h-[52px] rounded-2xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-display text-lg font-bold border-b-4 border-[var(--th-primary-dark)] inline-flex items-center justify-center gap-2 cursor-pointer"
          data-testid="how-next"
        >
          {last ? 'Gramy!' : 'Dalej'} {!last && <ArrowRight className="w-5 h-5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
