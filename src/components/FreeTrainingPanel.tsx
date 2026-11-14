/**
 * Wolny trening — gracz sam decyduje: ile (zadań albo minut), co (mnożenie, dzielenie, mix),
 * w jakim zakresie, które tabliczki, w jakiej formie i czy tylko „moje trudne”.
 * Bez progów i bez zaliczeń, ale statystyki i powtórki zbierają się jak zawsze.
 */
import { Dice5, Play } from 'lucide-react';
import { useState } from 'react';
import { getDifficultFacts } from '../engine/spacedRepetition';
import type { ActiveSeriesConfig, OperationMode, UserProfile } from '../types/math';

type Form = 'normal' | 'gap' | 'story';
type Length = { kind: 'count'; n: number } | { kind: 'min'; n: number };

const MODES: { id: OperationMode; label: string }[] = [
  { id: 'mixed', label: '× ÷ Mix' },
  { id: 'mul', label: '× Mnożenie' },
  { id: 'div', label: '÷ Dzielenie' },
];
const LENGTHS: Length[] = [
  { kind: 'count', n: 10 },
  { kind: 'count', n: 20 },
  { kind: 'min', n: 2 },
  { kind: 'min', n: 5 },
  { kind: 'min', n: 10 },
];
const RANGES = [50, 100, 144, 200, 500, 1000];
const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const FORMS: { id: Form; label: string }[] = [
  { id: 'normal', label: '7 × 8 = ?' },
  { id: 'gap', label: '? × 8 = 56' },
  { id: 'story', label: '📖 Historyjki' },
];

const chip = (on: boolean) =>
  `min-h-[40px] px-3 rounded-xl text-sm font-bold tabular-nums cursor-pointer border transition-colors ${
    on ? 'bg-[var(--th-surface)] border-[var(--th-primary)] text-[var(--th-text)] shadow-sm' : 'bg-[var(--th-surface-muted)] border-[var(--th-border)] text-[var(--th-text-muted)] hover:text-[var(--th-text)]'
  }`;

export function FreeTrainingPanel({ profile, onStart }: { profile: UserProfile; onStart: (c: ActiveSeriesConfig) => void }) {
  const [mode, setMode] = useState<OperationMode>('mixed');
  const [len, setLen] = useState<Length>({ kind: 'count', n: Math.max(10, profile.settings.defaultSeriesLength) >= 15 ? 20 : 10 });
  const [range, setRange] = useState<number>(profile.settings.maxRange);
  const [tables, setTables] = useState<number[]>([]);
  const [form, setForm] = useState<Form>('normal');
  const [onlyHard, setOnlyHard] = useState(false);
  const hard = getDifficultFacts(profile.memories, 16).filter((m) => m.mastery === 'trudne' || m.wrongCount > 0 || m.avgTimeMs > 6000);
  const tablesOn = range <= 144;

  const toggleTable = (t: number) => setTables((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].sort((a, b) => a - b)));

  const start = () => {
    const what = onlyHard ? 'moje trudne' : tables.length && tablesOn ? `× ${tables.join(', ')}` : MODES.find((m) => m.id === mode)!.label.replace(/^[×÷ ]+/, '');
    const cfg: ActiveSeriesConfig = {
      title: `Wolny trening: ${what}${len.kind === 'min' ? ` · ${len.n} min` : ''}`,
      mode,
      maxRange: range,
      taskCount: len.kind === 'count' ? len.n : 200,
      timeLimitSec: len.kind === 'min' ? len.n * 60 : undefined,
      tables: tablesOn && tables.length ? tables : undefined,
      focusFactIds: onlyHard && hard.length ? hard.map((m) => m.id) : undefined,
      gap: form === 'gap',
      story: form === 'story',
      free: true,
    };
    onStart(cfg);
  };

  return (
    <div className="mt-4 space-y-3" data-testid="free-training">
      <div className="flex items-center gap-2">
        <Dice5 className="w-5 h-5 text-[var(--th-primary)]" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold">Wolny trening — Ty decydujesz</p>
          <p className="text-xs text-[var(--th-text-muted)]">Bez progów i zaliczeń. Wyniki i powtórki zapisują się jak zawsze.</p>
        </div>
      </div>

      <Row label="Co">
        {MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)} className={chip(mode === m.id)}>
            {m.label}
          </button>
        ))}
      </Row>
      <Row label="Ile">
        {LENGTHS.map((l) => {
          const on = len.kind === l.kind && len.n === l.n;
          return (
            <button key={`${l.kind}${l.n}`} type="button" aria-pressed={on} onClick={() => setLen(l)} className={chip(on)}>
              {l.kind === 'count' ? `${l.n} zadań` : `${l.n} min`}
            </button>
          );
        })}
      </Row>
      <Row label="Zakres">
        {RANGES.map((r) => (
          <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className={chip(range === r)}>
            do {r}
          </button>
        ))}
      </Row>
      {tablesOn && !onlyHard && (
        <Row label="Tabliczki">
          <button type="button" aria-pressed={tables.length === 0} onClick={() => setTables([])} className={chip(tables.length === 0)}>
            wszystkie
          </button>
          {TABLES.filter((t) => t <= (range <= 100 ? 10 : 12)).map((t) => (
            <button key={t} type="button" aria-pressed={tables.includes(t)} onClick={() => toggleTable(t)} className={`${chip(tables.includes(t))} min-w-[44px]`}>
              ×{t}
            </button>
          ))}
        </Row>
      )}
      <Row label="Forma">
        {FORMS.map((f) => (
          <button key={f.id} type="button" aria-pressed={form === f.id} onClick={() => setForm(f.id)} className={chip(form === f.id)}>
            {f.label}
          </button>
        ))}
      </Row>
      <label className={`flex items-center justify-between gap-3 rounded-xl border border-[var(--th-border)] px-3 py-2 ${hard.length ? 'cursor-pointer' : 'opacity-60'}`}>
        <span className="text-sm">
          <span className="font-bold">🔥 Tylko moje trudne</span>
          <span className="block text-xs text-[var(--th-text-muted)]">
            {hard.length ? `${hard.length} działań, które sprawiają kłopot` : 'Zagraj kilka serii, a aplikacja wskaże trudne działania'}
          </span>
        </span>
        <input type="checkbox" className="w-6 h-6 accent-[var(--th-primary)]" disabled={!hard.length} checked={onlyHard} onChange={(e) => setOnlyHard(e.target.checked)} data-testid="only-hard" />
      </label>

      <button
        data-tour="quickstart"
        type="button"
        onClick={start}
        className="w-full min-h-[52px] px-4 rounded-2xl bg-[var(--th-primary)] hover:bg-[var(--th-primary-hover)] text-[var(--th-primary-fg)] font-display text-base sm:text-lg font-bold border-b-4 border-[var(--th-primary-dark)] active:border-b-2 active:translate-y-[2px] transition-all flex items-center justify-center gap-2 cursor-pointer"
        data-testid="free-start"
      >
        <Play className="w-5 h-5 fill-current" aria-hidden="true" />
        <span>Graj wolny trening ({len.kind === 'count' ? `${len.n} zadań` : `${len.n} min`})</span>
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
      <span className="text-xs font-bold text-[var(--th-text-muted)] sm:w-16 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
