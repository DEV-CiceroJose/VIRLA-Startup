import prisma from '../lib/prisma.js'

/**
 * Restringe rota a papéis permitidos (ex.: só CUIDADOR gera cobrança).
 */
export function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } })
      if (!user) {
        return res.status(404).json({ msg: 'Usuário não encontrado.' })
      }
      if (!roles.includes(user.role)) {
        return res.status(403).json({ msg: 'Você não tem permissão para esta ação.' })
      }
      next()
    } catch {
      return res.status(500).json({ msg: 'Erro ao verificar permissão.' })
    }
  }
}
