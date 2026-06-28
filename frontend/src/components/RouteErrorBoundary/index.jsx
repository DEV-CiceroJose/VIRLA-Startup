import { Component } from 'react'

/**
 * RouteErrorBoundary — captura erros de runtime na árvore de rotas para que
 * uma falha (ex.: o crash do Firebase que dava tela branca no Chat) não
 * desmonte a aplicação inteira. Exibe um fallback amigável e se recupera
 * automaticamente quando o usuário navega para outra rota (via `resetKey`).
 */
export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary] Erro capturado:', error, info)
  }

  componentDidUpdate(prevProps) {
    // Reseta o estado de erro ao trocar de rota (resetKey = location.pathname).
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
            <h1 className="text-xl font-bold text-virla-roxo">Algo deu errado nesta página</h1>
            <p className="text-sm text-virla-texto/70 max-w-sm">
              Encontramos um problema ao carregar esta tela. Você pode voltar ao início e tentar de novo.
            </p>
            <a
              href="/home"
              className="rounded-xl bg-virla-roxo px-5 py-2.5 text-white font-semibold hover:bg-virla-roxohighlight transition-colors"
            >
              Ir para o início
            </a>
          </div>
        )
      )
    }
    return this.props.children
  }
}
