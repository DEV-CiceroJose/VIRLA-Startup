import { db } from '../lib/firestore.js'
import { mapDoc, mapQuery, nowTs } from './_helpers.js'

/**
 * solicitacaoRepository — coleção `solicitacoes` no Firestore (substitui
 * prisma.solicitacao.*). Defaults do schema Prisma (status ABERTA, arrays,
 * createdAt/updatedAt) passam a ser aplicados aqui explicitamente.
 *
 * Ordenação e o filtro composto do feed são resolvidos em memória para evitar
 * a necessidade de índices compostos (volume baixo no MVP).
 */

const col = () => db.collection('solicitacoes')

const byCreatedAtDesc = (a, b) =>
  (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0)

export async function getById(id) {
  if (!id) return null
  return mapDoc(await col().doc(id).get())
}

export async function create(data) {
  const ref = col().doc()
  const now = nowTs()
  await ref.set({
    familiarId: data.familiarId,
    titulo: data.titulo,
    descricao: data.descricao,
    tipoCuidado: data.tipoCuidado ?? [],
    cidade: data.cidade ?? null,
    estado: data.estado ?? null,
    urgencia: data.urgencia ?? 'MEDIA',
    status: 'ABERTA',
    viewedByIds: [],
    assignedCaregiverId: null,
    createdAt: now,
    updatedAt: now,
  })
  return getById(ref.id)
}

export async function update(id, patch) {
  await col().doc(id).update({ ...patch, updatedAt: nowTs() })
  return getById(id)
}

/**
 * Erro de domínio para o controller mapear o status HTTP correto sem precisar
 * inspecionar mensagens. `code` ∈ { 'NOT_FOUND', 'INVALID_STATUS' }.
 */
export class SolicitacaoError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'SolicitacaoError'
    this.code = code
  }
}

/**
 * CUIDADOR assume a solicitação — ATÔMICO (db.runTransaction).
 *
 * O read+check+write precisa rodar numa transação: sem ela, dois cuidadores
 * clicando "assumir" ao mesmo tempo passariam os dois no check de status e um
 * sobrescreveria o outro (race condition). A transação relê o doc e só comita
 * se a versão não mudou; caso contrário o Firestore reexecuta automaticamente.
 */
export async function assumir(id, caregiverId) {
  const ref = col().doc(id)
  const now = nowTs()
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new SolicitacaoError('NOT_FOUND', 'Solicitação não encontrada.')
    const s = mapDoc(snap)
    if (!['ABERTA', 'VISUALIZADA'].includes(s.status)) {
      throw new SolicitacaoError('INVALID_STATUS', 'Esta solicitação já foi assumida, concluída ou cancelada.')
    }
    const viewedByIds = s.viewedByIds.includes(caregiverId)
      ? s.viewedByIds
      : [...s.viewedByIds, caregiverId]
    tx.update(ref, { status: 'EM_ANDAMENTO', assignedCaregiverId: caregiverId, viewedByIds, updatedAt: now })
    return { ...s, status: 'EM_ANDAMENTO', assignedCaregiverId: caregiverId, viewedByIds, updatedAt: now.toDate() }
  })
}

/**
 * CUIDADOR marca como visualizada — ATÔMICO. Evita perder visualizações
 * concorrentes (dois updates simultâneos no array viewedByIds) e a transição
 * ABERTA→VISUALIZADA é feita sobre o estado mais recente do documento.
 */
export async function markViewed(id, caregiverId) {
  const ref = col().doc(id)
  const now = nowTs()
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new SolicitacaoError('NOT_FOUND', 'Solicitação não encontrada.')
    const s = mapDoc(snap)
    const viewedByIds = s.viewedByIds.includes(caregiverId)
      ? s.viewedByIds
      : [...s.viewedByIds, caregiverId]
    const status = s.status === 'ABERTA' ? 'VISUALIZADA' : s.status
    tx.update(ref, { viewedByIds, status, updatedAt: now })
    return { ...s, viewedByIds, status, updatedAt: now.toDate() }
  })
}

/** Solicitações de um familiar, mais recentes primeiro. */
export async function listByFamiliar(familiarId) {
  const snap = await col().where('familiarId', '==', familiarId).get()
  return mapQuery(snap).sort(byCreatedAtDesc)
}

/**
 * Feed do cuidador: solicitações ABERTA/VISUALIZADA + as EM_ANDAMENTO que ele
 * mesmo assumiu. Duas consultas (evita índice composto status+assignedCaregiver)
 * mescladas por id.
 */
export async function listAvailableForCaregiver(caregiverId) {
  const [openSnap, mineSnap] = await Promise.all([
    col().where('status', 'in', ['ABERTA', 'VISUALIZADA']).get(),
    col().where('assignedCaregiverId', '==', caregiverId).get(),
  ])

  const byId = new Map()
  openSnap.docs.forEach((d) => byId.set(d.id, mapDoc(d)))
  mineSnap.docs.forEach((d) => {
    const s = mapDoc(d)
    if (s.status === 'EM_ANDAMENTO') byId.set(d.id, s)
  })

  return [...byId.values()].sort(byCreatedAtDesc)
}
