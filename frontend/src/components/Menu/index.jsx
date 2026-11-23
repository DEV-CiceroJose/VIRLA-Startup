import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Logout from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import Close from '@mui/icons-material/Close'
import StarRate from '@mui/icons-material/StarRate'
import HomeOutlined from '@mui/icons-material/HomeOutlined'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined'
import PersonOutline from '@mui/icons-material/PersonOutlined'
import api from '../../services/api'
import { logout } from '../../services/auth'
import NotificationBell from '../NotificationBell'

// ─── Navigation link definitions ──────────────────────────────────────────────

const BASE_LINKS = [{ to: '/home', label: 'Início' }, { to: '/home?tab=mensagens', label: 'Conversas' }]

/** Familiar: can browse caregiver Feed and manage own Solicitações. */
const FAMILIAR_LINKS = [
  { to: '/feed', label: 'Encontrar cuidadores' },
  { to: '/perfil', label: 'Perfil' },
  { to: '/solicitacoes', label: 'Solicitações' },
]

/** Cuidador: only sees available Solicitações and own Perfil. */
const CUIDADOR_LINKS = [
  { to: '/solicitacoes-disponiveis', label: 'Solicitações' },
  { to: '/financas', label: 'Finanças' },
  { to: '/perfil', label: 'Perfil' },
]

// TODO: replace with the definitive review form URL
const FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdNC2m1fcjJa5EyUve8cwtvpxKXfh_b1PoBN_Q71kphQ9gZtQ/viewform?usp=header'

