/**
 * Dawna synchronizacja przez konto Google i starą bazę Google AI Studio — WYŁĄCZONA i usunięta.
 *
 * Wszystkie konta przeszły do nowej bazy (projekt „mistrz-tabliczki”, 14.11.2026 — sprawdzone
 * w konsoli Firebase: każdy login ze starej bazy istnieje w nowej). Zostały tylko puste
 * odpowiedniki funkcji, żeby reszta aplikacji nie musiała się zmieniać. Konta i grupy obsługuje
 * accountCloud.ts.
 */
import type { FamilyNotification, UserProfile } from '../types/math';
import type { ArenaPlayerCard } from './cloudMerge';
import { type SchoolDirectoryEntry, slugifySchoolId } from './schoolDirectory';

export const LEGACY_GOOGLE_SYNC_ENABLED = false;

export interface CloudSessionMeta {
  uid: string;
  displayName: string;
  email: string;
  groupId: string;
  joinCode: string;
}

export interface CloudJoinResult {
  meta: CloudSessionMeta;
  existingProfileIds: string[];
}

const GONE = 'Logowanie przez Google nie jest już używane — zaloguj się loginem i hasłem.';
const noop = async (): Promise<void> => {};
const unsub = () => () => {};

export async function signInWithGoogleCloud(): Promise<never> {
  throw new Error(GONE);
}
export const signOutCloud = noop;
export async function joinCloudGroupByCode(..._args: unknown[]): Promise<CloudJoinResult> {
  void _args;
  throw new Error('Kody grup zaczynają się od „G-”. Poproś o aktualny kod grupy.');
}
export const ensureCloudGroupForUser = async (..._args: unknown[]): Promise<CloudSessionMeta> => {
  void _args;
  throw new Error(GONE);
};
export const pushProfileToCloud = async (..._args: [string, string, UserProfile]): Promise<void> => {};
export const pushGroupProfileIds = async (..._args: [string, string[]]): Promise<void> => {};
export const deleteProfileFromCloud = async (..._args: unknown[]): Promise<void> => {};
export const pushNotificationsFeedToCloud = async (..._args: [string, string, FamilyNotification[]]): Promise<void> => {};
export const pushActiveProfileSelectionToCloud = async (..._args: [string, string]): Promise<void> => {};
export const subscribeToGroupCloud = (..._args: unknown[]): (() => void) => unsub();
export const fetchGlobalSchoolDirectory = async (): Promise<SchoolDirectoryEntry[]> => [];
export const pushGlobalSchoolDirectory = async (..._args: [SchoolDirectoryEntry[]]): Promise<void> => {};
export const syncProfilesToArenaBoards = async (..._args: [string, UserProfile[]]): Promise<void> => {};
export const fetchArenaBoard = async (..._args: [string]): Promise<ArenaPlayerCard[]> => [];
export const subscribeToArenaBoard = (..._args: [string, (players: ArenaPlayerCard[]) => void]): (() => void) => unsub();

export function getSchoolArenaBoardId(schoolName: string): string {
  return `school-${slugifySchoolId(schoolName)}`;
}
