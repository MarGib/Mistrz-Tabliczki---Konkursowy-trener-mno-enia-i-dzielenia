/* Mistrz Tabliczki — service worker.
   Zainstalowana aplikacja działa w całości z urządzenia (także bez internetu):
   przy instalacji pobieramy wszystkie pliki aplikacji, a potem czytamy je z pamięci urządzenia.
   Dane (Firebase) nie są tu buforowane — zapisy czekają w kolejce bazy na urządzeniu i wysyłają się same. */
const PREFIX = 'mt-app-';
let CACHE = PREFIX + 'boot';

async function loadManifest() {
  const res = await fetch('./precache.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('brak precache.json');
  return res.json();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const m = await loadManifest();
        CACHE = PREFIX + m.version;
        const c = await caches.open(CACHE);
        // Rdzeń aplikacji (kod, style, czcionki, ikony) — musi się udać, by działać offline.
        await c.addAll(['./', ...m.core.map((f) => './' + f)]);
        await c.put('./precache.json', new Response(JSON.stringify(m)));
      } catch {
        // Bez sieci przy instalacji — zostajemy przy poprzedniej wersji.
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      let m = null;
      try {
        m = await loadManifest();
        CACHE = PREFIX + m.version;
      } catch {
        // offline — zostawiamy wszystko jak jest
      }
      const keys = await caches.keys();
      if (m && (await caches.has(CACHE))) {
        await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      }
      await self.clients.claim();
      // Obrazki i zrzuty pomocy dociągamy w tle, po kolei, bez blokowania aplikacji.
      if (m) {
        const c = await caches.open(CACHE);
        for (const f of m.extra) {
          const url = './' + f;
          if (await c.match(url)) continue;
          try {
            const res = await fetch(url);
            if (res.ok) await c.put(url, res);
          } catch {
            break; // brak sieci — dokończymy przy kolejnym uruchomieniu
          }
        }
      }
    })()
  );
});

async function currentCache() {
  const keys = (await caches.keys()).filter((k) => k.startsWith(PREFIX));
  return caches.open(keys.includes(CACHE) ? CACHE : keys[keys.length - 1] || CACHE);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // baza i logowanie — zawsze prosto do sieci
  if (url.pathname.endsWith('/precache.json')) return;
  // Sprawdzanie nowej wersji (cache: no-store) — zawsze prosto do sieci.
  if (req.cache === 'no-store') return;

  // Strona startowa: świeża wersja z sieci, a bez internetu (albo gdy sieć się wlecze) — z urządzenia.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const c = await currentCache();
        const cached = (await c.match('./index.html')) || (await c.match('./'));
        const network = fetch(req, { cache: 'no-store' }).then((res) => {
          if (res.ok) c.put('./index.html', res.clone());
          return res;
        });
        if (!cached) return network;
        // Słaby internet: po 3 s pokazujemy wersję z urządzenia (nowa wczyta się następnym razem).
        const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), 3000));
        return Promise.race([network.catch(() => cached), timeout]);
      })()
    );
    return;
  }

  // Pliki aplikacji (z hashem w nazwie), czcionki, obrazki: najpierw z urządzenia.
  event.respondWith(
    (async () => {
      const c = await currentCache();
      const cached = await c.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      } catch {
        return new Response('', { status: 504, statusText: 'offline' });
      }
    })()
  );
});
