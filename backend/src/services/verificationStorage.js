import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { encryptBuffer, decryptBuffer } from '../lib/fileCrypto.js'

/**
 * Armazena os documentos da verificação CIFRADOS em uma pasta privada
 * (`backend/private-uploads/verification/<uid>/`), que NÃO é servida pelo
 * express.static — o acesso passa sempre pela rota autenticada (dono ou admin).
 *
 * Atenção em produção: o disco da Render é efêmero (some a cada deploy).
 * Antes de ir ao ar, troque esta camada por um bucket privado (Firebase
 * Storage com regras fechadas ou S3) mantendo a mesma interface.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..', 'private-uploads', 'verification')

function safeUser(userId) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId)) throw new Error('Usuário inválido.')
  return userId
}

export async function saveDocument(userId, kind, buffer) {
  const dir = path.join(ROOT, safeUser(userId))
  await fs.mkdir(dir, { recursive: true })
  const name = `${kind}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.enc`
  await fs.writeFile(path.join(dir, name), encryptBuffer(buffer))
  return `${userId}/${name}`
}

export async function readDocument(relativePath) {
  const full = path.resolve(ROOT, relativePath)
  if (!full.startsWith(ROOT + path.sep)) throw new Error('Caminho inválido.')
  return decryptBuffer(await fs.readFile(full))
}

export async function removeDocument(relativePath) {
  if (!relativePath) return
  const full = path.resolve(ROOT, relativePath)
  if (!full.startsWith(ROOT + path.sep)) return
  await fs.rm(full, { force: true })
}
