import { Award, ChevronRight } from 'lucide-react';
import { HelpButton } from '../help/HelpButton';
import { useMemo, useState } from 'react';
import { LEVEL_STAGES, TOURNAMENTS } from '../data/curriculum';
import type { CertificateData } from '../engine/certificateCanvas';
import type { UserProfile } from '../types/math';
import { CertificateDialog } from './CertificateDialog';

interface MyCertificatesProps {
  profile: UserProfile;
  primaryColor?: string;
  accentColor?: string;
}

const MEDAL_NAME: Record<string, string> = {
  puchar: 'Puchar Mistrza',
  zloto: 'Złoty Medal',
  srebro: 'Srebrny Medal',
  braz: 'Brązowy Medal',
};

/** Lista zdobytych certyfikatów — każdy można otworzyć, wydrukować i udostępnić ponownie. */
export function MyCertificates({ profile, primaryColor, accentColor }: MyCertificatesProps) {
  const [open, setOpen] = useState<CertificateData | null>(null);

  const certs = useMemo<CertificateData[]>(() => {
    const list: CertificateData[] = [];
    const sessions = profile.sessions ?? [];
    for (const t of TOURNAMENTS) {
      const best = profile.tournamentBests?.[t.id];
      if (!best || best.medal === 'brak') continue;
      list.push({
        kind: 'tournament',
        playerName: profile.name,
        title: t.title,
        distinction: MEDAL_NAME[best.medal],
        accuracyPct: best.bestAccuracyPct,
        totalTimeSec: best.bestTimeSec,
        tasks: t.taskCount,
        maxRange: t.maxRange,
        dateMs: best.lastPlayedAt || Date.now(),
        primaryColor,
        accentColor,
      });
    }
    for (const st of LEVEL_STAGES) {
      if (!profile.completedStageIds.includes(st.id)) continue;
      const s = [...sessions].reverse().find((x) => x.stageId === st.id && x.passedThreshold);
      list.push({
        kind: 'stage',
        playerName: profile.name,
        title: st.title,
        distinction: st.badgeName,
        accuracyPct: s?.accuracyPct,
        avgTimeSec: s ? s.avgTimeMs / 1000 : undefined,
        totalTimeSec: s ? s.totalTimeMs / 1000 : undefined,
        tasks: s?.totalTasks ?? st.taskCount,
        maxRange: st.maxRange,
        dateMs: s?.timestamp ?? Date.now(),
        primaryColor,
        accentColor,
      });
    }
    const lvl = profile.masterLevel ?? 0;
    if (lvl > 0) {
      const s = [...sessions].reverse().find((x) => x.masterLevel === lvl && x.passedThreshold);
      list.push({
        kind: 'master',
        playerName: profile.name,
        title: `Wyzwanie Mistrza — poziom ${lvl}`,
        accuracyPct: s?.accuracyPct,
        avgTimeSec: s ? s.avgTimeMs / 1000 : undefined,
        tasks: s?.totalTasks,
        maxRange: s?.maxRange,
        dateMs: s?.timestamp ?? Date.now(),
        primaryColor,
        accentColor,
      });
    }
    return list.sort((a, b) => b.dateMs - a.dateMs);
  }, [profile, primaryColor, accentColor]);

  return (
    <section className="bg-[var(--th-surface)] border border-[var(--th-border)] rounded-3xl p-4 sm:p-6 space-y-3" data-testid="my-certificates">
      <div className="flex items-center gap-2">
        <Award className="w-5 h-5 text-amber-500" aria-hidden="true" />
        <h2 className="font-display text-lg font-bold text-[var(--th-text)]">Moje certyfikaty ({certs.length})</h2>
        <HelpButton section="certificates" label="Certyfikaty" />
      </div>
      {certs.length === 0 ? (
        <p className="text-sm text-[var(--th-text-muted)]">
          Zdobądź medal w turnieju, przejdź etap Ścieżki Mistrza albo poziom Wyzwania Mistrza — certyfikat pojawi się
          tutaj, gotowy do druku.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {certs.map((c) => (
            <button
              key={`${c.kind}-${c.title}`}
              type="button"
              onClick={() => setOpen(c)}
              className="text-left min-h-[56px] px-3 py-2 rounded-2xl border border-[var(--th-border)] hover:border-amber-400 bg-[var(--th-surface-muted)] inline-flex items-center gap-3 cursor-pointer"
            >
              <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 inline-flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[var(--th-text)] truncate">{c.title}</span>
                <span className="block text-xs text-[var(--th-text-muted)] truncate">
                  {c.distinction ? `${c.distinction} · ` : ''}
                  {new Date(c.dateMs).toLocaleDateString('pl-PL')}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--th-text-muted)] shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {open && <CertificateDialog data={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
