/**
 * Panel administratora (rodzica): podgląd kont, dziennik logowań i reset haseł.
 *
 * Administrator loguje się kontem Google, które jest właścicielem projektu Firebase.
 * Reset hasła odbywa się przez oficjalne API Firebase Authentication (Identity Toolkit),
 * autoryzowane tokenem Google właściciela — bez serwera i bez opłat.
 * Uprawnienia do odczytu danych daje dokument admins/{uid} w bazie.
 */
import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  type Firestore,
  type Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-accounts-config.json';
import type { UserProfile } from '../types/math';
import { hashAccountPassword } from './accountSecurity';
import { secretFromHash } from './accountCloud';

const ADMIN_FLAG = 'mt_admin_device';

interface AdminHandle {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let handle: AdminHandle | null = null;
let accessToken: string | null = null;
let accessTokenAt = 0;

function getAdminHandle(): AdminHandle {
  if (handle) return handle;
  const name = 'admin-panel';
  const app = getApps().some((a) => a.name === name) ? getApp(name) : initializeApp(firebaseConfig, name);
  handle = { app, auth: getAuth(app), db: getFirestore(app) };
  return handle;
}

export interface AdminSession {
  uid: string;
  email: string;
  isAdmin: boolean;
}

export function isAdminDevice(): boolean {
  try {
    return window.localStorage.getItem(ADMIN_FLAG) === '1';
  } catch {
    return false;
  }
}

async function checkAdmin(uid: string): Promise<boolean> {
  const { db } = getAdminHandle();
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

/** Sesja z poprzedniego razu (bez tokenu do resetu haseł — ten trzeba odświeżyć logowaniem). */
export async function restoreAdminSession(): Promise<AdminSession | null> {
  const { auth } = getAdminHandle();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  const isAdmin = await checkAdmin(user.uid);
  return { uid: user.uid, email: user.email ?? '', isAdmin };
}

export async function adminSignIn(): Promise<AdminSession> {
  const { auth } = getAdminHandle();
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/identitytoolkit');
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const cred = GoogleAuthProvider.credentialFromResult(result);
  accessToken = cred?.accessToken ?? null;
  accessTokenAt = Date.now();
  const isAdmin = await checkAdmin(result.user.uid);
  if (isAdmin) {
    try {
      window.localStorage.setItem(ADMIN_FLAG, '1');
    } catch {
      // ignore
    }
  }
  return { uid: result.user.uid, email: result.user.email ?? '', isAdmin };
}

export async function adminSignOut(): Promise<void> {
  accessToken = null;
  await signOut(getAdminHandle().auth).catch(() => {});
}

/** Token Google do resetu haseł jest ważny ok. godzinę. */
export function hasFreshAdminToken(): boolean {
  return Boolean(accessToken) && Date.now() - accessTokenAt < 50 * 60_000;
}

export interface AdminAccountRow {
  login: string;
  uid: string;
  profileId: string;
  name: string;
  xp: number;
  sessions: number;
  lastActiveDate: string;
  updatedAtMs: number;
  groups: string[];
}

export async function listAccounts(): Promise<AdminAccountRow[]> {
  const { db } = getAdminHandle();
  const [loginsSnap, accountsSnap] = await Promise.all([
    getDocs(collection(db, 'logins')),
    getDocs(collection(db, 'accounts')),
  ]);
  const accounts = new Map<string, { profile?: UserProfile; updatedAt?: Timestamp }>();
  accountsSnap.forEach((d) => accounts.set(d.id, d.data() as { profile?: UserProfile; updatedAt?: Timestamp }));
  const rows: AdminAccountRow[] = [];
  loginsSnap.forEach((d) => {
    const data = d.data() as { uid?: string; profileId?: string };
    const uid = String(data.uid ?? '');
    const acc = accounts.get(uid);
    const p = acc?.profile;
    rows.push({
      login: d.id,
      uid,
      profileId: String(data.profileId ?? ''),
      name: p?.name ?? d.id,
      xp: Number(p?.xp ?? 0),
      sessions: Array.isArray(p?.sessions) ? p!.sessions.length : 0,
      lastActiveDate: String(p?.lastActiveDate ?? ''),
      updatedAtMs: acc?.updatedAt?.toMillis?.() ?? 0,
      groups: (p?.circles ?? []).map((c) => `${c.name} (${c.code})`),
    });
  });
  return rows.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export interface LoginEventRow {
  id: string;
  login: string;
  ok: boolean;
  reason: string;
  device: string;
  atMs: number;
}

export async function listLoginEvents(max = 100): Promise<LoginEventRow[]> {
  const { db } = getAdminHandle();
  const snap = await getDocs(query(collection(db, 'loginEvents'), orderBy('at', 'desc'), limit(max)));
  return snap.docs.map((d) => {
    const data = d.data() as { login?: string; ok?: boolean; reason?: string; device?: string; at?: Timestamp };
    return {
      id: d.id,
      login: String(data.login ?? ''),
      ok: Boolean(data.ok),
      reason: String(data.reason ?? ''),
      device: String(data.device ?? ''),
      atMs: data.at?.toMillis?.() ?? 0,
    };
  });
}

export async function clearLoginEvents(ids: string[]): Promise<void> {
  const { db } = getAdminHandle();
  await Promise.all(ids.map((id) => deleteDoc(doc(db, 'loginEvents', id)).catch(() => {})));
}

/**
 * Ustawia nowe hasło konta. Dziecko loguje się potem nowym hasłem na dowolnym urządzeniu;
 * na urządzeniach, gdzie było zalogowane, poproszone zostanie o nowe hasło.
 */
export async function adminResetPassword(row: AdminAccountRow, newPassword: string): Promise<void> {
  const pwd = newPassword.trim();
  if (pwd.length < 4) throw new Error('Nowe hasło lub PIN musi mieć co najmniej 4 znaki.');
  if (!row.uid || !row.profileId) throw new Error('Brak danych konta.');
  if (!hasFreshAdminToken()) {
    throw new Error('Zaloguj się ponownie przez Google (przycisk na górze), aby resetować hasła.');
  }
  const secret = secretFromHash(hashAccountPassword(pwd, row.profileId));
  const projectId = firebaseConfig.projectId;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Goog-User-Project': projectId,
      },
      body: JSON.stringify({ localId: row.uid, password: secret }),
    }
  );
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body.error?.message ?? '';
    } catch {
      // ignore
    }
    if (res.status === 401) {
      accessToken = null;
      throw new Error('Sesja Google wygasła — zaloguj się ponownie i powtórz.');
    }
    if (res.status === 403) {
      throw new Error(`Konto Google nie ma uprawnień do projektu (${detail || 'brak dostępu'}).`);
    }
    throw new Error(`Nie udało się zmienić hasła (${detail || res.status}).`);
  }
}