// Desktop breakpoint — must stay in sync with Tailwind's `md` (768 px)
const DESKTOP_BREAKPOINT = 768
const NAV_ICONS = {
  '/home': HomeOutlined,
  '/home?tab=mensagens': ChatBubbleOutline,
  '/feed': SearchOutlined,
  '/perfil': PersonOutline,
  '/solicitacoes': AssignmentOutlined,
  '/solicitacoes-disponiveis': AssignmentOutlined,
  '/financas': AccountBalanceWalletOutlined,
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Menu() {
  const navigate = useNavigate()
  const location = useLocation()

  // ── Mobile drawer state ────────────────────────────────────────────────────
  const [open, setOpen] = useState(false)
  const drawerRef = useRef(null)
  const hamburgerRef = useRef(null)

  // ── Role resolution ────────────────────────────────────────────────────────
  // Sessions started before this update may not have "meuRole" stored yet.
  // We fetch the role once via API and persist it for subsequent renders.
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
    return () => { cancelled = true }
  }, [role])

  const LINKS =
    role === 'FAMILIAR'
      ? [...BASE_LINKS, ...FAMILIAR_LINKS]
      : role === 'CUIDADOR'
        ? [...BASE_LINKS, ...CUIDADOR_LINKS]
        : BASE_LINKS

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isActive = (path) => path.includes('?')
    ? `${location.pathname}${location.search}` === path
    : location.pathname === path && (path !== '/home' || !location.search)

  const closeMenu = useCallback(() => setOpen(false), [])

  const fazerLogout = useCallback(async () => {
    closeMenu()
    // Encerra a sessão do Firebase Auth. Sem isso, `firebaseAuth.currentUser`
    // continua válido e o AuthContext re-popula a sessão — o usuário "voltava"
    // logado. O onAuthChange(null) disparado pelo signOut limpa o AuthContext e
    // o localStorage (meuId/meuNome/meuRole); o clear() cobre chaves restantes.
    try {
      await logout()
    } catch {
      /* mesmo se o signOut falhar, seguimos limpando e redirecionando */
    }
    localStorage.clear()
    navigate('/')
  }, [closeMenu, navigate])

  // ── Click-outside to close ─────────────────────────────────────────────────
  // We watch both the drawer panel AND the hamburger button so that clicking
  // the button itself (which already handles the toggle) is not double-counted.
  useEffect(() => {
    if (!open) return

    function handlePointerDown(e) {
      const insideDrawer = drawerRef.current?.contains(e.target)
      const insideHamburger = hamburgerRef.current?.contains(e.target)
      if (!insideDrawer && !insideHamburger) {
        closeMenu()
      }
    }

    // Use capture phase so the event fires before React's synthetic events
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [open, closeMenu])

  // ── Window resize guard ────────────────────────────────────────────────────
  // If the viewport expands to desktop width while the menu is open, reset it.
  useEffect(() => {
    if (!open) return

    function handleResize() {
      if (window.innerWidth >= DESKTOP_BREAKPOINT) {
        closeMenu()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [open, closeMenu])

  // ── Keyboard: Escape closes the drawer ────────────────────────────────────
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        closeMenu()
        hamburgerRef.current?.focus() // return focus to the toggle button
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, closeMenu])

  // ── Body scroll lock when drawer is open ─────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ── Close drawer on route change ──────────────────────────────────────────
  useEffect(() => { closeMenu() }, [location.pathname, closeMenu])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <aside className="comfort-sidebar" aria-label="Navegação da VIRLA">
        <Link to="/home" className="comfort-sidebar-logo"><img src="/favicon.ico" alt="" /><span>VIRLA</span></Link>
        <p className="comfort-sidebar-caption">Cuidar conecta.</p>
        <nav aria-label="Áreas da plataforma" className="comfort-sidebar-nav">
          {LINKS.map(({ to, label }) => {
            const Icon = NAV_ICONS[to]
            return <Link key={to} to={to} aria-current={isActive(to) ? 'page' : undefined} className={isActive(to) ? 'active' : ''}><Icon aria-hidden fontSize="small" /><span>{label}</span></Link>
          })}
        </nav>
        <div className="comfort-sidebar-bottom">
          <Link to="/perfil" className="comfort-sidebar-profile"><PersonOutline aria-hidden fontSize="small" /><span>Meu perfil</span></Link>
          <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer"><StarRate aria-hidden fontSize="small" /> Avaliar sistema</a>
          <button type="button" onClick={fazerLogout}><Logout aria-hidden fontSize="small" /> Sair</button>
        </div>
      </aside>
      {/* ── Backdrop overlay (mobile only, behind the drawer) ──────────────── */}
      {open && (
        <div
          aria-hidden="true"
          onClick={closeMenu}
          className="
            fixed inset-0 z-40
            bg-virla-roxodark/40 backdrop-blur-sm
            animate-backdrop-in
            md:hidden
          "
        />
      )}

      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <header className="comfort-mobile-header fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-virla-roxomid/40 shadow-virla">
        <nav
          className="h-16 max-w-4xl mx-auto px-4 w-full flex items-center justify-between gap-4 font-body"
          aria-label="Navegação principal"
        >
          {/* Brand */}
          <Link
            to="/home"
            className="flex items-center gap-2 flex-shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/40"
          >
            <img src="/favicon.ico" alt="" className="w-9 h-9 object-contain shrink-0" aria-hidden />
            <span className="font-display font-black text-xl tracking-wide text-virla-roxodark">VIRLA</span>
          </Link>

          {/* ── Desktop navigation links ──────────────────────────────────── */}
          <div className="hidden md:flex items-center gap-1" role="list">
            {LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                role="listitem"
                aria-current={isActive(to) ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${
                    isActive(to)
                      ? 'bg-virla-roxo/10 text-virla-roxo font-semibold'
                      : 'text-virla-muted hover:text-virla-roxo hover:bg-virla-roxo/8'
                  }
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/40`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* ── Desktop action buttons ────────────────────────────────────── */}
          <div className="hidden md:flex items-center gap-2">
            <NotificationBell />
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

          {/* ── Ações mobile: sino sempre visível + hambúrguer ────────────── */}
          <div className="flex md:hidden items-center gap-1">
            <NotificationBell />
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={open}
              aria-controls="mobile-menu-drawer"
              className="p-2 rounded-lg text-virla-roxo
                         hover:bg-virla-roxo/10 transition-colors duration-150
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/40"
            >
              {open ? <Close sx={{ fontSize: 24 }} /> : <MenuIcon sx={{ fontSize: 24 }} />}
            </button>
          </div>
        </nav>

        {/* ── Mobile drawer ─────────────────────────────────────────────────
            Rendered inside <header> so it sits below the navbar bar and
            above the backdrop (z-50 on header > z-40 on backdrop).          */}
        {open && (
          <div
            id="mobile-menu-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            className="
              md:hidden
              border-t border-virla-roxomid/40
              bg-white/97 backdrop-blur-md
              shadow-virla-lg
              animate-slide-down
            "
          >
            <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col gap-1">
              {/* Nav links */}
              {LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={closeMenu}
                  aria-current={isActive(to) ? 'page' : undefined}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150
                    ${
                      isActive(to)
                        ? 'bg-virla-roxo/10 text-virla-roxo font-semibold'
                        : 'text-virla-muted hover:text-virla-roxo hover:bg-virla-roxo/8'
                    }
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/40`}
                >
                  {label}
                </Link>
              ))}

              {/* Divider */}
              <div className="my-1 border-t border-virla-roxomid/30" aria-hidden="true" />

              {/* Feedback link */}
              <a
                href={FEEDBACK_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium
                           text-virla-muted hover:text-virla-roxo hover:bg-virla-roxo/8 transition-colors duration-150
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/40"
              >
                <StarRate sx={{ fontSize: 18 }} aria-hidden />
                Avaliar Sistema
              </a>
              <p className="px-3 pt-0.5 pb-1 text-xs text-virla-muted/70">
                Sua opinião nos ajuda a melhorar o Virla 💜
              </p>

              {/* Divider */}
              <div className="my-1 border-t border-virla-roxomid/30" aria-hidden="true" />

              {/* Logout */}
              <button
                type="button"
                onClick={fazerLogout}
                className="flex items-center gap-1.5 px-3 py-2.5 mt-0.5 rounded-lg text-sm font-medium
                           text-red-600 hover:bg-red-50 transition-colors duration-150 text-left
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
              >
                <Logout sx={{ fontSize: 18 }} aria-hidden />
                Sair
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  )
}
