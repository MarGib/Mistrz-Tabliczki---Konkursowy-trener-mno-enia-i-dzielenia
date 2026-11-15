import { useEffect, useState } from 'react';
import { fetchIsOwnerAccount } from './accountCloud';

/**
 * Czy zalogowane konto gracza jest kontem właściciela aplikacji (skrót do panelu administratora w Koncie).
 * Wynik trzymamy na urządzeniu, żeby działał bez internetu i nie zużywał odczytów bazy:
 * „tak” sprawdzamy ponownie po 12 h, „nie” po 30 min (żeby nowo oznaczone konto szybko dostało przycisk).
 */
const KEY = 'mt_owner_accounts';
const RECHECK_YES_MS = 12 * 3600_000;
const RECHECK_NO_MS = 30 * 60_000;

type Cache = Record<string, { v: boolean; at: number }>;

function readCache(): Cache {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    return raw && typeof raw === 'object' ? (raw as Cache) : {};
  } catch {
    return {};
  }
}

function writeCache(uid: string, v: boolean): void {
  try {
    const c = readCache();
    c[uid] = { v, at: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // brak localStorage — sprawdzimy następnym razem
  }
}

export function useOwnerAccount(uid: string | undefined, login: string): boolean {
  const [isOwner, setIsOwner] = useState(() => (uid ? readCache()[uid]?.v === true : false));

  useEffect(() => {
    if (!uid) {
      setIsOwner(false);
      return;
    }
    const cached = readCache()[uid];
    setIsOwner(cached?.v === true);
    if (cached && Date.now() - cached.at < (cached.v ? RECHECK_YES_MS : RECHECK_NO_MS)) return;
    if (!navigator.onLine) return;
    let stop = false;
    fetchIsOwnerAccount(login)
      .then((v) => {
        writeCache(uid, v);
        if (!stop) setIsOwner(v);
      })
      .catch(() => {
        // brak sieci / limit bazy / reguły jeszcze nieopublikowane — zostaje to, co na urządzeniu
      });
    return () => {
      stop = true;
    };
  }, [uid, login]);

  return isOwner;
}
