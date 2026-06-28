import { initializeApp, getApps, getApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth } from 'firebase/auth'

// ─── Config do Firebase (preencher via .env — ver .env.example) ────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Evita "Firebase App named '[DEFAULT]' already exists" no hot-reload do Vite.
const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const rtdb = getDatabase(firebaseApp)
export const firebaseAuth = getAuth(firebaseApp)
export default firebaseApp
