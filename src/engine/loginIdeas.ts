/** Losowy login — wesoły, bez danych osobowych (np. „Szybki Lis 27”). */
const ADJ = ['Szybki', 'Sprytny', 'Wesoły', 'Dzielny', 'Bystry', 'Złoty', 'Turbo', 'Kosmiczny', 'Tajny', 'Mądry', 'Odważny', 'Błyskawiczny'];
const NOUN = ['Lis', 'Smok', 'Rakieta', 'Sowa', 'Tygrys', 'Robot', 'Delfin', 'Jednorożec', 'Pingwin', 'Orzeł', 'Panda', 'Kometa'];
// przymiotnik w rodzaju żeńskim dla rzeczowników żeńskich
const FEM = new Set(['Rakieta', 'Sowa', 'Panda', 'Kometa']);

function femin(adj: string): string {
  if (adj.endsWith('y')) return adj.slice(0, -1) + 'a';
  if (adj.endsWith('i')) return adj + 'a';
  return adj;
}

export function randomLogin(rng: () => number = Math.random): string {
  const noun = NOUN[Math.floor(rng() * NOUN.length)];
  let adj = ADJ[Math.floor(rng() * ADJ.length)];
  if (FEM.has(noun)) adj = femin(adj);
  const n = 10 + Math.floor(rng() * 90);
  return `${adj}${noun}${n}`;
}
