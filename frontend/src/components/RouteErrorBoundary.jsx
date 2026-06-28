import { Component } from 'react'
import { Link } from 'react-router-dom'
import Alert from './ui/Alert'

/**
 * Captura erros de renderização em rotas protegidas e evita tela branca.
 */
export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary]', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        className="min-h-screen pt-16 bg-virla-neve flex items-start justify-center px-6 py-12"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 70% 50% at 30% 0%, rgba(128,0,128,0.07), transparent)',
        }}
      >
        <div className="w-full max-w-lg space-y-4">
          <Alert tone="error" title="Não foi possível abrir esta página">
            {error.message || 'Ocorreu um erro inesperado. Tente novamente ou volte ao início.'}
          </Alert>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 rounded-xl bg-virla-roxo text-white text-sm font-semibold hover:bg-virla-roxohighlight transition-colors"
            >
              Tentar novamente
            </button>
            <Link
              to="/home"
              className="px-4 py-2 rounded-xl border border-virla-roxo/30 text-virla-roxo text-sm font-semibold hover:bg-virla-roxo/8 transition-colors"
            >
              Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    )
  }
}
