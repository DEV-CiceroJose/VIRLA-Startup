import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb'
import { db } from '../src/lib/firestore.js'

/**
 * Migração de dados MongoDB → Firestore (executar UMA vez no cutover).
 *
 * Pré-requisitos:
 *   1. `npm i mongodb` na pasta backend (dependência só do script; pode
 *      remover depois com `npm rm mongodb`).
 *   2. `.env` com DATABASE_URL (Mongo Atlas) e as variáveis FIREBASE_* da
 *      Service Account (mesmas que o backend usa para o Firestore).
 *
 * Características:
 *   - Idempotente: grava cada documento com `doc(<_id antigo>).set(...)`, então
 *     rodar duas vezes não duplica (apenas sobrescreve).
 *   - Preserva IDs do Mongo como IDs do Firestore (mantém as referências
 *     cruzadas familiarId/caregiverId/paymentId/etc. funcionando).
 *   - Converte ObjectId → string e mantém Date (o Admin SDK grava como Timestamp).
 *
 * Uso:
 *   node scripts/migrate-mongo-to-firestore.js --dry-run        # não escreve, só conta
 *   node scripts/migrate-mongo-to-firestore.js                  # migra tudo
 *   node scripts/migrate-mongo-to-firestore.js --only=User      # só uma coleção
 */

const DRY_RUN = process.argv.includes('--dry-run')
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').split('=')[1] || null

// Mongo (coleção Prisma) -> Firestore (coleção dos repositórios).
// Message fica de fora: o chat já vive no Realtime Database (Sprint 0).
const MAP = [
  { mongo: 'User', fs: 'users' },
  { mongo: 'Solicitacao', fs: 'solicitacoes' },
  { mongo: 'ChargeRequest', fs: 'chargeRequests' },
  { mongo: 'Payment', fs: 'payments' },
  { mongo: 'Escrow', fs: 'escrows' },
  // EscrowAuditLog -> subcoleção escrows/{escrowId}/auditLogs (tratado à parte)
  // EscrowIdempotencyKey -> doc id = campo `key` (tratado à parte)
]

const BATCH = 400

/** Converte ObjectId -> string; mantém Date; recorre em arrays/objetos. */
function convert(value) {
  if (value instanceof ObjectId) return value.toString()
  if (value instanceof Date) return value
  if (Array.isArray(value)) return value.map(convert)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = convert(v)
    return out
  }
  return value
}

/** Extrai { id, data } de um doc do Mongo (sem o _id dentro de data). */
function split(doc, idField = '_id') {
  const { _id, ...rest } = doc
  const id = String(idField === '_id' ? _id : doc[idField])
  return { id, data: convert(rest) }
}

async function commitInChunks(writes) {
  for (let i = 0; i < writes.length; i += BATCH) {
    const slice = writes.slice(i, i + BATCH)
    if (DRY_RUN) continue
    const batch = db.batch()
    for (const { ref, data } of slice) batch.set(ref, data)
    await batch.commit()
  }
}

async function migrateSimple(mongoDb, { mongo, fs }) {
  if (ONLY && ONLY !== mongo) return
  const docs = await mongoDb.collection(mongo).find({}).toArray()
  const writes = docs.map((doc) => {
    const { id, data } = split(doc)
    return { ref: db.collection(fs).doc(id), data }
  })
  await commitInChunks(writes)
  console.log(`[${mongo} -> ${fs}] ${docs.length} docs ${DRY_RUN ? '(dry-run)' : 'migrados'}`)
}

async function migrateAuditLogs(mongoDb) {
  if (ONLY && ONLY !== 'EscrowAuditLog') return
  const docs = await mongoDb.collection('EscrowAuditLog').find({}).toArray()
  const writes = docs.map((doc) => {
    const { id, data } = split(doc)
    const escrowId = String(data.escrowId)
    return { ref: db.collection('escrows').doc(escrowId).collection('auditLogs').doc(id), data }
  })
  await commitInChunks(writes)
  console.log(`[EscrowAuditLog -> escrows/*/auditLogs] ${docs.length} docs ${DRY_RUN ? '(dry-run)' : 'migrados'}`)
}

async function migrateIdempotency(mongoDb) {
  if (ONLY && ONLY !== 'EscrowIdempotencyKey') return
  const docs = await mongoDb.collection('EscrowIdempotencyKey').find({}).toArray()
  // ID do documento = a própria chave (garante unicidade no Firestore).
  const writes = docs.map((doc) => {
    const { data } = split(doc)
    return { ref: db.collection('escrowIdempotencyKeys').doc(String(data.key)), data }
  })
  await commitInChunks(writes)
  console.log(`[EscrowIdempotencyKey -> escrowIdempotencyKeys] ${docs.length} docs ${DRY_RUN ? '(dry-run)' : 'migrados'}`)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL ausente no .env (string de conexão do MongoDB).')
    process.exit(1)
  }

  console.log(DRY_RUN ? '== DRY-RUN (nada será escrito) ==' : '== Migração Mongo -> Firestore ==')
  const client = new MongoClient(url)
  await client.connect()
  try {
    const mongoDb = client.db()
    for (const m of MAP) await migrateSimple(mongoDb, m)
    await migrateAuditLogs(mongoDb)
    await migrateIdempotency(mongoDb)
    console.log('Concluído. Confira as contagens por coleção no console do Firebase.')
  } finally {
    await client.close()
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('Falha na migração:', err)
  process.exit(1)
})
