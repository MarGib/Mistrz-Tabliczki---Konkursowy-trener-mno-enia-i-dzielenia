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
  deleteUser,
} from 'firebase/auth';
import {
  type Firestore,
  type Unsubscribe,
  addDoc,
  arrayUnion,
  collection,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-accounts-config.json';
import { protectApp } from './appCheck';
import type { CircleMembership, UserProfile } from '../types/math';
import { hashAccountPassword, normalizeLogin } from './accountSecurity';
import { type SessionLite, groupByMonth } from './history';
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
  protectApp(app);
  const handle: AccountHandle = {
    app,
    auth: getAuth(app),
    db: makeDb(app),
  };
  handles.set(name, handle);
  return handle;
}

/**
 * Baza z trwałą kolejką zapisów (IndexedDB): wyniki zapisane bez internetu czekają na urządzeniu
 * i wysyłają się same — także po zamknięciu i ponownym otwarciu aplikacji.
 */
function makeDb(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // np. tryb prywatny bez IndexedDB albo baza już zainicjowana — zwykła pamięć podręczna
    return getFirestore(app);
  }
}

/** Techniczny e-mail konta: dziecko widzi tylko swój login. */
export function loginToEmail(login: string): string {
  const local = normalizeLogin(login).replace(/\./g, '_').slice(0, 40);
  return `u-${local}@${EMAIL_DOMAIN}`;
}


/**
 * Hasło techniczne nowej bazy — wyprowadzone ze skrótu hasła, który urządzenie i tak przechowuje.
 * Dzięki temu konto przechodzi do nowej bazy samo, bez ponownego wpisywania hasła przez dziecko.
 */
export function secretFromHash(passwordHash: string): string {
  return `mt#h#${passwordHash}`;
}

function loginKey(login: string): string {
  return normalizeLogin(login).slice(0, 40);
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
    return 'Nieprawidłowy login lub hasło.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Za dużo prób logowania. Odczekaj chwilę i spróbuj ponownie.';
  }
  if (code === 'auth/network-request-failed' || code === 'unavailable') {
    return 'Brak połączenia z internetem.';
  }
  if (code === 'resource-exhausted') {
    return 'Baza wyników jest chwilowo przeciążona.';
  }
  if (code === 'permission-denied') {
    return 'Baza odrzuciła zapis (brak uprawnień) — zwykle pomaga odświeżenie aplikacji.';
  }
  if (code === 'deadline-exceeded' || code === 'cancelled' || code === 'aborted') {
    return 'Baza odpowiada zbyt wolno.';
  }
  if (code === 'auth/user-token-expired' || code === 'auth/user-disabled' || code === 'unauthenticated') {
    return 'Sesja konta wygasła — zaloguję ponownie.';
  }
  if (code === 'auth/internal-error' || code === 'internal') {
    return 'Chwilowy błąd serwera bazy.';
  }
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (/nie odpowiada/i.test(msg)) {
    return 'Baza nie odpowiada — sprawdź internet.';
  }
  if (!navigator.onLine) return 'Brak internetu na tym urządzeniu.';
  // Nasze własne, polskie komunikaty (np. „login zajęty”, „nie znaleziono grupy”) pokazujemy wprost.
  if (msg && !/firebase|firestore|\(auth\/|^[a-z-]+\/[a-z-]+$/i.test(msg)) return msg;
  return code ? `Nie udało się połączyć z bazą (kod: ${code}).` : 'Nie udało się połączyć z bazą.';
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

async function writeLoginDoc(db: Firestore, login: string, uid: string, profileId: string): Promise<void> {
  const ref = doc(db, 'logins', loginKey(login));
  const snap = await getDoc(ref).catch(() => null);
  const data = snap?.exists() ? snap.data() : null;
  if (data && data.uid === uid && data.profileId === profileId) return;
  await setDoc(ref, { uid, profileId, createdAt: serverTimestamp() });
}

/**
 * Konto w nowej bazie: zakłada je (pierwsze urządzenie) albo loguje (kolejne).
 * Nie potrzebuje hasła — wystarczy skrót hasła zapisany w profilu.
 */
export async function ensureAccount(
  profile: UserProfile
): Promise<{ uid: string; created: boolean; cloudProfile: UserProfile | null }> {
  if (!profile.passwordHash) throw new Error('Konto nie ma hasła.');
  const login = normalizeLogin(profile.login || profile.name);
  const { auth, db } = getHandle(login);
  const email = loginToEmail(login);
  const secret = secretFromHash(profile.passwordHash);

  if (auth.currentUser) {
    await auth.currentUser.getIdToken(true).catch(async () => {
      await signOut(auth).catch(() => {});
    });
  }
  if (!auth.currentUser) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, secret);
      await setDoc(doc(db, 'accounts', cred.user.uid), accountDocPayload(cred.user.uid, profile));
      await writeLoginDoc(db, login, cred.user.uid, profile.id);
      return { uid: cred.user.uid, created: true, cloudProfile: null };
    } catch (err) {
      if (errorCode(err) !== 'auth/email-already-in-use') throw err;
    }
    try {
      await signInWithEmailAndPassword(auth, email, secret);
    } catch (err) {
      const code = errorCode(err);
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/invalid-login-credentials') {
        const taken = new Error('Ten login jest już zajęty przez inne konto albo hasło zmieniono na innym urządzeniu. Wpisz hasło ponownie.');
        (taken as Error & { code?: string }).code = 'login-taken';
        throw taken;
      }
      throw err;
    }
  }
  const uid = auth.currentUser!.uid;
  const snap = await getDoc(doc(db, 'accounts', uid));
  void writeLoginDoc(db, login, uid, profile.id).catch(() => {});
  return { uid, created: false, cloudProfile: snap.exists() ? (snap.data().profile as UserProfile) : null };
}

