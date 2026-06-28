import { initializeApp, getApps, getApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth } from 'firebase/auth'

// ─── Config do Firebase (preencher via .env — ver .env.example) ────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// CORREÇÃO (tela branca): antes, `getDatabase()` era chamado direto no import.
// Sem o arquivo .env, as variáveis ficavam `undefined`, a inicialização
// quebrava e o app inteiro caía ao abrir o Chat. Agora validamos a config e,
// se faltar algo, NÃO inicializamos — o chat cai no fallback HTTP via
// `isFirebaseReady()` em vez de derrubar a página.
const REQUIRED_KEYS = ['apiKey', 'databaseURL', 'projectId', 'appId']
const missingKeys = REQUIRED_KEYS.filter((k) => !firebaseConfig[k])

/** true só quando há configuração suficiente para inicializar o RTDB/Auth. */
export function isFirebaseReady() {
  return missingKeys.length === 0
}

let firebaseApp = null
let rtdb = null
let firebaseAuth = null

if (isFirebaseReady()) {
  try {
    // Evita "Firebase App named '[DEFAULT]' already exists" no hot-reload do Vite.
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
    rtdb = getDatabase(firebaseApp)
    firebaseAuth = getAuth(firebaseApp)
  } catch (err) {
    // Config presente mas inválida: degrada para fallback HTTP, nunca crasha.
    console.error('[Firebase] Falha ao inicializar — chat em modo HTTP:', err)
    firebaseApp = null
    rtdb = null
    firebaseAuth = null
  }
} else if (import.meta.env.DEV) {
  console.warn(
    '[Firebase] Variáveis ausentes:', missingKeys.join(', '),
    '— chat em modo de contingência (HTTP).'
  )
}

export { rtdb, firebaseAuth }
export default firebaseApp
