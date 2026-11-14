/**
 * „Wyzwania w grupie” — porównanie w wielu kategoriach, żeby było kogo gonić.
 * Dla każdej kategorii: podium, Twoje miejsce i ile brakuje do osoby tuż przed Tobą.
 */
import { CalendarCheck, Crosshair, Flame, Medal, Rocket, Sparkles, Target, Timer, TrendingUp, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { UserProfile } from '../types/math';
import { AvatarDisplay } from './AvatarDisplay';

interface GroupRivalryProps {
  profiles: UserProfile[];
  meId: string;
  groupName?: string;
}

interface PlayerStats {
  id: string;
  name: string;
  avatarId: string;
  customAvatarSpec?: UserProfile['customAvatarSpec'];
  xp: number;
  streak: number;
  solved: number;
  accuracy: number | null;
  tempo: number | null;
  weekSeries: number;
  progress: number | null;
  medals: number;
  xpPerSeries: number;
}

type Category = {
  id: string;
  title: string;
  icon: typeof Trophy;
  color: string;
  /** wyższa wartość = lepiej? */
  higherIsBetter: boolean;
  value: (p: PlayerStats) => number | null;
  format: (v: number) => string;
  gapText: (gap: number, me: PlayerStats) => string;
};

const WEEK_MS = 7 * 24 * 3600 * 1000;
const MEDAL_POINTS: Record<string, number> = { puchar: 4, zloto: 3, srebro: 2, braz: 1 };

function pl(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? few : many;
}

function fmtSec(v: number): string {
  return `${v.toFixed(1).replace('.', ',')} s`;
}

function computeStats(p: UserProfile, now: number): PlayerStats {
  const sessions = Array.isArray(p.sessions) ? p.sessions : [];
  const trend = p.trendSessions ?? sessions;
  const solved = sessions.reduce((s, r) => s + (r.totalTasks || 0), 0);
  const correct = sessions.reduce((s, r) => s + (r.correctTasks || 0), 0);
  const timeMs = sessions.reduce((s, r) => s + (r.totalTimeMs || 0), 0);
  const recent = trend.slice(-12);
  let progress: number | null = null;
  if (recent.length >= 4) {
    const k = Math.min(3, Math.floor(recent.length / 2));
    const avg = (arr: typeof recent) => arr.reduce((s, r) => s + r.avgTimeMs, 0) / arr.length / 1000;
    progress = Number((avg(recent.slice(0, k)) - avg(recent.slice(-k))).toFixed(2));
  }
  const realSeries = trend.length || p.sessions.length;
  return {
    id: p.id,
    name: p.name,
    avatarId: p.avatarId,
    customAvatarSpec: p.customAvatarSpec,
    xp: p.xp || 0,
    streak: p.streakDays || 0,
    solved,
    accuracy: solved > 0 ? Math.round((correct / solved) * 100) : null,
    tempo: solved > 0 && timeMs > 0 ? Number((timeMs / solved / 1000).toFixed(2)) : null,
    weekSeries: trend.filter((r) => now - r.timestamp < WEEK_MS).length,
    progress,
    medals: Object.values(p.tournamentBests ?? {}).reduce((s, b) => s + (MEDAL_POINTS[b.medal] ?? 0), 0),
    xpPerSeries: realSeries > 0 ? Math.max(50, Math.round((p.xp || 0) / realSeries)) : 150,
  };
}

const CATEGORIES: Category[] = [
  {
    id: 'xp',
    title: 'Punkty XP',
    icon: Trophy,
    color: '#F59E0B',
    higherIsBetter: true,
    value: (p) => p.xp,
    format: (v) => `${Math.round(v)} XP`,
    gapText: (gap, me) => {
      const series = Math.max(1, Math.ceil(gap / me.xpPerSeries));
      return `brakuje ${Math.ceil(gap)} XP — to ok. ${series} ${pl(series, 'seria', 'serie', 'serii')}`;
    },
  },
  {
    id: 'week',
    title: 'Serie w tym tygodniu',
    icon: CalendarCheck,
    color: '#10B981',
    higherIsBetter: true,
    value: (p) => p.weekSeries,
    format: (v) => `${v} ${pl(v, 'seria', 'serie', 'serii')}`,
    gapText: (gap) => `zrób ${gap + 1} ${pl(gap + 1, 'serię', 'serie', 'serii')}, by wyprzedzić`,
  },
  {
    id: 'streak',
    title: 'Dni z rzędu',
    icon: Flame,
    color: '#EF4444',
    higherIsBetter: true,
    value: (p) => p.streak,
    format: (v) => `${v} ${pl(v, 'dzień', 'dni', 'dni')}`,
    gapText: (gap) => `ćwicz codziennie jeszcze ${gap + 1} ${pl(gap + 1, 'dzień', 'dni', 'dni')}`,
  },
  {
    id: 'accuracy',
    title: 'Celność',
    icon: Crosshair,
    color: '#3B82F6',
    higherIsBetter: true,
    value: (p) => p.accuracy,
    format: (v) => `${v}%`,
    gapText: (gap) => `brakuje ${Math.ceil(gap)} pkt proc. — licz spokojnie, bez pomyłek`,
  },
  {
    id: 'tempo',
    title: 'Tempo (s na zadanie)',
    icon: Timer,
    color: '#8B5CF6',
    higherIsBetter: false,
    value: (p) => p.tempo,
    format: fmtSec,
    gapText: (gap) => `bądź szybszy o ${fmtSec(gap)} na zadanie`,
  },
  {
    id: 'solved',
    title: 'Rozwiązane zadania',
    icon: Target,
    color: '#0EA5E9',
    higherIsBetter: true,
    value: (p) => p.solved,
    format: (v) => `${v}`,
    gapText: (gap) => `jeszcze ${gap} ${pl(gap, 'zadanie', 'zadania', 'zadań')}`,
  },
  {
    id: 'progress',
    title: 'Postęp w tempie',
    icon: TrendingUp,
    color: '#14B8A6',
    higherIsBetter: true,
    value: (p) => p.progress,
    format: (v) => (v >= 0 ? `−${fmtSec(v)}` : `+${fmtSec(-v)}`),
    gapText: () => 'ćwicz trudne działania — każda seria może poprawić tempo',
  },
  {
    id: 'medals',
    title: 'Medale z turniejów',
    icon: Medal,
    color: '#EAB308',
    higherIsBetter: true,
    value: (p) => p.medals,
    format: (v) => `${v} ${pl(v, 'punkt', 'punkty', 'punktów')}`,
    gapText: (gap) => `zdobądź medale w turniejach (brakuje ${gap} ${pl(gap, 'punktu', 'punktów', 'punktów')})`,
  },
];

interface Ranked {
  cat: Category;
  rows: { p: PlayerStats; v: number }[];
  myIndex: number;
  target: { p: PlayerStats; v: number } | null;
  gap: number;
}

export function GroupRivalry({ profiles, meId, groupName }: GroupRivalryProps) {
  const [showAll, setShowAll] = useState(false);
  const ranked = useMemo<Ranked[]>(() => {
    const now = Date.now();
    const stats = profiles.map((p) => computeStats(p, now));
    return CATEGORIES.map((cat) => {
      const rows = stats
        .map((p) => ({ p, v: cat.value(p) }))
        .filter((r): r is { p: PlayerStats; v: number } => r.v !== null && Number.isFinite(r.v))
        .sort((a, b) => (cat.higherIsBetter ? b.v - a.v : a.v - b.v));
      const myIndex = rows.findIndex((r) => r.p.id === meId);
      let target: Ranked['target'] = null;
      let gap = 0;
      if (myIndex > 0) {
        const me = rows[myIndex];
        // pierwsza osoba przed nami z lepszym wynikiem
        for (let i = myIndex - 1; i >= 0; i--) {
          if (rows[i].v !== me.v) {
            target = rows[i];
            break;
          }
        }
        if (target) gap = Math.abs(target.v - me.v);
      }
      return { cat, rows, myIndex, target, gap };
    }).filter((r) => r.rows.length >= 2 && r.rows.some((x) => x.v !== 0));
  }, [profiles, meId]);

  if (profiles.length < 2 || ranked.length === 0) return null;

  const me = ranked.find((r) => r.myIndex >= 0)?.rows.find((x) => x.p.id === meId)?.p ?? null;
  const leads = ranked.filter((r) => r.myIndex === 0).map((r) => r.cat.title);
  // Najbliższy cel: najmniejsza względna strata.
  const goal = ranked
    .filter((r) => r.target)
    .map((r) => ({ r, rel: r.gap / Math.max(1e-6, Math.abs(r.target!.v) || 1) }))
    .sort((a, b) => a.rel - b.rel)[0]?.r;

  // Najpierw kategorie, w których najłatwiej kogoś dogonić; potem te, w których prowadzisz.
  const relGap = (r: Ranked) =>
    r.target ? r.gap / Math.max(1e-6, Math.abs(r.target.v) || 1) : r.myIndex === 0 ? 10 : 20;
  const ordered = [...ranked].sort((a, b) => relGap(a) - relGap(b));
  const SHOWN = 4;
  const visible = showAll ? ordered : ordered.slice(0, SHOWN);

  return (
    <section
      className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-4 sm:p-6 space-y-4"
      data-testid="group-rivalry"
    >
      <div className="flex items-center gap-2.5">
        <Rocket className="w-5 h-5 text-[var(--th-primary)] shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--th-text)]">
            Wyzwania{groupName ? ` w grupie „${groupName}”` : ' w grupie'}
          </h2>
          <p className="text-xs text-[var(--th-text-muted)]">
            {ranked.length} kategorii — sprawdź, kogo możesz dogonić.
          </p>
        </div>
      </div>

      {me && (
        <div
          className="rounded-2xl p-4 text-white shadow-md"
          style={{
            background:
              'linear-gradient(135deg, var(--th-primary), color-mix(in oklab, var(--th-primary) 55%, #8B5CF6))',
          }}
        >
          {goal && goal.target ? (
            <div className="flex items-center gap-3">
              <AvatarDisplay
                avatarId={goal.target.p.avatarId}
                customSpec={goal.target.p.customAvatarSpec}
                name={goal.target.p.name}
                sizeClass="w-12 h-12 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide opacity-85">Twój najbliższy cel</p>
                <p className="font-display text-base sm:text-lg font-extrabold leading-snug">
                  Wyprzedź {goal.target.p.name} — {goal.cat.title.toLowerCase()}
                </p>
                <p className="text-sm opacity-95">{goal.cat.gapText(goal.gap, me)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 shrink-0" aria-hidden="true" />
              <p className="font-display text-base font-extrabold">
                Prowadzisz we wszystkich kategoriach! Utrzymaj formę — inni już Cię gonią.
              </p>
            </div>
          )}
          {leads.length > 0 && goal && (
            <p className="mt-2 text-xs font-semibold opacity-90">
              🏆 Prowadzisz w: {leads.join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {visible.map(({ cat, rows, myIndex, target, gap }) => {
          const Icon = cat.icon;
          const best = rows[0].v;
          const worst = rows[rows.length - 1].v;
          const top = rows.slice(0, 3);
          const meRow = myIndex >= 0 ? rows[myIndex] : null;
          const showMeExtra = meRow && myIndex >= 3;
          const barPct = (v: number) => {
            if (cat.higherIsBetter) return best > 0 ? Math.max(6, Math.round((v / best) * 100)) : 6;
            // mniejsze = lepsze (tempo): najlepszy 100%
            return v > 0 ? Math.max(6, Math.round((best / v) * 100)) : 100;
          };
          void worst;
          const line = (r: { p: PlayerStats; v: number }, idx: number) => {
            const mine = r.p.id === meId;
            return (
              <div key={r.p.id} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`truncate ${mine ? 'font-extrabold text-[var(--th-text)]' : 'font-semibold text-[var(--th-text)]'}`}>
                    {['🥇', '🥈', '🥉'][idx] ?? `${idx + 1}.`} {r.p.name}
                    {mine && ' (Ty)'}
                  </span>
                  <span className="tabular-nums font-bold text-[var(--th-text)] shrink-0">{cat.format(r.v)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--th-surface-muted)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barPct(r.v)}%`,
                      background: mine ? cat.color : `color-mix(in oklab, ${cat.color} 45%, var(--th-border))`,
                    }}
                  />
                </div>
              </div>
            );
          };
          return (
            <div
              key={cat.id}
              className="rounded-2xl border p-3 space-y-2"
              style={{
                borderColor: `color-mix(in oklab, ${cat.color} 30%, var(--th-border))`,
                background: `color-mix(in oklab, ${cat.color} 6%, var(--th-surface))`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--th-text)]">
                  <span
                    className="w-7 h-7 rounded-lg inline-flex items-center justify-center"
                    style={{ background: `color-mix(in oklab, ${cat.color} 18%, var(--th-surface))`, color: cat.color }}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                  {cat.title}
                </span>
                {meRow && (
                  <span
                    className="text-[11px] font-extrabold px-2 py-0.5 rounded-full tabular-nums"
                    style={{ background: `color-mix(in oklab, ${cat.color} 18%, var(--th-surface))`, color: `color-mix(in oklab, ${cat.color} 70%, var(--th-text))` }}
                  >
                    {myIndex + 1}. / {rows.length}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {top.map((r, i) => line(r, i))}
                {showMeExtra && meRow && (
                  <>
                    <div className="text-center text-[10px] text-[var(--th-text-muted)] leading-none">⋯</div>
                    {line(meRow, myIndex)}
                  </>
                )}
              </div>
              <p className="text-[11px] leading-snug text-[var(--th-text-muted)]">
                {!meRow
                  ? 'Zagraj serię, aby pojawić się w tej kategorii.'
                  : myIndex === 0
                  ? '👑 Prowadzisz! Nie zwalniaj.'
                  : target
                  ? `Do ${target.p.name}: ${cat.gapText(gap, meRow.p)}.`
                  : 'Remis z osobą przed Tobą — jeszcze trochę!'}
              </p>
            </div>
          );
        })}
      </div>
      {ordered.length > SHOWN && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full min-h-[44px] rounded-2xl border border-[var(--th-border)] text-sm font-bold text-[var(--th-primary)] hover:border-[var(--th-primary)] cursor-pointer"
        >
          {showAll ? 'Pokaż mniej' : `Pokaż wszystkie kategorie (${ordered.length})`}
        </button>
      )}
    </section>
  );
}
