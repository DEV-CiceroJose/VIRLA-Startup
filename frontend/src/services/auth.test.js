import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendEmailVerification = vi.fn(() => Promise.resolve())
const createUserWithEmailAndPassword = vi.fn(() => Promise.resolve({ user: { uid: 'u1' } }))
const signInWithEmailAndPassword = vi.fn(() => Promise.resolve({ user: { uid: 'u1' } }))
const signInWithPopup = vi.fn(() => Promise.resolve({ user: { uid: 'g1' } }))
const sendPasswordResetEmail = vi.fn(() => Promise.resolve())
const linkWithCredential = vi.fn(() => Promise.resolve())
const credentialFn = vi.fn((email, senha) => ({ email, senha, _type: 'cred' }))
const fakeFirebaseAuth = vi.hoisted(() => ({ currentUser: null }))

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: (...a) => createUserWithEmailAndPassword(...a),
  signInWithEmailAndPassword: (...a) => signInWithEmailAndPassword(...a),
  signInWithPopup: (...a) => signInWithPopup(...a),
  sendPasswordResetEmail: (...a) => sendPasswordResetEmail(...a),
  sendEmailVerification: (...a) => sendEmailVerification(...a),
  signOut: vi.fn(() => Promise.resolve()),
  onAuthStateChanged: vi.fn(),
  linkWithCredential: (...a) => linkWithCredential(...a),
  EmailAuthProvider: { credential: (...a) => credentialFn(...a) },
}))
vi.mock('./firebase', () => ({ firebaseAuth: fakeFirebaseAuth, googleProvider: {} }))

import { registerWithEmail, mapAuthError, hasPasswordProvider, linkPassword } from './auth'

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

describe('services/auth · criar senha (AUTH-01)', () => {
  beforeEach(() => { vi.clearAllMocks(); fakeFirebaseAuth.currentUser = null })

  it('hasPasswordProvider é false para conta só-Google', () => {
    fakeFirebaseAuth.currentUser = { providerData: [{ providerId: 'google.com' }] }
    expect(hasPasswordProvider()).toBe(false)
  })

  it('hasPasswordProvider é true quando há provedor password', () => {
    fakeFirebaseAuth.currentUser = { providerData: [{ providerId: 'google.com' }, { providerId: 'password' }] }
    expect(hasPasswordProvider()).toBe(true)
  })

  it('linkPassword vincula credencial de e-mail/senha', async () => {
    fakeFirebaseAuth.currentUser = { email: 'g@x.com', providerData: [{ providerId: 'google.com' }] }
    await linkPassword('segredo123')
    expect(credentialFn).toHaveBeenCalledWith('g@x.com', 'segredo123')
    expect(linkWithCredential).toHaveBeenCalled()
  })
})
