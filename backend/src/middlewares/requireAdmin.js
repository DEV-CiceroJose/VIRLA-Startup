import { securityLogger } from '../lib/logger.js'

/**
 * Restringe a rota à equipe VIRLA. O papel de admin é um custom claim
 * (`admin: true`) do Firebase, definido só pelo script
 * `scripts/set-admin.js` — nunca pelo próprio usuário.
 */
export function requireAdmin(req, res, next) {
  if (req.isAdmin === true) return next()
  securityLogger.warn('admin:forbidden', { userId: req.userId, path: req.path, ip: req.ip })
  return res.status(403).json({ msg: 'Acesso restrito à equipe VIRLA.', code: 'ADMIN_ONLY' })
}
