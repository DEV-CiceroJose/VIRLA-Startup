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

/** true se já existe outro usuário com este CPF (ignora `exceptId`). */
export async function cpfExists(cpf, exceptId = null) {
  if (!cpf) return false
  const snap = await col().where('cpf', '==', cpf).limit(2).get()
  return snap.docs.some((d) => d.id !== exceptId)
}

/** Cria o perfil com id = uid do Firebase Auth (não usa id automático). */
export async function createUserWithId(uid, data) {
  await col().doc(uid).set(serialize(data))
  return getUserById(uid)
}

export async function updateUser(id, patch) {
  await col().doc(id).update(serialize(patch))
  return getUserById(id)
}

export async function deleteUser(id) {
  await col().doc(id).delete()
}

/** true se já existe outro usuário com o mesmo par (conselho, registro). */
export async function registerExists(council, registerNumber, exceptId = null) {
  if (!council || !registerNumber) return false
  const snap = await col()
    .where('council', '==', council)
    .where('registerNumber', '==', registerNumber)
    .limit(2)
    .get()
  return snap.docs.some((d) => d.id !== exceptId)
}

/** Todos os usuários (uso administrativo/interno). */
export async function listAll() {
  return mapQuery(await col().get())
}

/** Usuários de um papel específico (CUIDADOR | FAMILIAR). */
export async function listByRole(role) {
  return mapQuery(await col().where('role', '==', role).get())
}

// ─── Busca de cuidadores (feed) ─────────────────────────────────────
// Antes o feed lia TODOS os cuidadores e recortava a página em memória:
// 1 busca = N leituras no Firestore. Agora a filtragem (papel + aprovado)
// e o recorte acontecem no próprio Firestore.

/** Só cuidadores aprovados pela equipe aparecem para as famílias. */
const visibleCaregivers = () =>
  col().where('role', '==', 'CUIDADOR').where('verificationStatus', '==', 'APROVADO')

/** Total de cuidadores visíveis (agregação: ~1 leitura a cada 1.000 docs). */
export async function countVisibleCaregivers() {
  const snap = await visibleCaregivers().count().get()
  return snap.data().count
}

/** Uma página de cuidadores visíveis (lê só `offset + limit` documentos). */
export async function listVisibleCaregiversPage({ offset = 0, limit = 10 } = {}) {
  let query = visibleCaregivers().orderBy('__name__')
  if (offset > 0) query = query.offset(offset)
  return mapQuery(await query.limit(limit).get())
}

/**
 * Candidatos para o match de uma solicitação, com teto de leituras: primeiro
 * os do mesmo estado (que pontuam mais), depois os demais até completar.
 */
export async function listCaregiverMatchPool(state, cap = 300) {
  const sameState = state
    ? mapQuery(await visibleCaregivers().where('state', '==', state).limit(cap).get())
    : []
  if (sameState.length >= cap) return sameState
  const seen = new Set(sameState.map((u) => u.id))
  const others = mapQuery(await visibleCaregivers().limit(cap).get()).filter((u) => !seen.has(u.id))
  return [...sameState, ...others].slice(0, cap)
}

/** Busca em lote por IDs (substitui findMany({ where: { id: { in } } })). */
export async function listByIds(ids) {
  if (!ids || ids.length === 0) return []
  const refs = ids.map((id) => col().doc(id))
  const snaps = await db.getAll(...refs)
  return snaps.map(mapDoc).filter(Boolean)
}
