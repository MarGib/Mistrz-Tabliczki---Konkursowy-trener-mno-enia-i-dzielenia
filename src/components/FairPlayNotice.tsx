import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { UserProfile } from '../types/math';
import { HelpRequestForm } from './HelpRequestForm';

/**
 * Uczciwa gra — komunikaty dla gracza:
 *  • „do sprawdzenia”: spokojna karta, gra działa normalnie, wyniki chwilowo poza rankingami,
 *  • „zablokowane”: decyzja opiekuna — ekran z wylogowaniem i prośbą o kontakt.
 */
export function FairPlayNotice({
  profile,
  onLogout,
}: {
  profile: UserProfile;
  onLogout: () => void;
}) {
  const [askHelp, setAskHelp] = useState(false);
  const state = profile.review?.state;

  if (state === 'suspended') {
    return (
      <div className="fixed inset-0 z-[80] bg-[var(--th-canvas)] overflow-y-auto" role="alertdialog" aria-modal="true" aria-labelledby="fp-title">
        <div className="max-w-md mx-auto px-5 py-10 text-center">
          <ShieldAlert className="w-14 h-14 mx-auto text-rose-500" aria-hidden="true" />
          <h1 id="fp-title" className="mt-4 font-display text-2xl font-bold text-[var(--th-text)]">
            Konto jest wstrzymane
          </h1>
          <p className="mt-3 text-[var(--th-text-muted)] leading-relaxed">
            Opiekun aplikacji wstrzymał konto <strong className="text-[var(--th-text)]">{profile.login ?? profile.name}</strong>,
            bo wyniki wyglądały tak, jakby grał automat albo ktoś podpowiadał. Jeśli to pomyłka — napisz do opiekuna,
            sprawdzi to i odblokuje konto. Postęp nie przepadnie.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setAskHelp((v) => !v)}
              className="h-12 rounded-2xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-bold"
            >
              Napisz do opiekuna
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="h-12 rounded-2xl border border-[var(--th-border)] bg-[var(--th-surface)] text-[var(--th-text)] font-semibold"
            >
              Wyloguj i zmień gracza
            </button>
          </div>
          {askHelp && (
            <div className="mt-6 text-left">
              <HelpRequestForm defaultLogin={profile.login ?? profile.name} defaultTopic="other" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div className="max-w-5xl mx-auto px-4 pt-3">
        <div className="flex gap-3 items-start rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3.5">
          <ShieldCheck className="w-6 h-6 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="text-sm leading-relaxed text-[var(--th-text)]">
            <strong>Wyniki czekają na sprawdzenie.</strong> Ostatnia seria była niezwykle szybka, więc opiekun rzuci na nią
            okiem. Do tego czasu Twoje wyniki nie pokazują się w rankingach grupy — ale grać i ćwiczyć możesz normalnie.
          </div>
        </div>
      </div>
    );
  }

  return null;
}
