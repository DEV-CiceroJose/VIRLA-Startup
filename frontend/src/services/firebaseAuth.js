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
  // Sem Firebase configurado/inicializado: não há o que autenticar —
  // o chat opera em modo HTTP (fallback).
  if (!isFirebaseReady() || !firebaseAuth) return null
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser

  const meuToken = localStorage.getItem('meuToken')
  if (!meuToken) return null

  const { data } = await api.get('/firebase/token')
  const credential = await signInWithCustomToken(firebaseAuth, data.token)
  return credential.user
}

export async function disconnectFirebaseAuth() {
  if (firebaseAuth?.currentUser) {
    await signOut(firebaseAuth)
  }
}
