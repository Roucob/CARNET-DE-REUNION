/* Service worker du Carnet de réunions : l'appli fonctionne entièrement hors connexion.
   Mise à jour de l'appli : modifie index.html puis change VERSION.
   Mise à jour des programmes : remplace simplement semaines.json (récupéré automatiquement quand il y a Internet). */
const VERSION = 'carnet-v3.0.1';
const FILES = ['./', './index.html', './semaines.json', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];
// lecteurs PDF et Word : gardés en cache pour importer des plans hors connexion
const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    await c.addAll(FILES);
    await Promise.all(LIBS.map(u => c.add(new Request(u, {mode: 'cors'})).catch(() => {}))); // facultatif
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const putCache = (req, res) => { if (res && res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; };

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === 'https://cdnjs.cloudflare.com'){
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => putCache(req, res))));
    return;
  }
  if (url.origin !== location.origin) return; // liens jw.org : laissés au navigateur
  // Programmes : version en ligne si possible, sinon la dernière gardée
  if (url.pathname.endsWith('/semaines.json')){
    e.respondWith(fetch(req).then(res => putCache('./semaines.json', res)).catch(() => caches.match('./semaines.json')));
    return;
  }
  // Ouverture de l'appli : réponse immédiate depuis le cache, mise à jour en arrière-plan
  if (req.mode === 'navigate'){
    e.respondWith(caches.open(VERSION).then(async c => {
      const cached = await c.match('./index.html');
      const fresh = fetch(req).then(r => { if (r.ok) c.put('./index.html', r.clone()); return r; }).catch(() => null);
      return cached || (await fresh) || new Response('Hors connexion', {status: 503});
    }));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => putCache(req, res))));
});
