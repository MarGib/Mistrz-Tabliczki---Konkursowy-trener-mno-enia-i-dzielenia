import type { UserProfile } from '../types/math';

const DIACRITIC_MAP: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
};

export function normalizeLogin(input: string): string {
  const lowered = input.trim().toLowerCase();
  const ascii = lowered.replace(/[ąćęłńóśźż]/g, (ch) => DIACRITIC_MAP[ch] ?? ch);
  const cleaned = ascii.replace(/[^a-z0-9._-]/g, '');
  return cleaned || 'gracz';
}

export function hashAccountPassword(password: string, salt: string): string {
  const raw = `mt-v1:${salt}:${password}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let round = 0; round < 64; round++) {
    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);
      h1 ^= code + round;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= (code << 5) ^ (h1 >>> 3);
      h2 = Math.imul(h2, 0x85ebca6b);
    }
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}`;
}

export function hasAccountPassword(
  profile: Pick<UserProfile, 'passwordHash'>
): boolean {
  return Boolean(profile.passwordHash && profile.passwordHash.length > 0);
}

export function verifyAccountCredentials(
  profile: Pick<UserProfile, 'id' | 'name' | 'login' | 'passwordHash'>,
  candidatePassword: string,
  candidateLogin?: string
): boolean {
  if (!profile.passwordHash) return true;
  if (candidateLogin !== undefined && candidateLogin.trim().length > 0) {
    const expectedLogin = normalizeLogin(profile.login || profile.name);
    if (normalizeLogin(candidateLogin) !== expectedLogin) {
      return false;
    }
  }
  const candidateHash = hashAccountPassword(candidatePassword, profile.id);
  return candidateHash === profile.passwordHash;
}
