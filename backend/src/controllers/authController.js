import { getUserById as findUserById } from '../repositories/userRepository.js'
import { project } from '../repositories/_helpers.js'
import { logger } from '../lib/logger.js'
import { USER_PUBLIC_SELECT, USER_SELF_SELECT } from '../lib/userSelects.js'

export const getUserById = async (req, res) => {
  try {
    const isSelf = req.userId === req.params.id
    const fullUser = await findUserById(req.params.id)
    if (!fullUser) {
      return res.status(404).json({ msg: 'Usuário não encontrado!' })
    }
    if (!isSelf && fullUser.role === 'FAMILIAR') {
      const requester = await findUserById(req.userId)
      if (requester?.role === 'CUIDADOR') {
        return res.status(403).json({ msg: 'Acesse este familiar através de uma Solicitação.' })
      }
    }
    const user = project(fullUser, isSelf ? USER_SELF_SELECT : USER_PUBLIC_SELECT)
    res.status(200).json({ user })
  } catch (error) {
    logger.error('user:get_by_id_failed', {
      error: error.message, stack: error.stack, userId: req.userId,
      targetId: req.params.id, endpoint: req.originalUrl,
    })
    res.status(500).json({ error: 'Erro interno ao buscar usuário' })
  }
}

/**
 * GET /users/me — perfil do usuário autenticado, ou 404 se ainda não criou
 * (usado pelo frontend para decidir se manda para "Completar cadastro").
 * Usa checkTokenAllowUnverified: precisa responder mesmo antes da verificação
 * de e-mail (o modal de verificação vive no frontend).
 */
export const getCurrentUser = async (req, res) => {
  try {
    const fullUser = await findUserById(req.userId)
    if (!fullUser) {
      return res.status(404).json({ msg: 'Perfil não encontrado.' })
    }
    res.status(200).json({ user: project(fullUser, USER_SELF_SELECT) })
  } catch (error) {
    logger.error('user:get_me_failed', { error: error.message, stack: error.stack, userId: req.userId })
    res.status(500).json({ error: 'Erro interno ao buscar perfil' })
  }
}
