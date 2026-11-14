/**
 * Firebase App Check — baza przyjmuje zapytania tylko z prawdziwej aplikacji (nie ze skryptów
 * i robotów, które znają publiczny klucz projektu). Chroni darmowy limit bazy przed zalaniem zapytaniami.
 *
 * Włączenie (raz, ok. 5 minut — instrukcja w RELEASING.md, sekcja „Uczciwa gra i ochrona bazy”):
 *  1. klucz reCAPTCHA v3 dla domeny margib.github.io → wpisz klucz WITRYNY poniżej (jest publiczny),
 *  2. Firebase → App Check → zarejestruj aplikację z kluczem TAJNYM (wpisuje go właściciel, nie kod),
 *  3. po kilku dniach obserwacji w App Check → „Wymuszaj” dla Firestore.
 * Pusty klucz = App Check wyłączony (aplikacja działa jak dotąd).
 */
import type { FirebaseApp } from 'firebase/app';
import { ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';

export const RECAPTCHA_SITE_KEY = '';

const done = new WeakSet<FirebaseApp>();

export function protectApp(app: FirebaseApp): void {
  if (!RECAPTCHA_SITE_KEY || done.has(app)) return;
  try {
    if (import.meta.env?.DEV) return;
    if (!/github\.io$/.test(window.location.hostname)) return;
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
    done.add(app);
  } catch {
    // App Check nie może zablokować gry — w najgorszym razie baza odrzuci zapis, a wyniki zostaną na urządzeniu
  }
}
