import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Notifications from '@mui/icons-material/Notifications'
import Chat from '@mui/icons-material/Chat'
import AssignmentTurnedIn from '@mui/icons-material/AssignmentTurnedIn'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Cancel from '@mui/icons-material/Cancel'
import { useNotifications } from '../../context/NotificationContext'
import { notificationText, notificationHref } from '../../utils/notificationsView'

const ICON_BY_TYPE = {
  MESSAGE: Chat,
  SOLICITACAO_ASSUMIDA: AssignmentTurnedIn,
  SOLICITACAO_CONCLUIDA: CheckCircle,
  SOLICITACAO_CANCELADA: Cancel,
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const close = useCallback(() => setOpen(false), [])

  // Fecha ao clicar fora / Esc.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (!rootRef.current?.contains(e.target)) close()
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  function handleClick(n) {
    markRead(n.id)
    close()
    navigate(notificationHref(n))
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
        aria-expanded={open}
        className="relative p-2 rounded-lg text-virla-roxo hover:bg-virla-roxo/10 transition-colors duration-150
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/40"
      >
        <Notifications sx={{ fontSize: 22 }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full
                       bg-red-500 text-white text-[11px] font-bold flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificações"
          className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-2xl bg-white shadow-virla-lg
                     border border-virla-roxomid/40 z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-virla-roxomid/30">
            <span className="font-display font-bold text-virla-roxo text-sm">Notificações</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-virla-muted hover:text-virla-roxo"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-virla-muted">
              Nenhuma notificação por aqui ainda.
            </p>
          ) : (
            <ul className="divide-y divide-virla-roxomid/20">
              {notifications.map((n) => {
                const Icon = ICON_BY_TYPE[n.type] ?? Notifications
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
                        hover:bg-virla-roxo/5 ${n.read ? 'opacity-60' : ''}`}
                    >
                      <Icon sx={{ fontSize: 18 }} className="text-virla-roxo/70 mt-0.5 shrink-0" aria-hidden />
                      <span className="text-sm text-virla-texto">{notificationText(n)}</span>
                      {!n.read && (
                        <span className="ml-auto mt-1.5 w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
