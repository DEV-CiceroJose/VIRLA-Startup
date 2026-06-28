import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { authLogger, logger } from '../lib/logger.js'
import { USER_PUBLIC_SELECT, USER_SELF_SELECT } from '../lib/userSelects.js'

/** Tempo de vida do token de sessão (configurável via env). */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

export const getUserById = async (req, res) => {
  try {
    // PII (email/cpf) só é devolvido quando o usuário consulta o PRÓPRIO perfil.
    // Para perfis de terceiros (feed, página de cuidador) usamos o select público.
    const isSelf = req.userId === req.params.id
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: isSelf ? USER_SELF_SELECT : USER_PUBLIC_SELECT,
    })

    if (!user) {
      return res.status(404).json({ msg: 'Usuário não encontrado!' })
    }

    // Sprint 4: Cuidador não navega mais por perfis de Familiar diretamente —
    // o acesso passa a ser mediado pelas Solicitações (/solicitacoes).
    if (!isSelf && user.role === 'FAMILIAR') {
      const requester = await prisma.user.findUnique({ where: { id: req.userId } })
      if (requester?.role === 'CUIDADOR') {
        return res.status(403).json({ msg: 'Acesse este familiar através de uma Solicitação.' })
      }
    }

    res.status(200).json({ user })
  } catch (error) {
    logger.error('user:get_by_id_failed', {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      targetId: req.params.id,
      endpoint: req.originalUrl,
    })
    res.status(500).json({ error: 'Erro interno ao buscar usuário' })
  }
}

/** Body validado por loginBodySchema. */
const LoginUser = async (req, res) => {
  const { email, password } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    // Resposta genérica idêntica para "usuário inexistente" e "senha errada":
    // evita enumeração de contas (account enumeration).
    const checkPassword = user ? await bcrypt.compare(password, user.password) : false
    if (!user || !checkPassword) {
      authLogger.warn('auth:login_failed', {
        email,
        ip: req.ip,
        reason: user ? 'invalid_password' : 'user_not_found',
        timestamp: new Date().toISOString(),
      })
      return res.status(401).json({ msg: 'Credenciais inválidas.' })
    }

    const token = jwt.sign({ id: user.id }, process.env.SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    })

    authLogger.info('auth:login_success', {
      userId: user.id,
      role: user.role,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    })

    res.status(200).json({
      msg: 'Autenticação realizada com sucesso!',
      token,
      user: { id: user.id, name: user.name, role: user.role },
    })
  } catch (error) {
    logger.error('auth:login_error', {
      error: error.message,
      stack: error.stack,
      endpoint: req.originalUrl,
    })
    res.status(500).json({ msg: 'Erro ao realizar login.' })
  }
}

export { LoginUser }
