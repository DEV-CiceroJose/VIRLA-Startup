import jwt from 'jsonwebtoken'
import { authLogger } from '../lib/logger.js'

const checkToken = (req, res, next) => {
  const authHeader = req.headers['authorization']

  if (!authHeader) {
    authLogger.warn('http:auth_missing', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    })
    return res.status(401).json({ msg: 'Token não fornecido' })
  }

  const token = authHeader.split(' ')[1]

  if (!token) {
    authLogger.warn('http:auth_malformed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    })
    return res.status(401).json({ msg: 'Formato de token inválido' })
  }

  try {
    const decoded = jwt.verify(token, process.env.SECRET)
    req.userId = decoded.id ?? decoded.userId ?? decoded.sub

    authLogger.info('http:auth_ok', {
      userId: req.userId,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    })

    next()
  } catch (err) {
    authLogger.warn('http:auth_invalid', {
      error: err.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    })
    return res.status(401).json({ msg: 'Token inválido ou expirado' })
  }
}

export { checkToken }
export default checkToken