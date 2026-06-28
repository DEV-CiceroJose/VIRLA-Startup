import { useRef, useState } from 'react'
import Image from '@mui/icons-material/Image'
import Upload from '@mui/icons-material/Upload'

const MAX_BYTES = 2 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

/**
 * Upload de arquivo (<input type="file">) → data URL (base64) para profileImage.
 * Não usa campo de URL; o arquivo é lido via FileReader.
 */
export default function ProfileImageUpload({ value, onChange }) {
  const inputRef = useRef(null)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')

  function handleFile(e) {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem (JPEG, PNG, WebP ou GIF).')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Imagem muito grande. Máximo 2 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      onChange(reader.result)
      setFileName(file.name)
    }
    reader.onerror = () => setError('Não foi possível ler o arquivo.')
    reader.readAsDataURL(file)
  }

  function clearImage() {
    onChange('')
    setFileName('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-virla-texto/60 uppercase tracking-wide mb-1.5">
        Foto de perfil (opcional)
      </label>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFile}
        className="sr-only"
        aria-label="Selecionar foto de perfil"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-virla-roxo/25
                     bg-virla-roxo/5 text-virla-roxo text-sm font-semibold hover:bg-virla-roxo/10 transition-colors"
        >
          <Upload sx={{ fontSize: 18 }} />
          Escolher arquivo
        </button>
        {value && (
          <button
            type="button"
            onClick={clearImage}
            className="text-xs text-red-600 hover:underline font-medium"
          >
            Remover foto
          </button>
        )}
      </div>

      {fileName && (
        <p className="text-xs text-virla-texto/50 truncate flex items-center gap-1">
          <Image sx={{ fontSize: 14 }} className="text-virla-roxo/50" />
          {fileName}
        </p>
      )}

      {value && (
        <img
          src={value}
          alt="Pré-visualização"
          className="w-20 h-20 rounded-full object-cover border-2 border-virla-roxo/20 shadow-sm"
        />
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
