import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import AppShell from './AppShell'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  </StrictMode>,
)

// PWA: o service worker SÓ é registrado em produção (build).
//
// Em desenvolvimento ele é proibido de propósito: o SW cacheia os módulos
// pré-bundlados do Vite (react.js?v=..., react-dom?v=...) com estratégia
// cache-first. Quando o Vite reotimiza dependências no meio da sessão, o SW
// passa a servir chunks antigos misturados com novos, carregando DUAS cópias
// de React → "Invalid hook call" em useNavigate → <Cadastro> quebra → tela
// branca. Por isso, em dev, nós ATIVAMENTE removemos qualquer SW já instalado
// e limpamos os caches (necessário para quem já abriu o app antes desta correção).
if (import.meta.env.PROD) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .catch((err) => console.error('Falha ao registrar o service worker:', err))
    })
  }
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister()))
    .catch(() => {})
  if (window.caches?.keys) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {})
  }
}
