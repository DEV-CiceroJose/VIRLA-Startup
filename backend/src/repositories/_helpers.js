import { Timestamp } from 'firebase-admin/firestore'

/**
 * Helpers compartilhados pelos repositórios Firestore.
 *
 * Convenções:
 *  - Datas são gravadas como `Timestamp` e lidas de volta como `Date` (mapDoc),
 *    para o resto da aplicação continuar trabalhando com `Date` como no Prisma.
 *  - `mapDoc` injeta o `id` do documento no objeto (equivalente ao `id` do Prisma).
 */

export const nowTs = () => Timestamp.now()

/** Converte Date/ISO em Timestamp do Firestore (ou null). */
export const toTimestamp = (d) => {
  if (d == null) return null
  const date = d instanceof Date ? d : new Date(d)
  return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date)
}

/**
 * Converte um DocumentSnapshot em objeto plano `{ id, ...campos }`, com todos
 * os `Timestamp` convertidos para `Date`. Retorna null se o doc não existe.
 */
export function mapDoc(snap) {
  if (!snap || !snap.exists) return null
  const data = snap.data()
  if (!data) return null
  return { id: snap.id, ...convertTimestamps(data) }
}

function convertTimestamps(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v instanceof Timestamp ? v.toDate() : v
  }
  return out
}

/** Aplica uma projeção estilo Prisma `select` ({campo: true}) em memória. */
export function project(obj, selectMap) {
  if (!obj || !selectMap) return obj
  const out = {}
  for (const [k, keep] of Object.entries(selectMap)) {
    if (keep && k in obj) out[k] = obj[k]
  }
  // `id` quase sempre é desejado; mantém se marcado no select.
  return out
}

/** Mapeia os docs de um QuerySnapshot via mapDoc. */
export function mapQuery(querySnap) {
  return querySnap.docs.map((d) => mapDoc(d))
}
