import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig &&
      typeof firebaseConfig.apiKey === 'string' &&
      firebaseConfig.apiKey.length > 0 &&
      typeof firebaseConfig.projectId === 'string' &&
      firebaseConfig.projectId.length > 0 &&
      firebaseConfig.projectId !== 'remixed-project-id'
  );
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function formatFirebaseError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  const combined = `${code} ${raw}`.toLowerCase();
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  if (combined.includes('auth/unauthorized-domain')) {
    return `Domena "${host || 'ta strona'}" nie jest dodana w Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (combined.includes('auth/popup-blocked')) {
    return 'Przeglądarka zablokowała okno logowania Google. Zezwól na wyskakujące okna dla tej strony i spróbuj ponownie.';
  }
  if (
    combined.includes('auth/popup-closed-by-user') ||
    combined.includes('auth/cancelled-popup-request')
  ) {
    return 'Okno logowania Google zostało zamknięte przed zakończeniem.';
  }
  if (combined.includes('auth/operation-not-allowed')) {
    return 'Logowanie Google nie jest jeszcze włączone w Firebase Authentication dla tego projektu.';
  }
  if (
    combined.includes('auth/network-request-failed') ||
    combined.includes('the client is offline')
  ) {
    return 'Brak połączenia z siecią. Twoje lokalne wyniki i hasło są bezpieczne — zsynchronizują się po powrocie internetu.';
  }
  if (
    combined.includes('permission-denied') ||
    combined.includes('missing or insufficient permissions')
  ) {
    return 'Brak uprawnień Firestore — sprawdź, czy reguły firestore.rules zostały wdrożone do projektu Firebase i konto Google jest zweryfikowane.';
  }
  if (combined.includes('quota exceeded')) {
    return 'Przekroczono dzienny darmowy limit odczytów Firestore. Lokalne wyniki działają dalej bez przeszkód.';
  }
  if (raw.startsWith('{') && raw.includes('"operationType"')) {
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed.error) return formatFirebaseError(new Error(parsed.error));
    } catch {
      // ignore JSON parse failure
    }
  }
  return raw || 'Wystąpił błąd połączenia z bazą Firebase.';
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  if (typeof window === 'undefined' || !isFirebaseConfigured()) return;
  try {
    // Query a permitted non-PII document path to validate server connectivity cleanly
    await getDocFromServer(doc(db, 'schoolDirectory', 'global'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
