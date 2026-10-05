/* Service worker: red primero, cache como respaldo para usar el plan sin conexión. */
var CACHE = "gradiente-37";
var SHELL = ["./", "index.html", "config.js", "assets/app.css", "assets/app.js", "assets/auth.js", "assets/intro.js", "data/planes.json", "data/nube.json", "data/faq.json", "data/catedras.json", "data/fechas.json", "data/instagram.json", "data/formulas.json", "data/elementos.json", "data/links.json", "data/kiosco.json", "manifest.webmanifest", "assets/icon.svg", "assets/favicon.svg", "assets/logo-gradiente-azul.png", "assets/logo-gradiente-blanco.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === location.origin;
  var isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (m) { return m || caches.match("index.html"); });
    })
  );
});
