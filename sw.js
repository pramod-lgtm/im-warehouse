// Caches the static app shell; API calls (script.google.com) are never cached here.
// Cache-first for same-origin GETs so Meri queue / shell open fast on repeat visits; network updates the cache in the background.
const C='im-warehouse-v31',F=['./','index.html','app.js','config.js','manifest.webmanifest','favicon-32.png','icon-192.png','icon-512.png','apple-touch-icon.png','maskable-512.png','Billing_Import_Template.xlsx'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(cached=>{
  const net=fetch(e.request).then(r=>{if(r&&r.ok){const c=r.clone();caches.open(C).then(x=>x.put(e.request,c));}return r;}).catch(()=>cached);
  return cached||net;
}))});
