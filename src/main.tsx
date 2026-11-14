import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { HelpProvider } from './help/HelpContext';
import { HelpShots } from './help/HelpShots';

const isShots = window.location.search.includes('__shots');

createRoot(document.getElementById('root')!).render(
  <HelpProvider>{isShots ? <HelpShots /> : <App />}</HelpProvider>
);
