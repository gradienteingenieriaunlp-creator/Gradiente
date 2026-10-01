/* La app se mudó de /v2/ a la raíz. Este service worker solo existe para darse de baja
   en los celus que la instalaron desde /v2/: borra su cache y manda a la página nueva.
   Se puede borrar (junto con la carpeta v2/) cuando ya nadie entre por /v2/. */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return /^gradiente-v2-/.test(k); }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: "window" }); })
      .then(function (list) { list.forEach(function (c) { c.navigate("/"); }); })
  );
});
