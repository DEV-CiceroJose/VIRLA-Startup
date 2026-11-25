import { Link } from 'react-router-dom'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ThemeToggle from '../../design-system/theme/ThemeToggle'
import BackgroundPaths from './BackgroundPaths'
import '../../design-system/auth.css'

/**
 * AuthLayout — login e cadastro: formulário num cartão translúcido no centro,
 * sobre as linhas animadas do Background Paths (21st.dev).
 */
export default function AuthLayout({ children }) {
  return (
    <div className="va-page">
      <BackgroundPaths />
      <header className="va-top">
        <Link to="/" className="va-brand" aria-label="VIRLA, página inicial">
          <img src="/logo.png" alt="" width="32" height="32" />
          VIRLA
        </Link>
        <div className="va-top-actions">
          <Link to="/" className="va-back" aria-label="Voltar à página inicial">
            <ArrowBack aria-hidden />
            <span>Página inicial</span>
          </Link>
          <ThemeToggle variant="inline" className="va-theme" />
        </div>
      </header>
      <main className="va-card">{children}</main>
      <footer className="va-legal-links">
        <Link to="/termos">Termos de Uso</Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacidade">Política de Privacidade</Link>
      </footer>
    </div>
  )
}
