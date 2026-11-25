import { Link, NavLink, useLocation } from 'react-router-dom'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ThemeToggle from '../../design-system/theme/ThemeToggle'
import LegalDocument from '../../components/legal/LegalDocument'
import { LEGAL_DOCUMENTS } from './documents'
import '../../design-system/legal.css'

/** Páginas públicas /termos e /privacidade, com índice lateral no desktop. */
export default function LegalPage() {
  const { pathname } = useLocation()
  const doc = LEGAL_DOCUMENTS[pathname.replace('/', '')] ?? LEGAL_DOCUMENTS.termos

  return (
    <div className="vl-page">
      <header className="vl-top">
        <Link to="/" className="vl-brand" aria-label="VIRLA, página inicial">
          <img src="/logo.png" alt="" width="30" height="30" />
          VIRLA
        </Link>
        <div className="vl-top-actions">
          <Link to="/cadastro" className="vl-back"><ArrowBack aria-hidden /><span>Voltar ao cadastro</span></Link>
          <ThemeToggle variant="inline" className="vl-theme" />
        </div>
      </header>

      <div className="vl-layout">
        <aside className="vl-aside">
          <nav className="vl-switch" aria-label="Documentos">
            <NavLink to="/termos">Termos de Uso</NavLink>
            <NavLink to="/privacidade">Política de Privacidade</NavLink>
          </nav>
          <nav className="vl-toc" aria-label="Nesta página">
            <p>Nesta página</p>
            <ol>
              {doc.sections.map((section, index) => (
                <li key={section.title}><a href={`#${doc.slug}-${index + 1}`}>{section.title.replace(/^\d+\.\s*/, '')}</a></li>
              ))}
            </ol>
          </nav>
        </aside>

        <main className="vl-main">
          <h1>{doc.title}</h1>
          <p className="vl-updated">Atualizado em {doc.updated}</p>
          <LegalDocument doc={doc} />
        </main>
      </div>
    </div>
  )
}
