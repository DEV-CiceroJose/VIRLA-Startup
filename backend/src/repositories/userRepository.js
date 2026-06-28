import { db } from '../lib/firestore.js'
import { mapDoc, mapQuery, toTimestamp } from './_helpers.js'

/**
 * userRepository — acesso à coleção `users` no Firestore (substitui
 * prisma.user.*). Retorna objetos planos `{ id, ...campos }` com datas já
 * convertidas para `Date`.
 *
 * Unicidade de email: garantida por consulta (`where('email','==')`) antes de
 * criar/atualizar. Para o volume do MVP, a janela de corrida é desprezível;
 * se virar problema, migrar para um doc-índice `usersByEmail/{email}` em
 * transação (ver plano de migração).
 */

const col = () => db.collection('users')

/** Converte campos especiais (datas) antes de gravar. */
function serialize(data) {
  const out = { ...data }
  if ('birthDate' in out) out.birthDate = toTimestamp(out.birthDate)
  return out
}

export async function getUserById(id) {
  if (!id) return null
  return mapDoc(await col().doc(id).get())
}

export async function getUserByEmail(email) {
  if (!email) return null
  const snap = await col().where('email', '==', email).limit(1).get()
  return snap.empty ? null : mapDoc(snap.docs[0])
}

/** true se já existe outro usuário com este email (ignora `exceptId`). */
export async function emailExists(email, exceptId = null) {
  if (!email) return false
  const snap = await col().where('email', '==', email).limit(2).get()
  return snap.docs.some((d) => d.id !== exceptId)
}

export async function createUser(data) {
  const ref = col().doc()
  await ref.set(serialize(data))
  return getUserById(ref.id)
}

export async function updateUser(id, patch) {
  await col().doc(id).update(serialize(patch))
  return getUserById(id)
}

export async function deleteUser(id) {
  await col().doc(id).delete()
}

/** Todos os usuários (uso administrativo/interno). */
export async function listAll() {
  return mapQuery(await col().get())
}

/** Usuários de um papel específico (CUIDADOR | FAMILIAR). */
export async function listByRole(role) {
  return mapQuery(await col().where('role', '==', role).get())
}

/** Busca em lote por IDs (substitui findMany({ where: { id: { in } } })). */
export async function listByIds(ids) {
  if (!ids || ids.length === 0) return []
  const refs = ids.map((id) => col().doc(id))
  const snaps = await db.getAll(...refs)
  return snaps.map(mapDoc).filter(Boolean)
}
