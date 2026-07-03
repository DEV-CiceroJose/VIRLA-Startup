import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { firebaseAuth, googleProvider } from './firebase'

/** Cria conta por e-mail/senha e dispara o e-mail de verificação. */
export async function registerWithEmail(email, senha) {
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, senha)
  await sendEmailVerification(cred.user)
  return cred.user
}

export async function loginWithEmail(email, senha) {
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, senha)
  return cred.user
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(firebaseAuth, googleProvider)
  return cred.user
}

export function resetPassword(email) {
  return sendPasswordResetEmail(firebaseAuth, email)
}

export function logout() {
  return signOut(firebaseAuth)
}

export function resendVerification() {
  if (!firebaseAuth.currentUser) return Promise.resolve()
  return sendEmailVerification(firebaseAuth.currentUser)
}

/** Recarrega o usuário e devolve o estado atual de emailVerified. */
export async function reloadUser() {
  if (!firebaseAuth.currentUser) return false
  await firebaseAuth.currentUser.reload()
  return firebaseAuth.currentUser.emailVerified === true
}

/** ID token atual (renovado pelo SDK). `forceRefresh` recarrega custom claims. */
export function getIdToken(forceRefresh = false) {
  const u = firebaseAuth.currentUser
  return u ? u.getIdToken(forceRefresh) : Promise.resolve(null)
}

export function onAuthChange(cb) {
  return onAuthStateChanged(firebaseAuth, cb)
}

const MESSAGES = {
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente em alguns minutos.',
  'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
  'auth/invalid-credential': 'Credenciais inválidas.',
  'auth/wrong-password': 'Credenciais inválidas.',
  'auth/user-not-found': 'Credenciais inválidas.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
  'auth/popup-blocked': 'Habilite pop-ups para entrar com o Google.',
}

/** Mensagem pt-BR para um código de erro do Firebase Auth. '' = silencioso. */
export function mapAuthError(code) {
  if (code in MESSAGES) return MESSAGES[code]
  return 'Não foi possível concluir. Tente novamente.'
}
