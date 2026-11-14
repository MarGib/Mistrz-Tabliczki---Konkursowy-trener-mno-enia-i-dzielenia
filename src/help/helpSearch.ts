/**
 * Wyszukiwarka w pomocy: bez polskich znaków i wielkości liter, od początku słowa („has” → „hasło”),
 * z synonimami („PIN”, „zapomniałem”, „kasuj”…) i gotowymi pytaniami jako podpowiedziami.
 */
import { HELP_SECTIONS, type HelpSection, type HelpSectionId } from './helpContent';

export function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9×÷ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set(['jak', 'co', 'czy', 'to', 'sie', 'nie', 'na', 'w', 'z', 'do', 'i', 'a', 'o', 'mi', 'moj', 'moje', 'moja', 'mam', 'jest', 'gdzie', 'po', 'za', 'od', 'ze']);

/** Dodatkowe słowa, którymi dzieci i rodzice szukają danego działu. */
export const SECTION_KEYWORDS: Partial<Record<HelpSectionId, string[]>> = {
  start: ['nowe konto', 'rejestracja', 'zalozyc', 'login', 'start'],
  login: ['zaloguj', 'logowanie', 'inny telefon', 'tablet', 'ipad', 'komputer', 'drugie urzadzenie'],
  install: ['instalacja', 'zainstaluj', 'ekran poczatkowy', 'ikona', 'skrot', 'iphone', 'android', 'aplikacja'],
  tour: ['przewodnik', 'samouczek', 'wycieczka'],
  how: ['zasady', 'reguly', 'jak gramy', 'kropki'],
  dots: ['pary', 'luka', 'prawda falsz', 'wyscig', 'historyjka', 'poznaj', 'trudne', 'gry'],
  free: ['wolny', 'swobodny', 'minuty', 'sam wybieram', 'tylko trudne'],
  training: ['klawiatura', 'wpisywanie', 'enter', 'cyfry', 'zadania'],
  hints: ['podpowiedz', 'pomoc w zadaniu', 'zarowka', 'nie wiem'],
  path: ['sciezka', 'modul', 'etap', 'test', 'gwiazdki', 'korona', 'liga', 'most'],
  master: ['wyzwanie', 'poziom', 'mistrz'],
  tournaments: ['turniej', 'medal', 'zloto', 'srebro', 'braz'],
  certificates: ['certyfikat', 'dyplom', 'druk', 'drukuj', 'pdf'],
  groups: ['grupa', 'rodzina', 'klasa', 'znajomi', 'przelacz'],
  'group-create': ['zaloz grupe', 'zaprosic', 'zaproszenie', 'link'],
  'group-join': ['dolacz', 'kod grupy', 'wpisz kod', 'zaproszenie'],
  visibility: ['kto widzi', 'ukryj', 'prywatnosc', 'ranking'],
  stats: ['statystyki', 'raport', 'tydzien', 'wykres', 'postep', 'historia', 'rodzic'],
  rivalry: ['dogonic', 'rywalizacja', 'wyzwania w grupie'],
  notifications: ['powiadomienia', 'dzwonek', 'wiadomosci'],
  sync: ['synchronizacja', 'zapis', 'nie zapisuje', 'chmura', 'wyniki znikaja', 'nie wyslane'],
  offline: ['internet', 'bez internetu', 'offline', 'siec', 'wifi', 'baza'],
  forgot: ['haslo', 'nie pamietam hasla', 'zapomnialem', 'zapomnialam', 'pin', 'reset', 'nowe haslo', 'zmien haslo'],
  logout: ['wyloguj', 'zmien osobe', 'inne konto', 'przelacz gracza'],
  privacy: ['prywatnosc', 'rodo', 'dane osobowe', 'email', 'usun konto', 'usuniecie', 'kasuj'],
  fairplay: ['oszukiwanie', 'bot', 'ai', 'sztuczna inteligencja', 'wstrzymane', 'zablokowane', 'do sprawdzenia', 'uczciwa'],
  parent: ['administrator', 'admin', 'panel', 'rodzic', 'reset hasla'],
};

