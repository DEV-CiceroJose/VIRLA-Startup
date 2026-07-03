import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendEmailVerification = vi.fn(() => Promise.resolve())
const createUserWithEmailAndPassword = vi.fn(() => Promise.resolve({ user: { uid: 'u1' } }))
const signInWithEmailAndPassword = vi.fn(() => Promise.resolve({ user: { uid: 'u1' } }))
const signInWithPopup = vi.fn(() => Promise.resolve({ user: { uid: 'g1' } }))
const sendPasswordResetEmail = vi.fn(() => Promise.resolve())

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: (...a) => createUserWithEmailAndPassword(...a),
  signInWithEmailAndPassword: (...a) => signInWithEmailAndPassword(...a),
  signInWithPopup: (...a) => signInWithPopup(...a),
  sendPasswordResetEmail: (...a) => sendPasswordResetEmail(...a),
  sendEmailVerification: (...a) => sendEmailVerification(...a),
  signOut: vi.fn(() => Promise.resolve()),
  onAuthStateChanged: vi.fn(),
}))
vi.mock('./firebase', () => ({ firebaseAuth: { currentUser: null }, googleProvider: {} }))

import { registerWithEmail, mapAuthError } from './auth'

describe('services/auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registerWithEmail cria a conta e dispara verificação de e-mail', async () => {
    await registerWithEmail('a@b.com', 'segredo1')
    expect(createUserWithEmailAndPassword).toHaveBeenCalled()
    expect(sendEmailVerification).toHaveBeenCalledWith({ uid: 'u1' })
  })

  it('mapAuthError traduz códigos conhecidos e usa mensagem genérica p/ credenciais', () => {
    expect(mapAuthError('auth/email-already-in-use')).toMatch(/já está/i)
    expect(mapAuthError('auth/invalid-credential')).toMatch(/inválid/i)
    expect(mapAuthError('auth/wrong-password')).toMatch(/inválid/i)
    expect(mapAuthError('codigo/desconhecido')).toMatch(/tente novamente|erro/i)
  })
})
