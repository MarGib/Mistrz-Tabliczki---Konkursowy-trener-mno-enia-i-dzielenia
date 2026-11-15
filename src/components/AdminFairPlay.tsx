import { useMemo, useState } from 'react';
import type { AdminAccountRow, DeviceRow, LoginEventRow, ReviewRow } from '../engine/adminCloud';
import { REASON_LABELS, serverSeriesSuspicious } from '../engine/integrity';

const card = 'rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface)] p-4';
const btn = 'min-h-[40px] px-3 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50';
const btnGhost = `${btn} border border-[var(--th-border)] bg-[var(--th-surface)]`;

const STATE_PL: Record<ReviewRow['state'], { label: string; cls: string }> = {
  pending: { label: '⏳ do sprawdzenia', cls: 'text-amber-600' },
  watch: { label: '👀 obserwacja', cls: 'text-sky-600' },
  suspended: { label: '⛔ zablokowane', cls: 'text-rose-600' },
  cleared: { label: '✓ sprawdzone', cls: 'text-emerald-600' },
};

function fmt(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Wnioski „z serwera” — działają także wtedy, gdy ktoś podmienił aplikację i czujnik nic nie zgłosił. */
export function fairPlayFindings(accounts: AdminAccountRow[], devices: DeviceRow[], events: LoginEventRow[]) {
  const fastSeries = accounts
    .map((a) => ({ a, bad: a.recent.filter(serverSeriesSuspicious) }))
    .filter((x) => x.bad.length > 0);
  const crowdedDevices = devices.filter((d) => d.logins.length >= 5);
  const fails = new Map<string, number>();
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  for (const e of events) {
    if (!e.ok && e.atMs > dayAgo && e.reason === 'invalid-credential') fails.set(e.login, (fails.get(e.login) ?? 0) + 1);
  }
  const guessed = [...fails.entries()].filter(([, n]) => n >= 8).sort((a, b) => b[1] - a[1]);
  return { fastSeries, crowdedDevices, guessed };
}

export function AdminFairPlay({
  reviews,
  accounts,
  devices,
  events,
  onDecide,
}: {
  reviews: ReviewRow[];
  accounts: AdminAccountRow[];
  devices: DeviceRow[];
  events: LoginEventRow[];
  /** Brak = decyzje podejmuje tylko właściciel (administrator widzi zgłoszenia bez przycisków). */
  onDecide?: (uid: string, decision: 'cleared' | 'trusted' | 'suspended') => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const findings = useMemo(() => fairPlayFindings(accounts, devices, events), [accounts, devices, events]);
  const nameOf = (uid: string, login: string) => accounts.find((a) => a.uid === uid)?.name ?? login;
  const order = { pending: 0, suspended: 1, watch: 2, cleared: 3 };
  const list = reviews
    .filter((r) => showDone || r.state !== 'cleared')
    .sort((a, b) => order[a.state] - order[b.state] || b.updatedAtMs - a.updatedAtMs);

  const decide = async (uid: string, d: 'cleared' | 'trusted' | 'suspended') => {
    if (d === 'suspended' && !window.confirm('Zablokować konto? Gracz zobaczy ekran „Konto jest wstrzymane”. Można to cofnąć.')) return;
    if (!onDecide) return;
    setBusy(uid);
    try {
      await onDecide(uid, d);
    } finally {
      setBusy(null);
    }
  };

  const actions = (uid: string, state: ReviewRow['state']) => !onDecide ? (
    <p className="text-xs text-[var(--th-text-muted)]">Decyzję (w porządku / zaufaj / zablokuj) podejmuje właściciel aplikacji.</p>
  ) : (
    <div className="flex flex-wrap gap-2">
      {state !== 'cleared' && (
        <button type="button" disabled={busy === uid} onClick={() => void decide(uid, 'cleared')} className={btnGhost}>
          ✓ W porządku
        </button>
      )}
      <button type="button" disabled={busy === uid} onClick={() => void decide(uid, 'trusted')} className={btnGhost} title="Czujnik nie będzie już wstrzymywał tego konta (np. bardzo szybkie dziecko).">
        ★ Zaufaj
      </button>
      {state !== 'suspended' ? (
        <button type="button" disabled={busy === uid} onClick={() => void decide(uid, 'suspended')} className={`${btnGhost} text-rose-600`}>
          ⛔ Zablokuj
        </button>
      ) : (
        <button type="button" disabled={busy === uid} onClick={() => void decide(uid, 'cleared')} className={btnGhost}>
          Odblokuj
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={`${card} text-sm space-y-1`}>
        <p className="font-bold">Jak to działa</p>
        <p className="text-[var(--th-text-muted)]">
          Aplikacja sama zgłasza serie, które wyglądają nienaturalnie (automat, odpowiedzi szybsze niż człowiek, równe jak u maszyny,
          przełączanie okna przy zadaniach). Mocny sygnał = <b>do sprawdzenia</b>: wyniki znikają z rankingów, a gracz dalej może ćwiczyć.
          Słaby sygnał = <b>obserwacja</b>. Blokuje tylko człowiek — Ty. Blokada zatrzymuje zapis wyników i pokazuje graczowi ekran z prośbą o kontakt.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Zgłoszenia z aplikacji</h3>
          <label className="text-xs inline-flex items-center gap-1.5">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> pokaż sprawdzone
          </label>
        </div>
        {list.map((r) => (
          <div key={r.uid} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 text-sm">
                <p className="font-bold">
                  {nameOf(r.uid, r.login)} <span className="font-normal text-[var(--th-text-muted)]">„{r.login}”</span>{' '}
                  <span className={STATE_PL[r.state].cls}>{STATE_PL[r.state].label}</span>
                  {r.trusted && <span className="ml-1 text-emerald-600">★ zaufane</span>}
                </p>
                <p className="text-xs text-[var(--th-text-muted)]">
                  ostatnio {fmt(r.updatedAtMs)}
                  {r.device && ` · urządzenie ${r.device.slice(0, 10)}`}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {r.events
                    .slice(-6)
                    .reverse()
                    .map((e, i) => (
                      <li key={i} className="text-xs">
                        <b>{REASON_LABELS[e.k] ?? e.k}</b> · {fmt(e.at)}
                        {e.d && <span className="text-[var(--th-text-muted)]"> · {e.d}</span>}
                      </li>
                    ))}
                </ul>
              </div>
              {actions(r.uid, r.state)}
            </div>
          </div>
        ))}
        {list.length === 0 && <p className={`${card} text-sm text-[var(--th-text-muted)]`}>Brak zgłoszeń. 👍</p>}
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">Skan danych na serwerze</h3>
        {findings.fastSeries.map(({ a, bad }) => {
          const r = reviews.find((x) => x.uid === a.uid);
          return (
            <div key={a.uid} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm">
                  <p className="font-bold">
                    {a.name} „{a.login}” — {bad.length} {bad.length === 1 ? 'seria' : 'serii'} „w 0 s”
                    {r && <span className={`ml-1 ${STATE_PL[r.state].cls}`}>{STATE_PL[r.state].label}</span>}
                  </p>
                  <p className="text-xs text-[var(--th-text-muted)]">
                    {bad
                      .slice(-3)
                      .map((s) => `${fmt(s.t)}: ${s.correct}/${s.tasks}, śr. ${(s.avgMs / 1000).toFixed(2)} s`)
                      .join(' · ')}
                  </p>
                </div>
                {actions(a.uid, r?.state ?? 'watch')}
              </div>
            </div>
          );
        })}
        {findings.crowdedDevices.map((d) => (
          <div key={d.id} className={`${card} text-sm`}>
            <b>Jedno urządzenie, {d.logins.length} kont</b> ({d.platform}, {d.browser}): {d.logins.join(', ')}
            <p className="text-xs text-[var(--th-text-muted)]">Rodzeństwo na jednym tablecie to normalne. Podejrzane, gdy konta są „puste” i dołączają do tej samej grupy.</p>
          </div>
        ))}
        {findings.guessed.map(([login, n]) => (
          <div key={login} className={`${card} text-sm`}>
            <b>Zgadywanie hasła:</b> „{login}” — {n} błędnych prób w 24 h. Aplikacja blokuje urządzenie na 5 min po 5 błędach; Firebase dodatkowo spowalnia logowanie.
          </div>
        ))}
        {findings.fastSeries.length + findings.crowdedDevices.length + findings.guessed.length === 0 && (
          <p className={`${card} text-sm text-[var(--th-text-muted)]`}>Nic podejrzanego w danych na serwerze.</p>
        )}
      </div>
    </div>
  );
}
