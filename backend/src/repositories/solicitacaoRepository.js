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
