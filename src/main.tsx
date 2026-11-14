// Czcionki wbudowane w aplikację — działają bez internetu (zamiast Google Fonts).
import '@fontsource/outfit/latin-500.css';
import '@fontsource/outfit/latin-ext-500.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-ext-600.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/outfit/latin-ext-700.css';
import '@fontsource/outfit/latin-800.css';
import '@fontsource/outfit/latin-ext-800.css';
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-ext-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-ext-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-ext-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-ext-700.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-ext-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-ext-700.css';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './pwa';
import { startAutoUpdate } from './autoUpdate';
import { HelpProvider } from './help/HelpContext';
import { HelpShots } from './help/HelpShots';

const isShots = window.location.search.includes('__shots');

createRoot(document.getElementById('root')!).render(
  <HelpProvider>{isShots ? <HelpShots /> : <App />}</HelpProvider>
);

// Aplikacja instalowalna na telefonie (PWA): rejestracja service workera tylko w wersji produkcyjnej.
if ('serviceWorker' in navigator && import.meta.env.PROD && !isShots) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}

if (!isShots) startAutoUpdate();