/** Zgodność wsteczna: dawniej konto zakładano z hasłem w ręku. */
export async function registerOrSignInAccount(
  profile: UserProfile,
  _password?: string
): Promise<{ uid: string; created: boolean; cloudProfile: UserProfile | null }> {
  void _password;
  return ensureAccount(profile);
}

function invalidCredentials(): Error {
  const e = new Error('Nieprawidłowy login lub hasło.');
  (e as Error & { code?: string }).code = 'auth/invalid-credential';
  return e;
}

/**
 * Logowanie na nowym urządzeniu: login + hasło → profil z chmury.
 *  1) nowa baza (logins/{login} podaje identyfikator profilu potrzebny do skrótu hasła),
 *  2) jeśli konta tam jeszcze nie ma — odczyt ze starej bazy i przeniesienie do nowej.
 */
export async function signInAccountAndFetch(
  loginInput: string,
  password: string
): Promise<{ uid: string; profile: UserProfile | null; profileId: string; passwordHash: string }> {
  const login = normalizeLogin(loginInput);
  const { auth, db } = getHandle(login);
  const loginSnap = await getDoc(doc(db, 'logins', loginKey(login)));
  if (loginSnap.exists()) {
    const profileId = String(loginSnap.data().profileId ?? '');
    const passwordHash = hashAccountPassword(password, profileId);
    try {
      const cred = await signInWithEmailAndPassword(auth, loginToEmail(login), secretFromHash(passwordHash));
      const snap = await getDoc(doc(db, 'accounts', cred.user.uid));
      return {
        uid: cred.user.uid,
        profile: snap.exists() ? (snap.data().profile as UserProfile) : null,
        profileId,
        passwordHash,
      };
    } catch (err) {
      const code = errorCode(err);
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/invalid-login-credentials') {
        throw invalidCredentials();
      }
      throw err;
    }
  }

  // Brak loginu w bazie. (Stara baza AI Studio została wyłączona po migracji wszystkich kont.)
  throw invalidCredentials();
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

