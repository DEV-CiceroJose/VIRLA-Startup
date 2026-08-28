import admin from 'firebase-admin'
import { logger } from './logger.js'

/**
 * Inicialização do Firebase Admin SDK — usado por:
 *  - checkToken.js (verificação do ID token do Firebase Auth em toda
 *    requisição autenticada; substituiu o login/JWT próprio)
 *  - chatRealtimeService.js (leitura/escrita administrativa no Realtime Database)
 *
 * Migração de autenticação: o backend não emite mais tokens próprios
 * (JWT/bcrypt) — a verificação de identidade depende inteiramente do
 * Admin SDK validando o ID token emitido pelo Firebase Auth no cliente.
 * O Realtime Database também substitui o Mongo/Prisma como armazenamento
 * das mensagens de chat, permitindo sincronização em tempo real nativa
 * (sem depender de Socket.io para a entrega das mensagens).
 *
 * CORREÇÃO (falha em cascata): antes, qualquer variável FIREBASE_* ausente
 * ou mal formatada (ex.: \n da FIREBASE_PRIVATE_KEY) derrubava o processo
 * inteiro com `process.exit(1)`. Agora a falta de configuração não derruba
 * o processo, mas deixa tanto a autenticação quanto o chat em tempo real
 * indisponíveis (erro claro nas rotas afetadas), já que ambos dependem do
 * Admin SDK.
 */

const USING_FIREBASE_EMULATORS = process.env.NODE_ENV !== 'production'
  && Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)
  && Boolean(process.env.FIRESTORE_EMULATOR_HOST)

const requiredEnvVars = USING_FIREBASE_EMULATORS
  ? ['FIREBASE_PROJECT_ID']
  : ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_DATABASE_URL']
const missing = requiredEnvVars.filter((key) => !process.env[key])
const FIREBASE_CONFIGURED = missing.length === 0

if (!FIREBASE_CONFIGURED) {
  logger.error('firebase:missing_env', { missing })
  console.error(
    `AVISO: variáveis de ambiente do Firebase ausentes: ${missing.join(', ')}.\n` +
    'Autenticação (verificação de ID token) e o chat em tempo real ficarão ' +
    'indisponíveis até isso ser corrigido. Configure-as no .env (veja .env.example).'
  )
}

const globalForFirebase = globalThis

let app = null

if (FIREBASE_CONFIGURED) {
  try {
    // A private key vem do .env com "\n" literais (escapados) — precisam virar quebras de linha reais.
    const privateKey = USING_FIREBASE_EMULATORS
      ? null
      : process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')

    const firebaseOptions = USING_FIREBASE_EMULATORS
      ? {
          projectId: process.env.FIREBASE_PROJECT_ID,
          databaseURL: process.env.FIREBASE_DATABASE_URL,
        }
      : {
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
          }),
          databaseURL: process.env.FIREBASE_DATABASE_URL,
        }

    app =
      globalForFirebase.__firebaseAdminApp ??
      admin.initializeApp(firebaseOptions)

    if (process.env.NODE_ENV !== 'production') {
      globalForFirebase.__firebaseAdminApp = app
    }

    logger.info('firebase:initialized', {
      projectId: process.env.FIREBASE_PROJECT_ID,
      emulators: USING_FIREBASE_EMULATORS,
    })
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

export { FIREBASE_CONFIGURED, USING_FIREBASE_EMULATORS }
export const firebaseAdmin = app ? admin : createUnavailableProxy('Admin SDK')
export const rtdb = app ? app.database() : createUnavailableProxy('Realtime Database')
