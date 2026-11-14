/**
 * Konta „login + hasło” synchronizowane w Firebase — bez konta Google.
 *
 * Każde konto gracza to osobny użytkownik Firebase Auth (e-mail techniczny wyprowadzony z loginu,
 * dziecko go nie widzi). Każde konto ma własną instancję aplikacji Firebase, dzięki czemu kilka
 * dzieci na jednym tablecie pozostaje zalogowanych niezależnie.
 *
 * Dane:
 *  - accounts/{uid}                     – pełny profil gracza (tylko właściciel)
 *  - circles/{circleId}                 – grupa (nazwa, kod, właściciel)
 *  - circles/{circleId}/members/{uid}   – członkostwo konta w grupie
 *  - circles/{circleId}/players/{uid}   – publiczna karta wyników widoczna tylko w tej grupie
 *  - circleCodes/{code}                 – kod zaproszenia → circleId
 */
import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  type User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import {
  type Firestore,
  type Unsubscribe,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { CircleMembership, UserProfile } from '../types/math';
import { normalizeLogin } from './accountSecurity';
import {
  type ArenaPlayerCard,
  profileToArenaPlayerCard,
  sanitizeFirestoreId,
  stripUndefinedDeep,
} from './cloudMerge';

const EMAIL_DOMAIN = 'konta.mistrz-tabliczki.app';

export interface CirclePlayerCard extends ArenaPlayerCard {
  uid: string;
}

interface AccountHandle {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

const handles = new Map<string, AccountHandle>();

function appNameForLogin(login: string): string {
  return `acct-${normalizeLogin(login)}`;
}

function getHandle(login: string): AccountHandle {
  const name = appNameForLogin(login);
  const cached = handles.get(name);
  if (cached) return cached;
  const app = getApps().some((a) => a.name === name) ? getApp(name) : initializeApp(firebaseConfig, name);
  const handle: AccountHandle = {
    app,
    auth: getAuth(app),
    db: getFirestore(app, firebaseConfig.firestoreDatabaseId),
  };
  handles.set(name, handle);
  return handle;
}

/** Techniczny e-mail konta: dziecko widzi tylko swój login. */
export function loginToEmail(login: string): string {
  const local = normalizeLogin(login).replace(/\./g, '_').slice(0, 40);
  return `u-${local}@${EMAIL_DOMAIN}`;
}

/** Firebase wymaga min. 6 znaków — PIN-y dzieci bywają krótsze, więc hasło techniczne jest dłuższe. */
function toFirebasePassword(login: string, password: string): string {
  return `mt#${password}#${normalizeLogin(login)}`;
}

/** Czeka, aż Firebase odtworzy zapamiętaną sesję konta (po odświeżeniu strony). */
function waitForAuthReady(auth: Auth): Promise<User | null> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

export async function getSignedInAccountUid(login: string): Promise<string | null> {
  const { auth } = getHandle(login);
  const user = auth.currentUser ?? (await waitForAuthReady(auth));
  return user?.uid ?? null;
}

export function getCachedAccountUid(login: string): string | null {
  return getHandle(login).auth.currentUser?.uid ?? null;
}

function errorCode(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code?: unknown }).code ?? '')
    : '';
}

export function describeAccountError(err: unknown): string {
  const code = errorCode(err);
  if (code === 'auth/email-already-in-use') {
    return 'Ten login jest już zajęty. Wybierz inny.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-login-credentials'
  ) {
    return 'Nieprawidłowy login lub hasło. Jeśli konto założono wcześniej na innym urządzeniu, otwórz je tam i wpisz hasło, aby włączyć synchronizację.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Za dużo prób logowania. Odczekaj chwilę i spróbuj ponownie.';
  }
  if (code === 'auth/network-request-failed' || code === 'unavailable') {
    return 'Brak połączenia z internetem. Wyniki zapiszą się lokalnie i zsynchronizują później.';
  }
  if (code === 'permission-denied') {
    return 'Brak uprawnień do tej operacji.';
  }
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return msg || 'Nie udało się połączyć z bazą.';
}

