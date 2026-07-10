import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { ATTACHMENT_MIMES, MAX_ATTACHMENT_BYTES } from '../utils/attachment.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ALLOWED = new Set(ATTACHMENT_MIMES)

// Preserva a extensão original (o upload de áudio força .webm, por isso não dá
// pra reusar). O nome no disco é gerado pelo servidor (timestamp + hash), nunca
// vem do nome do usuário → sem path traversal.
const storage = multer.diskStorage({
  destination: path.resolve(__dirname, '..', '..', 'uploads'),
  filename: (request, file, callback) => {
    const hash = crypto.randomBytes(6).toString('hex')
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 10)
    callback(null, `${Date.now()}-${hash}${ext}`)
  },
})

const uploadAttachment = multer({
  storage,
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
  fileFilter: (request, file, callback) => {
    if (ALLOWED.has(file.mimetype)) return callback(null, true)
    const err = new Error('Tipo de arquivo não permitido. Envie imagem (JPG/PNG/WEBP/GIF) ou PDF.')
    err.status = 422
    return callback(err)
  },
})

export default uploadAttachment
