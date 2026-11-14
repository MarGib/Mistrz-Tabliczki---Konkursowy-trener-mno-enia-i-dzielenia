/** Czytelne komunikaty błędów Firebase. (Dawna baza AI Studio usunięta 14.11.2026 — konta są w accountCloud.ts.) */
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
