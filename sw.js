// Rilievi Serramenti: tiene l'app sul telefono per usarla senza internet.
// La riga VERSIONE viene aggiornata da strumenti/versione.py a ogni modifica.
const VERSIONE = 'rs-5cff24bda2';
const FILE = ['./', 'index.html', 'app.css', 'db.js', 'disegno.js', 'pdf.js', 'tastierino.js', 'lavagna.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSIONE)
      .then(c => c.addAll(FILE.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== VERSIONE).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

// Prima la copia salvata sul telefono (istantanea e senza internet); la rete solo se manca.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSIONE);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const pagina = await c.match('./') || await c.match('index.html');
      if (pagina) return pagina;
    }
    return fetch(req);
  })());
});