function accountDocPayload(uid: string, profile: UserProfile): Record<string, unknown> {
  const { passwordHash: _ph, ...rest } = profile;
  void _ph;
  return {
    uid,
    login: normalizeLogin(profile.login || profile.name).slice(0, 32),
    profile: stripUndefinedDeep({
      ...rest,
      sessions: (Array.isArray(profile.sessions) ? profile.sessions : []).slice(-60),
    }),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Zakłada konto w chmurze albo loguje do istniejącego (gdy login już jest „nasz”).
 * Zwraca uid konta Firebase.
 */
export async function registerOrSignInAccount(
  profile: UserProfile,
  password: string
): Promise<{ uid: string; created: boolean; cloudProfile: UserProfile | null }> {
  const login = normalizeLogin(profile.login || profile.name);
  const { auth, db } = getHandle(login);
  const email = loginToEmail(login);
  const fbPassword = toFirebasePassword(login, password);

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, fbPassword);
    await setDoc(doc(db, 'accounts', cred.user.uid), accountDocPayload(cred.user.uid, profile));
    return { uid: cred.user.uid, created: true, cloudProfile: null };
  } catch (err) {
    if (errorCode(err) !== 'auth/email-already-in-use') throw err;
  }

  // Login istnieje — jeśli hasło pasuje, to to samo konto (np. z innego urządzenia).
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, email, fbPassword);
  } catch (err) {
    const code = errorCode(err);
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/invalid-login-credentials') {
      const taken = new Error('Ten login jest już zajęty przez inne konto. Wybierz inny login.');
      (taken as Error & { code?: string }).code = 'login-taken';
      throw taken;
    }
    throw err;
  }
  const snap = await getDoc(doc(db, 'accounts', cred.user.uid));
  const cloudProfile = snap.exists() ? (snap.data().profile as UserProfile) : null;
  return { uid: cred.user.uid, created: false, cloudProfile };
}

/** Logowanie na nowym urządzeniu: login + hasło → profil z chmury. */
export async function signInAccountAndFetch(
  loginInput: string,
  password: string
): Promise<{ uid: string; profile: UserProfile }> {
  const login = normalizeLogin(loginInput);
  const { auth, db } = getHandle(login);
  const cred = await signInWithEmailAndPassword(auth, loginToEmail(login), toFirebasePassword(login, password));
  const snap = await getDoc(doc(db, 'accounts', cred.user.uid));
  if (!snap.exists()) {
    throw new Error('Konto istnieje, ale nie ma jeszcze zapisanych wyników.');
  }
  return { uid: cred.user.uid, profile: snap.data().profile as UserProfile };
}

export async function pushAccountProfile(profile: UserProfile): Promise<void> {
  const login = normalizeLogin(profile.login || profile.name);
  const { auth, db } = getHandle(login);
  const user = auth.currentUser;
  if (!user) return;
  await setDoc(doc(db, 'accounts', user.uid), accountDocPayload(user.uid, profile));
}

export function subscribeAccountProfile(
  login: string,
  onProfile: (profile: UserProfile) => void
): Unsubscribe {
  const { auth, db } = getHandle(login);
  const user = auth.currentUser;
  if (!user) return () => {};
  return onSnapshot(
    doc(db, 'accounts', user.uid),
    (snap) => {
      if (snap.exists() && !snap.metadata.hasPendingWrites) {
        onProfile(snap.data().profile as UserProfile);
      }
    },
    () => {}
  );
}

export async function changeAccountPassword(login: string, newPassword: string): Promise<void> {
  const { auth } = getHandle(login);
  if (!auth.currentUser) return;
  await updatePassword(auth.currentUser, toFirebasePassword(login, newPassword));
}

export async function signOutAccount(login: string): Promise<void> {
  const { auth } = getHandle(login);
  if (auth.currentUser) await signOut(auth);
}

/* ------------------------------ Grupy (circles) ------------------------------ */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function requireAccount(login: string): { uid: string; db: Firestore } {
  const { auth, db } = getHandle(login);
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Najpierw zaloguj konto loginem i hasłem, aby korzystać z grup.');
  }
  return { uid, db };
}

export async function createCircle(login: string, rawName: string): Promise<CircleMembership> {
  const { uid, db } = requireAccount(login);
  const name = rawName.trim().slice(0, 40);
  if (!name) throw new Error('Podaj nazwę grupy.');
  const circleId = `c-${randomCode(10).toLowerCase()}`;
  const joinCode = `G-${randomCode(5)}`;
  const batch = writeBatch(db);
  batch.set(doc(db, 'circles', circleId), {
    name,
    ownerUid: uid,
    joinCode,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'circleCodes', joinCode), { circleId, createdAt: serverTimestamp() });
  batch.set(doc(db, 'circles', circleId, 'members', uid), {
    uid,
    joinCode,
    joinedAt: serverTimestamp(),
  });
  await batch.commit();
  return { id: circleId, name, code: joinCode, share: true, owner: true };
}