export async function changeAccountPassword(login: string, newPasswordHash: string): Promise<void> {
  const { auth } = getHandle(login);
  if (!auth.currentUser) return;
  await updatePassword(auth.currentUser, secretFromHash(newPasswordHash));
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
  const codeSnap = await getDoc(doc(db, 'circleCodes', code)); // błąd sieci/uprawnień → czytelny komunikat wyżej
  if (!codeSnap.exists()) {
    throw new Error(`Nie znaleziono grupy o kodzie ${code}. Sprawdź, czy kod jest przepisany dokładnie.`);
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

/**
 * Przeniesienie grupy do nowej bazy: pierwsza osoba odtwarza ją z tym samym kodem
 * (i zostaje właścicielem), kolejne po prostu do niej dołączają.
 */
export async function ensureCircleMembership(login: string, circle: CircleMembership): Promise<CircleMembership | null> {
  const { uid, db } = requireAccount(login);
  const code = circle.code;
  if (!code || !/^[A-Z0-9-]{4,16}$/.test(code) || !/^[a-zA-Z0-9_-]{1,128}$/.test(circle.id)) return null;
  const memberRef = doc(db, 'circles', circle.id, 'members', uid);
  const already = await getDoc(memberRef).catch(() => null);
  if (already?.exists()) {
    // Właściciel mógł zmienić kod grupy — pokaż aktualny.
    const cur = await getDoc(doc(db, 'circles', circle.id)).catch(() => null);
    const fresh = cur?.exists() ? String(cur.data().joinCode ?? '') : '';
    return fresh && fresh !== code ? { ...circle, code: fresh } : null;
  }
  const codeSnap = await getDoc(doc(db, 'circleCodes', code));
  if (codeSnap.exists()) {
    if (String(codeSnap.data().circleId) !== circle.id) return null;
    await setDoc(memberRef, { uid, joinCode: code, joinedAt: serverTimestamp() });
    return null;
  }
  const batch = writeBatch(db);
  batch.set(doc(db, 'circles', circle.id), {
    name: circle.name.trim().slice(0, 40) || 'Grupa',
    ownerUid: uid,
    joinCode: code,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'circleCodes', code), { circleId: circle.id, createdAt: serverTimestamp() });
  batch.set(memberRef, { uid, joinCode: code, joinedAt: serverTimestamp() });
  try {
    await batch.commit();
    return { ...circle, owner: true };
  } catch {
    // Ktoś odtworzył grupę w tej samej chwili — dołącz zwyczajnie.
    await setDoc(memberRef, { uid, joinCode: code, joinedAt: serverTimestamp() }).catch(() => {});
    return null;
  }
}

/** Nowy kod zaproszenia (np. gdy stary trafił w niepowołane ręce). Stary kod przestaje działać; członkowie zostają. */
export async function rotateCircleCode(login: string, circle: CircleMembership): Promise<string> {
  const { db } = requireAccount(login);
  const newCode = `G-${randomCode(5)}`;
  const batch = writeBatch(db);
  batch.update(doc(db, 'circles', circle.id), { joinCode: newCode });
  batch.set(doc(db, 'circleCodes', newCode), { circleId: circle.id, createdAt: serverTimestamp() });
  batch.delete(doc(db, 'circleCodes', circle.code));
  await batch.commit();
  return newCode;
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
  // Konto w weryfikacji: wyniki znikają z rankingów grup do decyzji opiekuna.
  const held = profile.review?.state === 'pending' || profile.review?.state === 'suspended';
  await Promise.all(
    circles.map((c) =>
      c.share && !held
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
          recentSeries: Array.isArray(data.recentSeries) ? data.recentSeries : undefined,
          updatedAtMs: Number(data.updatedAtMs ?? 0),
        });
      });
      onPlayers(players);
    },
    (err) => onError?.(err)
  );
}

/* ------------------------------ Dziennik logowań ------------------------------ */

/** Zapisuje próbę logowania (bez hasła) — widoczne tylko w panelu administratora. */
export async function logLoginEvent(loginInput: string, ok: boolean, reason: string): Promise<void> {
  try {
    const { db } = getHandle('__events');
    const ua = navigator.userAgent;
    const device = /iPad/.test(ua)
      ? 'iPad'
      : /iPhone/.test(ua)
      ? 'iPhone'
      : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
      ? 'Mac'
      : /Windows/.test(ua)
      ? 'Windows'
      : 'inne';
    await addDoc(collection(db, 'loginEvents'), {
      login: loginInput.trim().slice(0, 40),
      ok,
      reason: reason.slice(0, 60),
      device,
      at: serverTimestamp(),
    });
  } catch {
    // dziennik nie może blokować logowania
  }
}

/* ------------------------------ Uczciwa gra (weryfikacja kont) ------------------------------ */

export type ReviewState = 'watch' | 'pending' | 'suspended' | 'cleared';

export interface ReviewEvent {
  /** Kod powodu (integrity.ts → REASON_LABELS). */
  k: string;
  /** Kiedy (ms). */
  at: number;
  /** Krótki opis, np. „mediana 380 ms, 20 zadań, 100%”. */
  d: string;
}

export interface AccountReview {
  state: ReviewState;
  trusted: boolean;
}

function isTestEnvironment(): boolean {
  try {
    if (import.meta.env?.DEV) return true;
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  } catch {
    return false;
  }
}

/** Stan weryfikacji konta (1 odczyt). null = brak wpisu (wszystko w porządku). */
export async function fetchAccountReview(login: string): Promise<AccountReview | null> {
  const { auth, db } = getHandle(normalizeLogin(login));
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'reviews', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { state: (d.state as ReviewState) ?? 'watch', trusted: d.trusted === true };
}

/**
 * Czy to konto gracza należy do właściciela aplikacji (wtedy w Koncie jest skrót do panelu administratora).
 * Znacznik ownerAccounts/{uid} ustawia tylko administrator w panelu (1 odczyt).
 */
