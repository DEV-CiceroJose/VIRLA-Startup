import { useRef, useState } from 'react'
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined'
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined'
import CheckCircle from '@mui/icons-material/CheckCircle'
import { DOCUMENT_ACCEPT, MAX_DOCUMENT_BYTES } from '../../services/verification'

const ALLOWED = DOCUMENT_ACCEPT.split(',')

/**
 * DocumentDrop — adaptado do "File Upload" (Aceternity, 21st.dev): área de
 * arrastar e soltar com fundo quadriculado que acende ao arrastar; depois do
 * envio vira um cartão do arquivo com "Ver" e "Trocar".
 */
export default function DocumentDrop({ id, label, hint, sent, uploading, disabled, onFile, onView }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  function pick(file) {
    setError('')
    if (!file) return
    if (!ALLOWED.includes(file.type)) {
      setError('Formato não aceito. Envie JPG, PNG, WEBP ou PDF.')
      return
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError('Arquivo grande demais. O limite é 8 MB.')
      return
    }
    onFile(file)
  }

  const open = () => !disabled && !uploading && inputRef.current?.click()

  return (
    <div className="vv-drop-wrap">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={DOCUMENT_ACCEPT}
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }}
        aria-label={`${sent ? 'Trocar' : 'Enviar'} ${label.toLowerCase()}`}
      />
      {sent ? (
        <div className="vv-file">
          <span className="vv-file-icon"><InsertDriveFileOutlined aria-hidden /></span>
          <span className="vv-file-text">
            <strong>{label}</strong>
            <small><CheckCircle aria-hidden /> Enviado</small>
          </span>
          <span className="vv-file-actions">
            <button type="button" onClick={onView}>Ver</button>
            {!disabled && <button type="button" onClick={open} disabled={uploading}>{uploading ? 'Enviando…' : 'Trocar'}</button>}
          </span>
        </div>
      ) : (
        <button
          type="button"
          className={`vv-drop${dragging ? ' is-dragging' : ''}`}
          onClick={open}
          disabled={disabled || uploading}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]) }}
        >
          <span className="vv-drop-grid" aria-hidden="true" />
          <span className="vv-drop-icon"><CloudUploadOutlined aria-hidden /></span>
          <strong>{uploading ? 'Enviando…' : 'Arraste o arquivo ou toque para escolher'}</strong>
          <small>{hint}</small>
        </button>
      )}
      {error && <p className="vv-error" role="alert">{error}</p>}
    </div>
  )
}
