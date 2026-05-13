const CACHE="dh-v2";const STATIC=["/","/index.html","/narrative.js"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(STATIC);}));});
self.addEventListener("fetch",function(e){if(e.request.method!=="GET")return;e.respondWith(fetch(e.request).catch(function(){return caches.match(e.request);}));});