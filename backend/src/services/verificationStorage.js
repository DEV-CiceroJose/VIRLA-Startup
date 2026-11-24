import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { db } from '../lib/firestore.js'
import { encryptBuffer, decryptBuffer } from '../lib/fileCrypto.js'

/**
 * Armazena os documentos da verificação CIFRADOS (AES-256-GCM) no Firestore,
 * divididos em pedaços (`verificationFiles/{id}` + subcoleção `chunks`).
 * Assim funciona na Render (disco efêmero) sem exigir o plano pago do
 * Firebase Storage. As regras do Firestore negam todo acesso de cliente; só
 * o backend (Admin SDK) lê, e a rota de leitura exige dono ou equipe.
 *
 * Referências antigas em disco (`<uid>/<arquivo>.enc`, de seeds locais
 * anteriores) continuam legíveis.
 */

const CHUNK_BYTES = 700 * 1024 // cada doc do Firestore aceita até ~1 MiB
const PREFIX = 'firestore:'
const files = () => db.collection('verificationFiles')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LEGACY_ROOT = path.resolve(__dirname, '..', '..', 'private-uploads', 'verification')

function safeUser(userId) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId)) throw new Error('Usuário inválido.')
  return userId
}

/** Divide um buffer em pedaços de no máximo `size` bytes. */
export function splitChunks(buffer, size = CHUNK_BYTES) {
  const chunks = []
  for (let offset = 0; offset < buffer.length; offset += size) chunks.push(buffer.subarray(offset, offset + size))
  return chunks.length ? chunks : [Buffer.alloc(0)]
}

export async function saveDocument(userId, kind, buffer) {
  safeUser(userId)
  const id = `${userId}_${kind}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const ref = files().doc(id)
  const chunks = splitChunks(encryptBuffer(buffer))
  // Pedaços primeiro, metadados por último: um arquivo só "existe" completo.
  await Promise.all(chunks.map((data, n) => ref.collection('chunks').doc(String(n).padStart(4, '0')).set({ data })))
  await ref.set({ userId, kind, chunkCount: chunks.length, createdAt: new Date() })
  return `${PREFIX}${id}`
}

export async function readDocument(reference) {
  if (String(reference).startsWith(PREFIX)) {
    const ref = files().doc(reference.slice(PREFIX.length))
    const meta = await ref.get()
    if (!meta.exists) throw new Error('Documento não encontrado.')
    const snap = await ref.collection('chunks').orderBy('__name__').get()
    if (snap.size !== meta.data().chunkCount) throw new Error('Documento incompleto.')
    return decryptBuffer(Buffer.concat(snap.docs.map((d) => Buffer.from(d.get('data')))))
  }
  const full = path.resolve(LEGACY_ROOT, reference)
  if (!full.startsWith(LEGACY_ROOT + path.sep)) throw new Error('Caminho inválido.')
  return decryptBuffer(await fs.readFile(full))
}

export async function removeDocument(reference) {
  if (!reference) return
  if (String(reference).startsWith(PREFIX)) {
    const ref = files().doc(reference.slice(PREFIX.length))
    const snap = await ref.collection('chunks').get()
    await Promise.all(snap.docs.map((d) => d.ref.delete()))
    await ref.delete()
    return
  }
  const full = path.resolve(LEGACY_ROOT, reference)
  if (full.startsWith(LEGACY_ROOT + path.sep)) await fs.rm(full, { force: true })
}
