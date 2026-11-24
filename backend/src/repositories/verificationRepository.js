import { db } from '../lib/firestore.js'
import { mapDoc, mapQuery, nowTs } from './_helpers.js'

/**
 * Coleção `verifications/{uid}` — dados da verificação do cuidador (status,
 * referências aos arquivos cifrados, código da certidão, revisão). Fica fora
 * do doc `users` para nunca vazar por projeções do perfil; o status é
 * espelhado em `users.verificationStatus` para o feed filtrar sem joins.
 */

const col = () => db.collection('verifications')

export async function getVerification(userId) {
  if (!userId) return null
  return mapDoc(await col().doc(userId).get())
}

/** Mescla campos (cria o doc se não existir). */
export async function upsertVerification(userId, patch) {
  await col().doc(userId).set({ ...patch, updatedAt: nowTs() }, { merge: true })
  return getVerification(userId)
}

export async function listVerificationsByStatus(status) {
  return mapQuery(await col().where('status', '==', status).get())
}
