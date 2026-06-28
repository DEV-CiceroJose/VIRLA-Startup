import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import WarningAmber from '@mui/icons-material/WarningAmber'
import Button from './Button'

/**
 * Diálogo de confirmação acessível — substitui window.confirm() nativo.
 * Fecha com ESC ou clique no backdrop; foco inicial no botão de confirmação.
 */
export default function ConfirmDialog({
  open,
  title = 'Tem certeza?',
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger', // 'danger' | 'primary'
  loading = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    confirmRef.current?.focus()
    function onKey(e) {
      if (e.key === 'Escape' && !loading) onCancel?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, loading, onCancel])

  if (!open) return null

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel?.()
      }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 supports-[backdrop-filter]:backdrop-blur-[2px] animate-fade-in"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? 'confirm-desc' : undefined}
        className="w-full max-w-sm rounded-2xl border border-virla-roxomid/40 bg-white p-6 shadow-virla-lg animate-fade-up"
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
              tone === 'danger' ? 'bg-red-50' : 'bg-virla-roxo/10'
            }`}
          >
            <WarningAmber
              sx={{ fontSize: 24 }}
              className={tone === 'danger' ? 'text-red-500' : 'text-virla-roxo'}
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-lg font-bold text-virla-texto">
              {title}
            </h2>
            {description && (
              <p id="confirm-desc" className="text-sm text-virla-muted mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="ghost" fullWidth onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            fullWidth
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
