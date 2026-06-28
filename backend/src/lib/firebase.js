import admin from 'firebase-admin'
import { logger } from './logger.js'

/**
 * Inicialização do Firebase Admin SDK — usado por:
 *  - chatRealtimeService.js (leitura/escrita administrativa no Realtime Database)
 *  - firebaseController.js (emissão de Custom Tokens para o cliente autenticar
 *    no Firebase Auth usando o MESMO JWT/sessão já validado pelo checkToken)
 *
 * Sprint 0: o Realtime Database substitui o Mongo/Prisma como armazenamento
 * das mensagens de chat, permitindo sincronização em tempo real nativa
 * (sem depender de Socket.io para a entrega das mensagens).
 *
 * CORREÇÃO (falha em cascata): antes, qualquer variável FIREBASE_* ausente
 * ou mal formatada (ex.: \n da FIREBASE_PRIVATE_KEY) derrubava o processo
 * inteiro com `process.exit(1)` — login, pagamentos e solicitações também
 * paravam de funcionar, mesmo sem nenhuma relação com o chat.
 * Agora a falta de configuração deixa APENAS o chat em tempo real
 * indisponível (erro 503 claro nas rotas de mensagens), sem afetar o resto
 * da API. Isso isola o ponto único de falha que causava quedas totais do
 * backend em produção.
 */

const requiredEnvVars = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_DATABASE_URL']
const missing = requiredEnvVars.filter((key) => !process.env[key])
const FIREBASE_CONFIGURED = missing.length === 0

if (!FIREBASE_CONFIGURED) {
  logger.error('firebase:missing_env', { missing })
  console.error(
    `AVISO: variáveis de ambiente do Firebase ausentes: ${missing.join(', ')}.\n` +
    'O chat em tempo real (Firebase Realtime Database) ficará indisponível até ' +
    'isso ser corrigido, mas o restante da API (login, pagamentos, solicitações) ' +
    'continua funcionando normalmente. Configure-as no .env (veja .env.example).'
  )
}

const globalForFirebase = globalThis

let app = null

if (FIREBASE_CONFIGURED) {
  try {
    // A private key vem do .env com "\n" literais (escapados) — precisam virar quebras de linha reais.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')

    app =
      globalForFirebase.__firebaseAdminApp ??
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      })

    if (process.env.NODE_ENV !== 'production') {
      globalForFirebase.__firebaseAdminApp = app
    }

    logger.info('firebase:initialized', { projectId: process.env.FIREBASE_PROJECT_ID })
  } catch (err) {
    // Credenciais presentes mas inválidas (ex.: chave privada corrompida/mal escapada).
    // Mesma filosofia: degrada só o chat, não derruba o processo.
    app = null
    logger.error('firebase:init_failed', { error: err.message, stack: err.stack })
    console.error(`ERRO ao inicializar o Firebase Admin SDK: ${err.message}\nO chat em tempo real ficará indisponível.`)
  }
}

/**
 * Proxy que substitui `rtdb`/`firebaseAdmin` quando o Firebase não está
 * configurado/disponível. Qualquer uso (ex.: `rtdb.ref(...)`) lança um erro
 * cuja mensagem contém "Firebase" — os controllers de mensagens já detectam
 * esse padrão e respondem 503 ao cliente, em vez de um 500 genérico ou,
 * antes desta correção, derrubar o servidor inteiro.
 */
function createUnavailableProxy(label) {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          `Firebase ${label} não está configurado ou falhou ao iniciar — o chat em tempo real está temporariamente indisponível.`
        )
      },
    },
  )
}

export { FIREBASE_CONFIGURED }
export const firebaseAdmin = app ? admin : createUnavailableProxy('Admin SDK')
export const rtdb = app ? app.database() : createUnavailableProxy('Realtime Database')
