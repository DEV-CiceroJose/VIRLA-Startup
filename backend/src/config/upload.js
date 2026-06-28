import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Tipos de áudio aceitos (o front grava em webm/opus; navegadores variam).
const ALLOWED_AUDIO_MIME = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
])

const MAX_AUDIO_BYTES = Number(process.env.MAX_AUDIO_BYTES) || 10 * 1024 * 1024 // 10MB

const storage = multer.diskStorage({
  // Volta duas pastas (sai de config, sai de src) e entra em uploads
  destination: path.resolve(__dirname, '..', '..', 'uploads'),

  filename: (request, file, callback) => {
    const hash = crypto.randomBytes(6).toString('hex')
    const timestamp = Date.now()
    const fileName = `${timestamp}-${hash}.webm`

    callback(null, fileName)
  },
})

// HARDENING: limita tamanho e valida o mimetype para evitar abuso de upload
// (DoS por arquivos gigantes e armazenamento de conteúdo arbitrário).
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_AUDIO_BYTES,
    files: 1,
  },
  fileFilter: (request, file, callback) => {
    if (ALLOWED_AUDIO_MIME.has(file.mimetype)) {
      return callback(null, true)
    }
    const err = new Error('Tipo de arquivo não permitido. Envie apenas áudio.')
    err.status = 422
    return callback(err)
  },
})

export default upload
