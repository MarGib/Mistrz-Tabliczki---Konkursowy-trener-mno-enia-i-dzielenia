import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, type Plugin} from 'vite';

/**
 * Po zbudowaniu zapisuje listę wszystkich plików aplikacji (precache.json).
 * Service worker pobiera je przy instalacji, więc zainstalowana aplikacja działa w całości bez internetu.
 */
/** Wersja aplikacji (jedna na build) — widoczna w panelu administratora, by sprawdzić, kto ma starą wersję. */
const APP_VERSION = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Warsaw' }).slice(0, 16);
const CACHE_VERSION = Date.now().toString(36);

function precacheManifest(): Plugin {
  return {
    name: 'mt-precache-manifest',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist');
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          if (fs.statSync(full).isDirectory()) walk(full);
          else files.push(path.relative(dist, full).split(path.sep).join('/'));
        }
      };
      walk(dist);
      const skip = /(^sw\.js$|^precache\.json$|\.map$|\.woff$|^assets\/aistudio)/;
      const list = files.filter((f) => !skip.test(f)).sort();
      // Najpierw to, co potrzebne do uruchomienia; obrazki i zrzuty pomocy — w drugiej kolejności.
      const core = list.filter((f) => /\.(js|css|html|webmanifest|woff2)$/.test(f) || /^icon-|^apple-touch|^favicon/.test(f));
      const extra = list.filter((f) => !core.includes(f));
      const size = (f: string) => fs.statSync(path.join(dist, f)).size;
      const coreBytes = core.reduce((a, f) => a + size(f), 0);
      const totalBytes = list.reduce((a, f) => a + size(f), 0);
      fs.writeFileSync(
        path.join(dist, 'precache.json'),
        JSON.stringify({ version: CACHE_VERSION, appVersion: APP_VERSION, coreBytes, totalBytes, core, extra })
      );
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), precacheManifest()],
    define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
