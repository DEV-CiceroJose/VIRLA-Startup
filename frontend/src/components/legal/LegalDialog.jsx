import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Close from '@mui/icons-material/Close'
import LegalDocument from './LegalDocument'

/**
 * LegalDialog — adaptado do "Terms & Conditions dialog" (Origin UI, 21st.dev):
 * o documento abre numa caixa com rolagem e o botão "Li e aceito" só libera
 * depois que a pessoa chega ao fim do texto. Uma barra no topo mostra quanto
 * já foi lido.
 */
export default function LegalDialog({ doc, open, onClose, onAccept }) {
  const scrollRef = useRef(null)
  const closeRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const [readToEnd, setReadToEnd] = useState(false)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  const measure = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const ratio = max <= 4 ? 1 : el.scrollTop / max
    setProgress(Math.min(1, ratio))
    if (ratio >= 0.985) setReadToEnd(true)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    closeRef.current?.focus()
    requestAnimationFrame(measure)
    const onKey = (event) => { if (event.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, measure])

  if (!open) return null
  const titleId = `vl-dialog-${doc.slug}`

  // Portal no body: pais com backdrop-filter/transform prenderiam o position: fixed.
  return createPortal(
    <div className="vl-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="vl-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="vl-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
        <header className="vl-dialog-head">
          <div>
            <h2 id={titleId}>{doc.title}</h2>
            <p>Atualizado em {doc.updated}</p>
          </div>
          <button ref={closeRef} type="button" className="vl-icon-btn" onClick={onClose} aria-label="Fechar">
            <Close aria-hidden />
          </button>
        </header>
        <div ref={scrollRef} className="vl-dialog-body" onScroll={measure} tabIndex={0} aria-label={`Texto completo: ${doc.title}`}>
          <LegalDocument doc={doc} headingLevel={3} idPrefix={`dlg-${doc.slug}`} />
        </div>
        <footer className="vl-dialog-foot">
          <p role="status">{readToEnd ? 'Você chegou ao fim do documento.' : 'Role até o fim para poder aceitar.'}</p>
          <div className="vl-dialog-actions">
            <button type="button" className="vl-btn-ghost" onClick={onClose}>Agora não</button>
            <button type="button" className="vl-btn" disabled={!readToEnd} onClick={onAccept}>Li e aceito</button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