export async function fetchIsOwnerAccount(login: string): Promise<boolean> {
  const { auth, db } = getHandle(normalizeLogin(login));
  const uid = (auth.currentUser ?? (await waitForAuthReady(auth)))?.uid;
  if (!uid) return false;
  const snap = await getDoc(doc(db, 'ownerAccounts', uid));
  return snap.exists();
}

/**
 * Zgłoszenie do weryfikacji. „pending” wstrzymuje udział w rankingach do decyzji opiekuna,
 * „watch” to tylko wpis dla administratora. Nigdy nie obniża stanu (pending → watch)
 * i nic nie robi dla kont oznaczonych przez opiekuna jako zaufane.
 */
export async function reportAccountReview(
  login: string,
  level: 'watch' | 'pending',
  events: ReviewEvent[]
): Promise<AccountReview | null> {
  if (isTestEnvironment()) return null;
  const norm = normalizeLogin(login);
  const { auth, db } = getHandle(norm);
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const ref = doc(db, 'reviews', uid);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? snap.data() : null;
  if (prev?.trusted === true || prev?.state === 'suspended') {
    return { state: (prev.state as ReviewState) ?? 'cleared', trusted: prev.trusted === true };
  }
  const state: ReviewState = prev?.state === 'pending' ? 'pending' : level;
  const oldEvents = Array.isArray(prev?.events) ? (prev!.events as ReviewEvent[]) : [];
  const merged = [...oldEvents, ...events]
    .map((e) => ({ k: String(e.k).slice(0, 20), at: Number(e.at) || 0, d: String(e.d ?? '').slice(0, 120) }))
    .slice(-20);
  let device = '';
  try {
    device = (window.localStorage.getItem('mt_device_id') ?? '').slice(0, 40);
  } catch {
    device = '';
  }
  if (prev) {
    await setDoc(ref, { state, events: merged, device, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await setDoc(ref, {
      uid,
      login: norm.slice(0, 40),
      state,
      events: merged,
      trusted: false,
      device,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return { state, trusted: false };
}

/* ------------------------------ Pełna historia serii ------------------------------ */

/** Wysyła paczkę skrótów serii: jeden zapis na każdy miesiąc w paczce (zwykle 1). */
export async function pushHistory(login: string, items: SessionLite[]): Promise<boolean> {
  if (items.length === 0) return true;
  const { auth, db } = getHandle(normalizeLogin(login));
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const batch = writeBatch(db);
  for (const [month, list] of groupByMonth(items)) {
    batch.set(
      doc(db, 'accounts', uid, 'history', month),
      { items: arrayUnion(...list.map((s) => stripUndefinedDeep(s))), updatedAt: serverTimestamp() },
      { merge: true }
    );
  }
  await batch.commit();
  return true;
}

/** Cała historia z chmury (nowe urządzenie): 1 odczyt na miesiąc gry. */
export async function fetchHistory(login: string): Promise<SessionLite[] | null> {
  const { auth, db } = getHandle(normalizeLogin(login));
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snap = await getDocs(collection(db, 'accounts', uid, 'history'));
  const out: SessionLite[] = [];
  snap.forEach((d) => {
    const items = d.data().items;
    if (Array.isArray(items)) out.push(...(items as SessionLite[]));
  });
  return out;
}

/* ------------------------------ Usunięcie konta (RODO) ------------------------------ */

/**
 * Trwale usuwa konto gracza z chmury: historię serii, karty i członkostwo w grupach, profil,
 * login i konto logowania. Wymaga skrótu hasła (ponowne zalogowanie przed usunięciem).
 * Zapis weryfikacji „uczciwej gry” (jeśli był) zostaje u opiekuna do 12 miesięcy.
 */
export async function deleteAccountEverywhere(profile: UserProfile): Promise<void> {
  if (!profile.passwordHash) throw new Error('Konto nie ma hasła — nie ma czego usuwać w chmurze.');
  const login = normalizeLogin(profile.login || profile.name);
  const { auth, db } = getHandle(login);
  const cred = await signInWithEmailAndPassword(auth, loginToEmail(login), secretFromHash(profile.passwordHash));
  const uid = cred.user.uid;
  const hist = await getDocs(collection(db, 'accounts', uid, 'history')).catch(() => null);
  await Promise.all((hist?.docs ?? []).map((d) => deleteDoc(d.ref).catch(() => {})));
  for (const c of profile.circles ?? []) {
    await deleteDoc(doc(db, 'circles', c.id, 'players', uid)).catch(() => {});
    await deleteDoc(doc(db, 'circles', c.id, 'members', uid)).catch(() => {});
  }
  await deleteDoc(doc(db, 'accounts', uid));
  await deleteDoc(doc(db, 'logins', loginKey(login))).catch(() => {});
  await deleteUser(cred.user);
}
