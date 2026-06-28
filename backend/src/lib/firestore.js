import admin from 'firebase-admin'
import { FIREBASE_CONFIGURED } from './firebase.js'
import { logger } from './logger.js'

/**
 * Cliente Firestore — reaproveita o app `firebase-admin` já inicializado em
 * firebase.js (mesmas credenciais de service account). Substitui o Prisma/
 * MongoDB como banco principal de toda a aplicação (Sprint Firebase-only).
 *
 * Mesma filosofia de degradação do RTDB: se o Firebase não estiver
 * configurado, `db` vira um proxy que lança um erro contendo "Firebase",
 * em vez de derrubar o processo no import.
 */
function createUnavailableProxy() {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('Firebase Firestore não está configurado ou falhou ao iniciar.')
      },
    },
  )
}

let db

if (FIREBASE_CONFIGURED) {
  try {
    db = admin.firestore()
    // ignoreUndefinedProperties: campos opcionais (ex.: cpf, birthDate) podem
    // vir undefined — sem isso o Firestore lança ao gravar.
    db.settings({ ignoreUndefinedProperties: true })
    logger.info('firestore:initialized')
  } catch (err) {
    logger.error('firestore:init_failed', { error: err.message, stack: err.stack })
    db = createUnavailableProxy()
  }
} else {
  db = createUnavailableProxy()
}

export const FIRESTORE_CONFIGURED = FIREBASE_CONFIGURED
export { db }
export default db
