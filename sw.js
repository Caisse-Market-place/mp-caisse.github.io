// Service worker : permet à la caisse de démarrer sans Internet.
// Les VENTES ne passent jamais ici : elles restent sur l'appareil (localStorage + IndexedDB).
// Changer CACHE à chaque nouvelle version publiée.
var CACHE = 'caisse-mp-v5';
var FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
var NET_TIMEOUT = 3000;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function isAppPage(url) {
  var scope = new URL(self.registration.scope);
  var path = url.pathname;
  return url.origin === scope.origin && (path === scope.pathname || path === scope.pathname + 'index.html');
}
// Ne garde en copie hors ligne qu'une VRAIE page de la caisse (pas une erreur 404/500, pas un autre fichier)
function cacheable(res) {
  return res && res.ok && res.type === 'basic' && (res.headers.get('content-type') || '').indexOf('text/html') >= 0;
}
function withTimeout(p, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
    p.then(function (r) { clearTimeout(t); resolve(r); }, function (err) { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    if (!isAppPage(url)) return; // autres adresses : comportement normal du navigateur
    // Page : réseau d'abord (3 s max) pour recevoir les mises à jour, sinon la copie hors ligne
    e.respondWith(withTimeout(fetch(req), NET_TIMEOUT).then(function (res) {
      if (cacheable(res)) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('./index.html', copy); }); return res; }
      return caches.match('./index.html').then(function (hit) { return hit || res; });
    }).catch(function () { return caches.match('./index.html'); }));
    return;
  }
  // Autres fichiers : copie locale d'abord
  e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req); }));
});
