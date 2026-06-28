import { signInWithCustomToken, signOut } from 'firebase/auth'
import { firebaseAuth, isFirebaseReady } from './firebase'
import api from './api'

/**
 * Autentica o usuário no Firebase Auth usando um Custom Token emitido pelo
 * backend (GET /firebase/token, protegido pelo mesmo JWT da sessão).
 * Necessário para que as Security Rules do Realtime Database liberem
 * leitura/escrita em `chats/{chatId}` (elas exigem `auth.uid`).
 *
 * Idempotente: se já houver um usuário do Firebase logado, não repete a troca de token.
 */
export async function connectFirebaseAuth() {
  if (!isFirebaseReady() || !firebaseAuth) {
    throw new Error('Firebase Auth não está disponível. Verifique as variáveis VITE_FIREBASE_* no .env.')
  }

  if (firebaseAuth.currentUser) return firebaseAuth.currentUser

  const meuToken = localStorage.getItem('meuToken')
  if (!meuToken) return null

  const { data } = await api.get('/firebase/token')
  if (!data?.token) {
    throw new Error('Servidor não retornou token Firebase.')
  }

  try {
    const credential = await signInWithCustomToken(firebaseAuth, data.token)
    return credential.user
  } catch (err) {
    if (err?.code === 'auth/configuration-not-found') {
      throw new Error(
        'Firebase Authentication não está habilitado no projeto. ' +
          'No Firebase Console, abra Authentication > Começar e publique as rules de ' +
          'backend/firebase.rules.json no Realtime Database.',
      )
    }
    throw err
  }
}

export async function disconnectFirebaseAuth() {
  if (firebaseAuth?.currentUser) {
    await signOut(firebaseAuth)
  }
}
