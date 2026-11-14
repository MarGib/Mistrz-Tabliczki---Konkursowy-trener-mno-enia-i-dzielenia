import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, type Plugin} from 'vite';

/**
 * Po zbudowaniu zapisuje listę wszystkich plików aplikacji (precache.json).
 * Service worker pobiera je przy instalacji, więc zainstalowana aplikacja działa w całości bez internetu.
 */
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
      const version = Date.now().toString(36);
      fs.writeFileSync(path.join(dist, 'precache.json'), JSON.stringify({ version, core, extra }));
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), precacheManifest()],
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
