/** Wspólny stan instalacji PWA — zdarzenie przeglądarki łapiemy od razu po starcie strony. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

export function onInstallPromptChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function runInstallPrompt(): Promise<boolean> {
  if (!deferred) return false;
  const ev = deferred;
  await ev.prompt();
  const choice = await ev.userChoice.catch(() => null);
  deferred = null;
  notify();
  return choice?.outcome === 'accepted';
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS przedstawia się jako Mac — rozpoznajemy go po ekranie dotykowym.
    ((navigator.platform === 'MacIntel' || /Macintosh/.test(navigator.userAgent)) && navigator.maxTouchPoints > 1)
  );
}

export type InstallPlatform =
  | 'prompt' // przeglądarka sama pokaże okno instalacji (Chrome/Edge/Samsung na Androidzie i komputerze)
  | 'ios-safari'
  | 'ios-other' // Chrome/Firefox/Edge na iPhonie/iPadzie — też przez „Udostępnij”
  | 'in-app' // przeglądarka wbudowana w Messengera/Facebooka/Instagram — trzeba otworzyć w Safari/Chrome
  | 'android-menu' // Android bez okna instalacji — przez menu ⋮
  | 'none';

export function detectInstallPlatform(hasPrompt: boolean): InstallPlatform {
  if (isStandalone()) return 'none';
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|MicroMessenger|; wv\)/i.test(ua)) return 'in-app';
  if (hasPrompt) return 'prompt';
  if (isIos()) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) return 'android-menu';
  return 'none';
}
