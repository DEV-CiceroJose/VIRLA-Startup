import { initializeApp, getApps, getApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth } from 'firebase/auth'

const ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]

function readFirebaseConfig() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  }

  // storageBucket e messagingSenderId são opcionais, mas ajudam o Auth a resolver o projeto.
  const missing = ENV_KEYS.filter((key) => !import.meta.env[key])
  return { config, missing, isValid: missing.length === 0 }
}

let firebaseApp = null
let rtdb = null
let firebaseAuth = null
let initError = null

const { config, missing, isValid } = readFirebaseConfig()

if (!isValid) {
  initError = new Error(
    `Firebase não configurado. Variáveis ausentes: ${missing.join(', ')}. Copie frontend/.env.example para frontend/.env.`,
  )
  console.error('[Firebase]', initError.message)
} else {
  try {
    firebaseApp = getApps().length ? getApp() : initializeApp(config)
    rtdb = getDatabase(firebaseApp)
    firebaseAuth = getAuth(firebaseApp)
  } catch (err) {
    initError = err
    console.error('[Firebase] Falha ao inicializar:', err)
  }
}

/** Indica se o RTDB e Auth estão prontos para uso. */
export function isFirebaseReady() {
  return Boolean(rtdb && firebaseAuth && !initError)
}

/** Mensagem amigável quando a inicialização falhou (null se OK). */
export function getFirebaseInitError() {
  return initError?.message ?? null
}

export { rtdb, firebaseAuth }
export default firebaseApp
