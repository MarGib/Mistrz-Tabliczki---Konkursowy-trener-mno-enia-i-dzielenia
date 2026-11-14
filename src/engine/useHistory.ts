import { useEffect, useMemo, useState } from 'react';
import type { SessionRecord, UserProfile } from '../types/math';
import { type SessionLite, fullHistory, liteToRecord, onHistoryChange } from './history';

/** Cała historia serii gracza (archiwum + bieżące), odświeżana po zmianach. */
export function useFullHistory(profile: Pick<UserProfile, 'id' | 'sessions'>): SessionLite[] {
  const [tick, setTick] = useState(0);
  useEffect(() => onHistoryChange((pid) => pid === profile.id && setTick((t) => t + 1)), [profile.id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fullHistory(profile.id, profile.sessions ?? []), [profile.id, profile.sessions, tick]);
}

/** Jak wyżej, ale jako zwykłe serie (pełne szczegóły tam, gdzie są — z profilu). */
export function useFullSessions(profile: Pick<UserProfile, 'id' | 'sessions'>): SessionRecord[] {
  const lite = useFullHistory(profile);
  return useMemo(() => {
    const recent = new Map((profile.sessions ?? []).map((s) => [String(s.id), s]));
    return lite.map((l) => recent.get(l.id) ?? liteToRecord(l));
  }, [lite, profile.sessions]);
}
