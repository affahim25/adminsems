const CACHE_NAME = "admin-dashboard-shell-v1";
const SHELL_FILES = [
  "login.html", "register.html", "dashboard.html", "css/style.css",
  "js/firebase-config.js", "js/auth-guard.js", "js/layout.js", "js/audit.js",
  "manifest.json"
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
