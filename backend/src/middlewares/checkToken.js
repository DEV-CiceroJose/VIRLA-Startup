import { firebaseAdmin } from '../lib/firebase.js'
import { authLogger } from '../lib/logger.js'

/**
 * Factory do middleware de autenticação. Verifica o ID token do Firebase e
 * popula req.userId/userRole/email/emailVerified.
 *
 * @param {(idToken: string) => Promise<object>} verifyIdToken - verificador (injetável p/ testes)
 * @param {{ requireVerified: boolean }} opts - se true, recusa e-mail não verificado (403)
 */
export function makeCheckToken(verifyIdToken, { requireVerified }) {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization']
    if (!authHeader) {
      authLogger.warn('http:auth_missing', { path: req.path, method: req.method, ip: req.ip })
      return res.status(401).json({ msg: 'Token não fornecido' })
    }
    const idToken = authHeader.split(' ')[1]
    if (!idToken) {
      authLogger.warn('http:auth_malformed', { path: req.path, method: req.method, ip: req.ip })
      return res.status(401).json({ msg: 'Formato de token inválido' })
    }

    let decoded
    try {
      decoded = await verifyIdToken(idToken)
    } catch (err) {
      authLogger.warn('http:auth_invalid', { error: err.message, path: req.path, method: req.method, ip: req.ip })
      return res.status(401).json({ msg: 'Token inválido ou expirado' })
    }

    req.userId = decoded.uid
    req.userRole = decoded.role // custom claim; pode ser undefined até o perfil ser criado
    req.email = decoded.email
    req.emailVerified = decoded.email_verified === true

    if (requireVerified && !req.emailVerified) {
      authLogger.warn('http:auth_email_unverified', { userId: req.userId, path: req.path })
      return res.status(403).json({ msg: 'Confirme seu e-mail para continuar.' })
    }

    authLogger.info('http:auth_ok', { userId: req.userId, path: req.path, method: req.method })
    next()
  }
}

/** Verificador real do Firebase Admin. */
const realVerify = (idToken) => firebaseAdmin.auth().verifyIdToken(idToken)

/** Exige e-mail verificado (maioria das rotas). */
export const checkToken = makeCheckToken(realVerify, { requireVerified: true })

/** Verifica o token mas NÃO exige e-mail confirmado (POST /users, GET /users/me). */
export const checkTokenAllowUnverified = makeCheckToken(realVerify, { requireVerified: false })

export default checkToken