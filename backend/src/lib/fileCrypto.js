import crypto from 'crypto'

/**
 * Criptografia de arquivos em repouso (AES-256-GCM) para documentos sensíveis
 * da verificação. Usa a mesma ENCRYPTION_KEY (32 caracteres) do chat.
 * Formato gravado: [12 bytes IV][16 bytes tag][dados cifrados].
 */

const ALGORITHM = 'aes-256-gcm'

function keyFrom(secret) {
  const key = Buffer.from(String(secret ?? ''), 'utf-8')
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY deve ter exatos 32 caracteres.')
  return key
}

export function encryptBuffer(buffer, secret = process.env.ENCRYPTION_KEY) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, keyFrom(secret), iv)
  const data = Buffer.concat([cipher.update(buffer), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data])
}

export function decryptBuffer(payload, secret = process.env.ENCRYPTION_KEY) {
  const iv = payload.subarray(0, 12)
  const tag = payload.subarray(12, 28)
  const data = payload.subarray(28)
  const decipher = crypto.createDecipheriv(ALGORITHM, keyFrom(secret), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()])
}