/** Gotowe pytania — podpowiedzi przy wpisywaniu. */
export const QUICK_QUESTIONS: { q: string; id: HelpSectionId }[] = [
  { q: 'Nie pamiętam hasła', id: 'forgot' },
  { q: 'Jak zalogować się na innym urządzeniu?', id: 'login' },
  { q: 'Jak zainstalować aplikację na telefonie?', id: 'install' },
  { q: 'Jak dołączyć do grupy kodem?', id: 'group-join' },
  { q: 'Jak założyć grupę dla rodziny?', id: 'group-create' },
  { q: 'Wyniki się nie zapisują', id: 'sync' },
  { q: 'Czy mogę grać bez internetu?', id: 'offline' },
  { q: 'Co oznaczają kropki na ścieżce?', id: 'path' },
  { q: 'Jak działa wolny trening?', id: 'free' },
  { q: 'Gdzie jest raport tygodnia dla rodzica?', id: 'stats' },
  { q: 'Kto widzi moje wyniki?', id: 'visibility' },
  { q: 'Jak usunąć konto?', id: 'privacy' },
  { q: 'Dlaczego konto jest wstrzymane?', id: 'fairplay' },
  { q: 'Jak wydrukować certyfikat?', id: 'certificates' },
  { q: 'Jak zmienić osobę / wylogować?', id: 'logout' },
];

interface Indexed {
  s: HelpSection;
  title: string[];
  keys: string[];
  lead: string[];
  body: string[];
}

const words = (t: string) => norm(t).split(' ').filter(Boolean);

let INDEX: Indexed[] | null = null;
function index(): Indexed[] {
  if (INDEX) return INDEX;
  INDEX = HELP_SECTIONS.map((s) => ({
    s,
    title: words(s.title),
    keys: (SECTION_KEYWORDS[s.id] ?? []).flatMap(words),
    lead: words(s.lead),
    body: words([...s.steps, s.tip ?? ''].join(' ')),
  }));
  return INDEX;
}

export function queryTokens(q: string): string[] {
  const all = words(q);
  const meaningful = all.filter((w) => !STOP.has(w));
  return meaningful.length > 0 ? meaningful : all;
}

const hit = (list: string[], tok: string) => list.some((w) => w.startsWith(tok) || (tok.length >= 5 && w.startsWith(tok.slice(0, -1))));

export interface HelpHit {
  section: HelpSection;
  score: number;
}

/** Działy pasujące do zapytania, od najlepszego. Wszystkie słowa muszą pasować; gdy nic — wystarczy część. */
export function searchHelp(q: string): HelpHit[] {
  const toks = queryTokens(q);
  if (toks.length === 0) return [];
  const scored = index().map((ix) => {
    let score = 0;
    let matched = 0;
    for (const t of toks) {
      const s = (hit(ix.title, t) ? 6 : 0) + (hit(ix.keys, t) ? 5 : 0) + (hit(ix.lead, t) ? 2 : 0) + (hit(ix.body, t) ? 1 : 0);
      if (s > 0) matched += 1;
      score += s;
    }
    return { section: ix.s, score, matched };
  });
  const all = scored.filter((x) => x.matched === toks.length && x.score > 0);
  const list = all.length > 0 ? all : scored.filter((x) => x.matched > 0 && x.matched >= Math.ceil(toks.length / 2));
  return list.sort((a, b) => b.score - a.score).map(({ section, score }) => ({ section, score }));
}

export interface HelpSuggestion {
  label: string;
  id: HelpSectionId;
  kind: 'question' | 'section';
}

/** Podpowiedzi przy wpisywaniu: pasujące gotowe pytania i działy (max 6). */
export function helpSuggestions(q: string): HelpSuggestion[] {
  const n = norm(q);
  if (!n) return QUICK_QUESTIONS.slice(0, 5).map((x) => ({ label: x.q, id: x.id, kind: 'question' as const }));
  const toks = queryTokens(q);
  const questions = QUICK_QUESTIONS.filter((x) => {
    const w = words(x.q).concat((SECTION_KEYWORDS[x.id] ?? []).flatMap(words));
    return toks.every((t) => hit(w, t));
  }).map((x) => ({ label: x.q, id: x.id, kind: 'question' as const }));
  const seen = new Set(questions.map((x) => x.id));
  const sections = searchHelp(q)
    .filter((h) => !seen.has(h.section.id))
    .map((h) => ({ label: h.section.title, id: h.section.id, kind: 'section' as const }));
  return [...questions, ...sections].slice(0, 6);
}
