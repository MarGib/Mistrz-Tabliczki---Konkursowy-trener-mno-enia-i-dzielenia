import { LifeBuoy, Send } from 'lucide-react';
import { useState } from 'react';
import { sendHelpRequest, type HelpRequestInput } from '../engine/telemetry';

const TOPICS: { id: HelpRequestInput['topic']; label: string }[] = [
  { id: 'password', label: 'Nie pamiętam hasła' },
  { id: 'login', label: 'Nie mogę się zalogować' },
  { id: 'sync', label: 'Wyniki się nie zapisują' },
  { id: 'other', label: 'Inny problem' },
];

/** Prośba o pomoc do rodzica (administratora) — trafia do panelu administratora. */
export function HelpRequestForm({
  defaultLogin = '',
  defaultTopic = 'password',
  onDone,
}: {
  defaultLogin?: string;
  defaultTopic?: HelpRequestInput['topic'];
  onDone?: () => void;
}) {
  const [login, setLogin] = useState(defaultLogin);
  const [topic, setTopic] = useState<HelpRequestInput['topic']>(defaultTopic);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim()) return;
    setState('sending');
    try {
      await Promise.race([
        sendHelpRequest({ login, topic, message, contact }),
        new Promise((_, rej) => window.setTimeout(() => rej(new Error('timeout')), 12000)),
      ]);
      setState('sent');
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-950 p-3 text-sm space-y-2">
        <p className="font-bold">Wysłane! Rodzic zobaczy prośbę w panelu administratora.</p>
        <p>Gdy ustawi nowe hasło, przekaże Ci je — zaloguj się nim przez „Mam już konto”.</p>
        {onDone && (
          <button type="button" onClick={onDone} className="min-h-[40px] px-4 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer">
            OK
          </button>
        )}
      </div>
    );
  }

  const field =
    'w-full min-h-[42px] px-3 rounded-xl border border-[var(--th-border)] bg-[var(--th-canvas)] text-[var(--th-text)] text-sm';

  return (
    <form onSubmit={submit} className="space-y-2.5" data-testid="help-request-form">
      <p className="text-sm font-bold inline-flex items-center gap-1.5">
        <LifeBuoy className="w-4 h-4 text-[var(--th-primary)]" aria-hidden="true" /> Poproś rodzica o pomoc
      </p>
      <div>
        <label htmlFor="hr-login" className="block text-xs font-bold mb-1">Twój login *</label>
        <input id="hr-login" value={login} onChange={(e) => setLogin(e.target.value)} required maxLength={40} className={field} placeholder="np. ola" />
      </div>
      <div>
        <span className="block text-xs font-bold mb-1">W czym pomóc?</span>
        <div className="flex flex-wrap gap-1.5">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTopic(t.id)}
              aria-pressed={topic === t.id}
              className={`min-h-[36px] px-3 rounded-full border text-xs font-bold cursor-pointer ${
                topic === t.id
                  ? 'bg-[var(--th-primary)] border-[var(--th-primary)] text-[var(--th-primary-fg)]'
                  : 'bg-[var(--th-surface)] border-[var(--th-border)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="hr-msg" className="block text-xs font-bold mb-1">Opisz krótko (opcjonalnie)</label>
        <textarea id="hr-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={2} className={`${field} py-2`} />
      </div>
      <div>
        <label htmlFor="hr-contact" className="block text-xs font-bold mb-1">Jak się z Tobą skontaktować? (opcjonalnie)</label>
        <input id="hr-contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={80} className={field} placeholder="np. imię rodzica, telefon" />
      </div>
      {state === 'error' && (
        <p className="text-xs font-bold text-red-600">Nie udało się wysłać — sprawdź internet i spróbuj ponownie.</p>
      )}
      <button
        type="submit"
        disabled={state === 'sending' || !login.trim()}
        className="w-full min-h-[44px] rounded-xl bg-[var(--th-primary)] text-[var(--th-primary-fg)] font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        <Send className="w-4 h-4" aria-hidden="true" /> {state === 'sending' ? 'Wysyłanie…' : 'Wyślij prośbę'}
      </button>
    </form>
  );
}
