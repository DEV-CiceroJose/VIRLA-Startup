import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Logout from '@mui/icons-material/Logout'
import MenuIcon from '@mui/icons-material/Menu'
import Close from '@mui/icons-material/Close'
import StarRate from '@mui/icons-material/StarRate'
import api from '../../services/api'

// ─── Navigation link definitions ──────────────────────────────────────────────

const BASE_LINKS = [{ to: '/home', label: 'Início' }]

/** Familiar: can browse caregiver Feed and manage own Solicitações. */
const FAMILIAR_LINKS = [
  { to: '/feed', label: 'Feed' },
  { to: '/perfil', label: 'Perfil' },
  { to: '/solicitacoes', label: 'Solicitações' },
]

/** Cuidador: only sees available Solicitações and own Perfil. */
const CUIDADOR_LINKS = [
  { to: '/solicitacoes-disponiveis', label: 'Solicitações' },
  { to: '/perfil', label: 'Perfil' },
]

// TODO: replace with the definitive review form URL
const FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdNC2m1fcjJa5EyUve8cwtvpxKXfh_b1PoBN_Q71kphQ9gZtQ/viewform?usp=header'

// Desktop breakpoint — must stay in sync with Tailwind's `md` (768 px)
const DESKTOP_BREAKPOINT = 768

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
  const isActive = (path) => location.pathname === path

  const closeMenu = useCallback(() => setOpen(false), [])

  const fazerLogout = useCallback(() => {
    closeMenu()
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
      <header className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-virla-roxomid/40 shadow-virla">
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

          {/* ── Hamburger toggle (mobile only) ───────────────────────────── */}
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            aria-controls="mobile-menu-drawer"
            className="md:hidden p-2 rounded-lg text-virla-roxo
                       hover:bg-virla-roxo/10 transition-colors duration-150
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/40"
          >
            {open ? <Close sx={{ fontSize: 24 }} /> : <MenuIcon sx={{ fontSize: 24 }} />}
          </button>
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
