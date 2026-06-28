import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Logout from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import Close from '@mui/icons-material/Close'
import StarRate from '@mui/icons-material/StarRate'
import api from '../../services/api'

const BASE_LINKS = [{ to: '/home', label: 'Início' }]

// Familiar: navega pelo Feed de cuidadores e mantém Solicitações próprias.
const FAMILIAR_LINKS = [
  { to: '/feed', label: 'Feed' },
  { to: '/perfil', label: 'Perfil' },
  { to: '/solicitacoes', label: 'Solicitações' },
]

// Cuidador (Sprint 4): não navega mais por perfis de Familiar — só por Solicitações.
const CUIDADOR_LINKS = [
  { to: '/solicitacoes-disponiveis', label: 'Solicitações' },
  { to: '/perfil', label: 'Perfil' },
]

// TODO: substituir pelo link definitivo do formulário de avaliação
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdNC2m1fcjJa5EyUve8cwtvpxKXfh_b1PoBN_Q71kphQ9gZtQ/viewform?usp=header'

export default function Menu() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const fazerLogout = () => {
    localStorage.clear()
    navigate('/')
  }

  const isActive = (path) => location.pathname === path

  // Sessões iniciadas antes desta atualização não têm "meuRole" salvo —
  // sem isso o menu perderia Feed/Solicitações até um novo login.
  // Buscamos o papel uma vez via API e guardamos para as próximas renderizações.
  const [role, setRole] = useState(() => localStorage.getItem('meuRole'))

  useEffect(() => {
    if (role) return
    const id = localStorage.getItem('meuId')
    if (!id) return
    let cancelled = false
    api
      .get(`/users/${id}`)
      .then((res) => {
        const fetchedRole = (res.data.user ?? res.data)?.role
        if (!cancelled && fetchedRole) {
          localStorage.setItem('meuRole', fetchedRole)
          setRole(fetchedRole)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [role])

  const LINKS =
    role === 'FAMILIAR'
      ? [...BASE_LINKS, ...FAMILIAR_LINKS]
      : role === 'CUIDADOR'
        ? [...BASE_LINKS, ...CUIDADOR_LINKS]
        : BASE_LINKS

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-virla-roxomid/40 shadow-virla">
      <nav className="h-16 max-w-4xl mx-auto px-4 w-full flex items-center justify-between gap-4 font-body">
        <Link to="/home" className="flex items-center gap-2 flex-shrink-0 rounded-lg">
          <img src="/favicon.ico" alt="" className="w-9 h-9 object-contain shrink-0" aria-hidden />
          <span className="font-display font-black text-xl tracking-wide text-virla-roxodark">VIRLA</span>
        </Link>

        {/* Navegação desktop */}
        <div className="hidden sm:flex items-center gap-1">
          {LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              aria-current={isActive(to) ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
                ${
                  isActive(to)
                    ? 'bg-virla-roxo/10 text-virla-roxo font-semibold'
                    : 'text-virla-muted hover:text-virla-roxo hover:bg-virla-roxo/8'
                }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <a
            href={FEEDBACK_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Avaliar Sistema"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-virla-roxomid/70
                       text-sm font-medium text-virla-muted transition-all duration-150
                       hover:border-virla-roxo hover:text-virla-roxo hover:bg-virla-roxo/8
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/40"
          >
            <StarRate sx={{ fontSize: 16 }} aria-hidden />
            Avaliar Sistema
          </a>
          <button
            type="button"
            onClick={fazerLogout}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-virla-roxomid/70
                       text-sm font-medium text-virla-muted transition-all duration-150
                       hover:border-virla-roxo hover:text-virla-roxo hover:bg-virla-roxo/8
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/40"
          >
            <Logout sx={{ fontSize: 16 }} aria-hidden />
            Sair
          </button>
        </div>

        {/* Botão hambúrguer (mobile) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          className="sm:hidden p-2 rounded-lg text-virla-roxo hover:bg-virla-roxo/10
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/40"
        >
          {open ? <Close sx={{ fontSize: 24 }} /> : <MenuIcon sx={{ fontSize: 24 }} />}
        </button>
      </nav>

      {/* Painel mobile */}
      {open && (
        <div className="sm:hidden border-t border-virla-roxomid/40 bg-white/95 backdrop-blur-md animate-fade-in">
          <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col gap-1">
            {LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                aria-current={isActive(to) ? 'page' : undefined}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${
                    isActive(to)
                      ? 'bg-virla-roxo/10 text-virla-roxo font-semibold'
                      : 'text-virla-muted hover:text-virla-roxo hover:bg-virla-roxo/8'
                  }`}
              >
                {label}
              </Link>
            ))}
            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium
                         text-virla-muted hover:text-virla-roxo hover:bg-virla-roxo/8 transition-colors"
            >
              <StarRate sx={{ fontSize: 18 }} aria-hidden />
              Avaliar Sistema
            </a>
            <p className="px-3 pt-1 pb-2 text-xs text-virla-muted/80">
              Sua opinião nos ajuda a melhorar o Virla 💜
            </p>
            <button
              type="button"
              onClick={fazerLogout}
              className="flex items-center gap-1.5 px-3 py-2.5 mt-1 rounded-lg text-sm font-medium
                         text-red-600 hover:bg-red-50 transition-colors text-left"
            >
              <Logout sx={{ fontSize: 18 }} aria-hidden />
              Sair
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
