// Service Worker do Virla — PWA instalável.
//
// Estratégia deliberadamente conservadora: este é um app com dados em tempo
// real (chat via Firebase, pagamentos PIX, solicitações) — cachear agressivo
// demais faria o usuário ver dados desatualizados. Por isso:
//
//  - Assets estáticos (JS/CSS/ícones/imagens) → cache-first (mudam só quando
//    o app é atualizado, e o versionamento do nome do cache invalida sozinho).
//  - Chamadas de API (/auth, /users, /messages, /payments, /solicitacoes...)
//    → NUNCA cacheadas; sempre vão direto pra rede.
//  - Navegação (rotas do SPA) → network-first com fallback pro cache, pra
//    funcionar minimamente offline mas sempre preferir a versão mais nova.

const CACHE_VERSION = 'virla-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`

const PRECACHE_URLS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('virla-') && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isApiRequest(url) {
  // Ajuste esta lista se novos prefixos de rota forem adicionados no backend.
  const apiPrefixes = [
    '/auth', '/users', '/messages', '/payments', '/solicitacoes',
    '/firebase', '/conversations', '/health', '/metrics', '/escrow',
  ]
  return apiPrefixes.some((prefix) => url.pathname.startsWith(prefix))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // nunca interceptar POST/PUT/PATCH/DELETE

  const url = new URL(request.url)

  // Requisições para o backend (outra origem, ex.: api.virla.com) — nunca cachear.
  if (url.origin !== self.location.origin || isApiRequest(url)) {
    return
  }

  // Navegação entre rotas do SPA: network-first, cai pro cache se offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Assets estáticos: cache-first, atualiza o cache em segundo plano.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)

      return cached || networkFetch
    }),
  )
})
