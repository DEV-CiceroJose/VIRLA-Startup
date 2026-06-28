import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { SocketProvider } from './context/SocketContext'
import { PageLoader } from './components/Spinner'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import { PAYMENT_ENABLED } from './utils/featureFlags'
import Menu from './components/Menu'

// ── Lazy imports — cada página vira um chunk separado no build.
// Se um módulo estiver quebrado, só aquela rota falha; o resto da app
// (incluindo a Landing Page "/") continua renderizando normalmente.
const NotFound          = lazy(() => import('./pages/NotFound'))
const Cadastro          = lazy(() => import('./pages/Cadastro'))
const Login             = lazy(() => import('./pages/Login'))
const Feed              = lazy(() => import('./pages/Feed'))
const Home              = lazy(() => import('./pages/Home'))
const Perfil            = lazy(() => import('./pages/Perfil'))
const Chat              = lazy(() => import('./pages/Chat'))
const Landing           = lazy(() => import('./pages/Landing'))
const Pagamento         = lazy(() => import('./pages/Pagamento'))
const PagamentoSucesso  = lazy(() => import('./pages/Pagamento/Sucesso'))
const User              = lazy(() => import('./pages/User'))
const Solicitacoes      = lazy(() => import('./pages/Solicitacoes'))
const SolicitacoesCuidador = lazy(() => import('./pages/SolicitacoesCuidador'))

// ── Rotas que não exibem o Menu de navegação ─────────────────────────────
const HIDDEN_MENU_ROUTES = ['/', '/login', '/cadastro']

// ── Fallback exibido enquanto o chunk da página carrega ───────────────────
function PageFallback() {
  return <PageLoader label="Carregando…" />
}

/**
 * Guarda de autenticação genérica.
 * Redireciona para /login se não houver token + userId no localStorage.
 */
function ProtectedRoute({ children }) {
  const token  = localStorage.getItem('meuToken')
  const userId = localStorage.getItem('meuId')
  if (!token || !userId) {
    return <Navigate to="/login" replace />
  }
  return <RouteErrorBoundary>{children}</RouteErrorBoundary>
}

/**
 * Guarda do Feed (/feed): Sprint 4 — Cuidador não navega mais por perfis de
 * Familiar diretamente, então é redirecionado para a tela de Solicitações.
 */
function FeedRoute({ children }) {
  const token  = localStorage.getItem('meuToken')
  const userId = localStorage.getItem('meuId')
  const role   = localStorage.getItem('meuRole')

  if (!token || !userId) {
    return <Navigate to="/login" replace />
  }
  if (role === 'CUIDADOR') {
    return <Navigate to="/solicitacoes-disponiveis" replace />
  }
  return children
}

/**
 * Guarda específica para a tela de pagamento (/pagamento).
 * Exige:
 * 1. Usuário autenticado (token + userId).
 * 2. Dados de pagamento presentes no location.state
 *    (amount + payeeId são obrigatórios para iniciar um PIX).
 *
 * Sem esses dados o usuário não chegou aqui pelo fluxo correto
 * (botão de pagamento no chat) — redireciona para /home.
 */
function PagamentoRoute({ children }) {
  const location = useLocation()
  const token    = localStorage.getItem('meuToken')
  const userId   = localStorage.getItem('meuId')

  // Sprint 6: build sem pagamento (VITE_ENABLE_PAYMENT=false) — bloqueia
  // mesmo se alguém tentar acessar a rota digitando a URL direto.
  if (!PAYMENT_ENABLED) {
    return <Navigate to="/home" replace />
  }

  if (!token || !userId) {
    return <Navigate to="/login" replace />
  }

  const { amount, payeeId } = location.state ?? {}
  if (!amount || !payeeId) {
    return <Navigate to="/home" replace />
  }

  return children
}

/**
 * Guarda para a tela de sucesso do pagamento (/pagamento/sucesso).
 * Exige:
 * 1. Usuário autenticado.
 * 2. Flag `virla_pag_sessao` em sessionStorage — gravada em
 *    Pagamento/index.jsx ao receber a resposta da API com sucesso.
 *    Isso garante que só quem passou pela tela de pagamento acesse
 *    a confirmação.
 */
function PagamentoSucessoRoute({ children }) {
  const token       = localStorage.getItem('meuToken')
  const userId      = localStorage.getItem('meuId')
  const sessaoValida = sessionStorage.getItem('virla_pag_sessao') === 'true'

  if (!PAYMENT_ENABLED) {
    return <Navigate to="/home" replace />
  }

  if (!token || !userId) {
    return <Navigate to="/login" replace />
  }

  if (!sessaoValida) {
    return <Navigate to="/home" replace />
  }

  return children
}

export default function AppShell() {
  const location = useLocation()
  const showMenu = !HIDDEN_MENU_ROUTES.includes(location.pathname)

  return (
    <SocketProvider>
      <Toaster position="top-right" richColors />
      {showMenu && <Menu />}

      {/* Suspense envolve todas as rotas: exibe PageLoader enquanto o chunk
          da página lazy está sendo baixado. Erros de import ficam isolados
          por rota graças ao lazy — não travam a aplicação inteira. */}
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Rotas públicas */}
          <Route path="/"         element={<Landing />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />

          {/* Rotas autenticadas */}
          <Route path="/home"   element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/feed"   element={<FeedRoute><Feed /></FeedRoute>} />
          <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />

          {/* Solicitações — Familiar gerencia as próprias; Cuidador vê as disponíveis */}
          <Route path="/solicitacoes"            element={<ProtectedRoute><Solicitacoes /></ProtectedRoute>} />
          <Route path="/solicitacoes-disponiveis" element={<ProtectedRoute><SolicitacoesCuidador /></ProtectedRoute>} />

          <Route path="/chat/:userId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/user/:userId" element={<ProtectedRoute><User /></ProtectedRoute>} />

          {/* Rotas de pagamento — proteção por sessão de pagamento */}
          <Route
            path="/pagamento"
            element={
              <PagamentoRoute>
                <Pagamento />
              </PagamentoRoute>
            }
          />
          <Route
            path="/pagamento/sucesso"
            element={
              <PagamentoSucessoRoute>
                <PagamentoSucesso />
              </PagamentoSucessoRoute>
            }
          />

          {/* Fallback 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </SocketProvider>
  )
}
