import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
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
