/** Przykładowe dane do podglądu panelu administratora (tylko `npm run dev`, adres ?__admindemo). */
import { resolveThemeById } from '../data/themes';
import { themeToCssVariables } from '../engine/themeEngine';
import { AdminPanel, type AdminDemoData } from '../components/AdminPanel';
import { AdminQuickPeekDemo } from './AdminQuickPeekDemo';

const DAY = 86_400_000;
const now = Date.now();
const names = ['Aga', 'Ola', 'Kuba', 'Zosia', 'Spiderman', 'Tester B', 'Marek', 'Hania'];
const kinds = ['stage', 'tournament', 'master', 'free'] as const;
let seed = 7;
const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

export const DEMO: AdminDemoData = {
  accounts: names.map((n, i) => ({
    login: n.toLowerCase().replace(' ', ''),
    uid: `u${i}`,
    profileId: `p${i}`,
    name: n,
    xp: Math.round(rnd() * 5000),
    sessions: 10 + i * 3,
    lastActiveDate: new Date(now - i * DAY * 1.5).toISOString().slice(0, 10),
    updatedAtMs: now - i * DAY * 1.5,
    groups: i % 2 ? ['3B (G-PRZYK)'] : [],
    recent: Array.from({ length: 12 - i }, (_, k) => ({
      t: now - Math.floor(rnd() * 14) * DAY - k * 3600_000,
      kind: kinds[Math.floor(rnd() * 4)],
      mode: 'mixed',
      tasks: 10,
      correct: i === 6 && k < 2 ? 10 : 8 + Math.floor(rnd() * 3),
      avgMs: i === 6 && k < 2 ? 320 : 1800 + rnd() * 3000,
    })),
  })),
  events: [
    { id: 'e1', login: 'ola', ok: true, reason: 'ok', device: 'iPad', atMs: now - 3600_000 },
    { id: 'e2', login: 'olaa', ok: false, reason: 'no-login', device: 'iPad', atMs: now - 3700_000 },
  ],
  devices: names.slice(0, 6).map((n, i) => ({
    id: `d${i}`,
    platform: ['iPad', 'iPhone', 'Android telefon', 'Windows', 'iPhone', 'Mac'][i],
    browser: ['Safari', 'Safari', 'Chrome', 'Edge', 'Safari', 'Chrome'][i],
    installed: i < 3,
    appVersion: i === 4 ? '2026-11-13 21:10' : '2026-11-14 20:44',
    logins: [n.toLowerCase()],
    unsent: i === 2,
    dbPaused: false,
    firstSeenMs: now - 20 * DAY,
    lastSeenMs: now - i * 7200_000,
  })),
  errors: [
    { id: 'x1', message: "TypeError: Cannot read properties of undefined (reading 'sessions')", stack: 'at computeStats (index.js:1:2345)', appVersion: '2026-11-14 20:44', platform: 'iPad', device: 'd0', atMs: now - 5 * 3600_000 },
  ],
  help: [
    { id: 'h1', login: 'ola', topic: 'password', message: 'Zapomniałam hasła na iPadzie', contact: 'mama Oli', platform: 'iPad', status: 'new', atMs: now - 2 * 3600_000 },
    { id: 'h2', login: 'kuba', topic: 'sync', message: '', contact: '', platform: 'Android telefon', status: 'done', atMs: now - 3 * DAY },
  ],
  reviews: [
    { uid: 'u4', login: 'spiderman', state: 'pending', trusted: false, device: 'd4', note: '', updatedAtMs: now - 1800_000,
      events: [{ k: 'superhuman', at: now - 1800_000, d: 'mediana 0.21 s · 20 zad. · 100% · Wyścig 60 s' }, { k: 'automation', at: now - 1800_000, d: 'mediana 0.21 s · 20 zad. · 100% · Wyścig 60 s' }] },
    { uid: 'u2', login: 'kuba', state: 'watch', trusted: false, device: 'd2', note: '', updatedAtMs: now - DAY,
      events: [{ k: 'window-switch', at: now - DAY, d: 'mediana 4.10 s · 10 zad. · 100% · Twierdza Dzielenia' }] },
  ],
  hosting: { appVersion: '2026-11-14 20:44', coreBytes: 2_972_253, totalBytes: 10_313_259 },
  usage: Array.from({ length: 14 }, (_, i) => ({
    day: new Date(now - (13 - i) * DAY).toISOString().slice(0, 10),
    reads: Math.round(1500 + rnd() * 6000 + i * 300),
    writes: Math.round(300 + rnd() * 1500),
    deletes: Math.round(rnd() * 50),
  })),
};

export function AdminDemo() {
  const theme = resolveThemeById('classic', []);
  return (
    <div style={themeToCssVariables(theme) as React.CSSProperties} className="min-h-screen bg-[var(--th-canvas)] text-[var(--th-text)]">
      {window.location.search.includes('peek') ? <AdminQuickPeekDemo /> : <AdminPanel onClose={() => {}} demo={DEMO} />}
    </div>
  );
}