export async function joinCircleByCode(login: string, rawCode: string): Promise<CircleMembership> {
  const { uid, db } = requireAccount(login);
  let code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (code && !code.startsWith('G-')) code = `G-${code.replace(/^G/, '')}`;
  if (code.length < 4) throw new Error('Wpisz kod grupy, np. G-AB12C.');
  const codeSnap = await getDoc(doc(db, 'circleCodes', code)).catch(() => null);
  if (!codeSnap || !codeSnap.exists()) {
    throw new Error('Nie znaleziono grupy o takim kodzie.');
  }
  const circleId = String(codeSnap.data().circleId);
  // Już członek (np. grupa zniknęła tylko z listy na tym urządzeniu) — nie zapisuj ponownie.
  const existing = await getDoc(doc(db, 'circles', circleId, 'members', uid)).catch(() => null);
  if (!existing?.exists()) await setDoc(doc(db, 'circles', circleId, 'members', uid), {
    uid,
    joinCode: code,
    joinedAt: serverTimestamp(),
  });
  const circleSnap = await getDoc(doc(db, 'circles', circleId));
  const data = circleSnap.data() ?? {};
  return {
    id: circleId,
    name: String(data.name ?? 'Grupa'),
    code,
    share: true,
    owner: data.ownerUid === uid,
  };
}

export async function leaveCircle(login: string, circleId: string): Promise<void> {
  const { uid, db } = requireAccount(login);
  await deleteDoc(doc(db, 'circles', circleId, 'players', uid)).catch(() => {});
  await deleteDoc(doc(db, 'circles', circleId, 'members', uid));
}

/** Publikuje (albo ukrywa) kartę wyników gracza w każdej z jego grup, zgodnie z wyborem „pokazuj”. */
export async function publishCircleCards(profile: UserProfile): Promise<void> {
  const circles = profile.circles ?? [];
  if (circles.length === 0) return;
  const login = normalizeLogin(profile.login || profile.name);
  const { auth, db } = getHandle(login);
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const card = profileToArenaPlayerCard(profile);
  const { schoolName: _s, className: _c, ...rest } = card;
  void _s;
  void _c;
  // serverTimestamp() dokładamy PO czyszczeniu — inaczej znacznik zostałby zepsuty.
  const payload = {
    ...stripUndefinedDeep({ ...rest, uid, profileId: sanitizeFirestoreId(profile.id) }),
    updatedAt: serverTimestamp(),
  };
  await Promise.all(
    circles.map((c) =>
      c.share
        ? setDoc(doc(db, 'circles', c.id, 'players', uid), payload).catch(() => {})
        : deleteDoc(doc(db, 'circles', c.id, 'players', uid)).catch(() => {})
    )
  );
}

export function subscribeCirclePlayers(
  login: string,
  circleId: string,
  onPlayers: (players: CirclePlayerCard[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const { auth, db } = getHandle(login);
  if (!auth.currentUser) return () => {};
  return onSnapshot(
    collection(db, 'circles', circleId, 'players'),
    (snap) => {
      const players: CirclePlayerCard[] = [];
      snap.forEach((d) => {
        const data = d.data() as Partial<CirclePlayerCard>;
        if (typeof data.xp !== 'number' || typeof data.name !== 'string') return;
        players.push({
          uid: d.id,
          profileId: String(data.profileId ?? d.id),
          name: data.name,
          avatarId: String(data.avatarId ?? 'owl'),
          customAvatarSpec: data.customAvatarSpec,
          xp: data.xp,
          streakDays: Number(data.streakDays ?? 0),
          solvedTasks: Number(data.solvedTasks ?? 0),
          accuracyPct: Number(data.accuracyPct ?? 0),
          avgTimeSec: typeof data.avgTimeSec === 'number' ? data.avgTimeSec : undefined,
          sessionsCount: Number(data.sessionsCount ?? 0),
          tournamentBests: (data.tournamentBests ?? {}) as CirclePlayerCard['tournamentBests'],
          updatedAtMs: Number(data.updatedAtMs ?? 0),
        });
      });
      onPlayers(players);
    },
    (err) => onError?.(err)
  );
}
