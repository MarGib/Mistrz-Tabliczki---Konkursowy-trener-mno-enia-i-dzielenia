import { DatabaseBackup } from 'lucide-react';
import { useState } from 'react';
import { downloadBackup, exportDatabase, lastBackupAt, noteBackupDone } from '../engine/adminCloud';

const card = 'rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface)] p-4';

/** Kopia zapasowa bazy z panelu — plik JSON na urządzenie administratora. */
export function AdminBackup({ compact = false, demo = false }: { compact?: boolean; demo?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState(lastBackupAt());
  const [err, setErr] = useState<string | null>(null);
  const days = last ? Math.floor((Date.now() - last) / 86_400_000) : null;
  const due = days === null || days >= 7;

  const run = async () => {
    setErr(null);
    setBusy('Zaczynam…');
    try {
      const file = await exportDatabase((m) => setBusy(m));
      downloadBackup(file);
      noteBackupDone();
      setLast(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (compact && !due) return null;
  return (
    <div className={`${card} space-y-2 ${compact ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30' : ''}`} data-testid="admin-backup">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <b className="inline-flex items-center gap-1.5">
            <DatabaseBackup className="w-4 h-4" aria-hidden="true" /> Kopia zapasowa bazy
          </b>
          <span className="block text-xs text-[var(--th-text-muted)]">
            {last ? `Ostatnia kopia z tego urządzenia: ${new Date(last).toLocaleDateString('pl-PL')} (${days === 0 ? 'dziś' : `${days} dni temu`})` : 'Na tym urządzeniu nie było jeszcze kopii.'}
            {due && ' · Czas na cotygodniową kopię.'}
          </span>
        </p>
        <button
          type="button"
          disabled={Boolean(busy) || demo}
          onClick={() => void run()}
          className="min-h-[40px] px-3 rounded-xl text-sm font-bold inline-flex items-center gap-1.5 bg-[var(--th-primary)] text-[var(--th-primary-fg)] disabled:opacity-50 cursor-pointer"
        >
          {busy ? 'Pobieram…' : 'Pobierz kopię (JSON)'}
        </button>
      </div>
      {busy && <p className="text-xs text-[var(--th-text-muted)]">{busy}</p>}
      {err && <p className="text-xs text-red-600">{err}</p>}
      {!compact && (
        <p className="text-xs text-[var(--th-text-muted)]">
          Plik zawiera konta (bez haseł), grupy, historię serii, weryfikacje i dzienniki. Trzymaj go w prywatnym miejscu (np. Dysk Google).
          Automatyczna kopia co tydzień działa też w GitHub Actions — szyfrowana, po dodaniu dwóch sekretów (instrukcja: RELEASING.md).
        </p>
      )}
    </div>
  );
}
