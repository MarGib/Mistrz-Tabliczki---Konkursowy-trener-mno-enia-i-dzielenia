import type {
  AvatarAccessory,
  AvatarCharacter,
  AvatarProp,
  AvatarSpec,
} from '../types/math';

export const CHARACTER_OPTIONS: { id: AvatarCharacter; label: string }[] = [
  { id: 'owl', label: 'Sowa' },
  { id: 'fox', label: 'Lis' },
  { id: 'cat', label: 'Kot' },
  { id: 'dog', label: 'Piesek' },
  { id: 'panda', label: 'Panda' },
  { id: 'bear', label: 'Miś' },
  { id: 'dragon', label: 'Smok' },
  { id: 'unicorn', label: 'Jednorożec' },
  { id: 'lion', label: 'Lew' },
  { id: 'rabbit', label: 'Królik' },
  { id: 'frog', label: 'Żabka' },
  { id: 'penguin', label: 'Pingwin' },
  { id: 'robot', label: 'Robot' },
  { id: 'alien', label: 'Kosmita' },
  { id: 'astronaut', label: 'Astronauta' },
  { id: 'rocket', label: 'Rakieta' },
  { id: 'wizard', label: 'Czarodziej' },
  { id: 'knight', label: 'Rycerz' },
];

export const ACCESSORY_OPTIONS: { id: AvatarAccessory; label: string }[] = [
  { id: 'none', label: 'Brak' },
  { id: 'glasses', label: 'Okulary' },
  { id: 'crown', label: 'Korona' },
  { id: 'headphones', label: 'Słuchawki' },
  { id: 'cap', label: 'Czapka' },
  { id: 'halo', label: 'Aureola' },
];

export const PROP_OPTIONS: { id: AvatarProp; label: string }[] = [
  { id: 'star', label: 'Gwiazdka' },
  { id: 'trophy', label: 'Puchar' },
  { id: 'lightning', label: 'Błyskawica' },
  { id: 'heart', label: 'Serce' },
  { id: 'calculator', label: 'Kalkulator' },
  { id: 'planet', label: 'Planeta' },
];

export const AVATAR_PALETTE_SWATCHES: { label: string; bg: string; body: string }[] = [
  { label: 'Fioletowy', bg: '#EDE9FE', body: '#7C3AED' },
  { label: 'Czerwony', bg: '#FEE2E2', body: '#DC2626' },
  { label: 'Niebieski', bg: '#DBEAFE', body: '#2563EB' },
  { label: 'Szmaragdowy', bg: '#D1FAE5', body: '#059669' },
  { label: 'Żółty', bg: '#FEF9C3', body: '#EAB308' },
  { label: 'Pomarańczowy', bg: '#FFEDD5', body: '#EA580C' },
  { label: 'Różowy', bg: '#FCE7F3', body: '#DB2777' },
  { label: 'Kosmiczny', bg: '#1E293B', body: '#38BDF8' },
];

const CHARACTER_KEYWORDS: [RegExp, AvatarCharacter][] = [
  [/sow|ptak/, 'owl'],
  [/lis/, 'fox'],
  [/kot|koci|kici/, 'cat'],
  [/pies|psi|szczeni/, 'dog'],
  [/pand/, 'panda'],
  [/mi[sś]|nied[zź]w/, 'bear'],
  [/smok|dino/, 'dragon'],
  [/jednoro[zż]|konik|kuc/, 'unicorn'],
  [/lew|lwi|tygrys/, 'lion'],
  [/kr[oó]l|zaj[aą]c/, 'rabbit'],
  [/[zż]ab/, 'frog'],
  [/pingwin/, 'penguin'],
  [/robot|android|cyborg/, 'robot'],
  [/kosmit|ufo|ufolud/, 'alien'],
  [/astronaut|kosmonaut/, 'astronaut'],
  [/rakiet|statek/, 'rocket'],
  [/czarodziej|mag|czarown|czapka mag/, 'wizard'],
  [/rycerz|wojown|bohater|super/, 'knight'],
];

const COLOR_KEYWORDS: [RegExp, { bg: string; body: string }][] = [
  [/fiolet|purpur|lawend/, { bg: '#EDE9FE', body: '#7C3AED' }],
  [/czerwon|bulls|karmin|rubin/, { bg: '#FEE2E2', body: '#DC2626' }],
  [/niebiesk|b[łl][eę]kit|granat|lazur/, { bg: '#DBEAFE', body: '#2563EB' }],
  [/zielon|szmaragd|mi[eę]t/, { bg: '#D1FAE5', body: '#059669' }],
  [/[zż][oó][łl]t|z[łl]ot|s[łl]on/, { bg: '#FEF9C3', body: '#EAB308' }],
  [/pomara[nń]cz|tygrys|marchew/, { bg: '#FFEDD5', body: '#EA580C' }],
  [/r[oó][zż]|malin/, { bg: '#FCE7F3', body: '#DB2777' }],
  [/czarn|kosmos|ciem|noc/, { bg: '#1E293B', body: '#38BDF8' }],
];

const ACCESSORY_KEYWORDS: [RegExp, AvatarAccessory][] = [
  [/okular/, 'glasses'],
  [/koron|kr[oó]l|ksi[eę][zż]/, 'crown'],
  [/s[łl]uchaw|muzyk/, 'headphones'],
  [/czapk|bejsbol|kapelusz/, 'cap'],
  [/aureol|anio[łl]/, 'halo'],
];

const PROP_KEYWORDS: [RegExp, AvatarProp][] = [
  [/puchar|trofe|medal|konkurs|zwyci/, 'trophy'],
  [/b[łl]yskawic|piorun|szybk|b[łl]ysk/, 'lightning'],
  [/serc|mi[łl]o/, 'heart'],
  [/kalkulator|matemat|liczb|cyfr/, 'calculator'],
  [/planet|kosmos|saturn|księ[zż]yc/, 'planet'],
  [/gwiazd/, 'star'],
];

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Deterministically parses a short Polish description into a multi-layer custom AvatarSpec.
 */
export function parseAvatarPrompt(prompt: string): AvatarSpec {
  const clean = prompt.trim().toLowerCase();
  const h = simpleHash(clean || 'mistrz');

  let character: AvatarCharacter =
    CHARACTER_OPTIONS[h % CHARACTER_OPTIONS.length].id;
  for (const [rx, charId] of CHARACTER_KEYWORDS) {
    if (rx.test(clean)) {
      character = charId;
      break;
    }
  }

  let palette = AVATAR_PALETTE_SWATCHES[h % AVATAR_PALETTE_SWATCHES.length];
  for (const [rx, colors] of COLOR_KEYWORDS) {
    if (rx.test(clean)) {
      palette = { label: '', ...colors };
      break;
    }
  }

  let accessory: AvatarAccessory = 'none';
  for (const [rx, accId] of ACCESSORY_KEYWORDS) {
    if (rx.test(clean)) {
      accessory = accId;
      break;
    }
  }

  let prop: AvatarProp = PROP_OPTIONS[h % PROP_OPTIONS.length].id;
  for (const [rx, propId] of PROP_KEYWORDS) {
    if (rx.test(clean)) {
      prop = propId;
      break;
    }
  }

  return {
    character,
    bgColor: palette.bg,
    bodyColor: palette.body,
    accessory,
    prop,
    prompt: prompt.trim(),
  };
}
