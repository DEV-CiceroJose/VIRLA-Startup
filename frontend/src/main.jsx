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

// PWA: registra o service worker para permitir instalação ("Adicionar à
// tela inicial") e cache básico de assets estáticos. Em dev (HTTP/localhost)
// e em produção com HTTPS funciona normalmente — navegadores liberam
// Service Workers em localhost mesmo sem TLS, especificamente para isso.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch((err) => console.error('Falha ao registrar o service worker:', err))
  })
}
