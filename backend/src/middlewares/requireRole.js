import { getUserById } from '../repositories/userRepository.js'

/**
 * Restringe rota a papéis permitidos (ex.: só CUIDADOR gera cobrança).
 */
export function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      // O papel já vem no JWT (definido no login) — evita um round-trip ao
      // Firestore por request. Fallback: tokens antigos (sem role) ainda leem
      // o banco, então a transição não quebra sessões existentes.
      let role = req.userRole
      if (!role) {
        const user = await getUserById(req.userId)
        if (!user) {
          return res.status(404).json({ msg: 'Usuário não encontrado.' })
        }
        role = user.role
      }
      if (!roles.includes(role)) {
        return res.status(403).json({ msg: 'Você não tem permissão para esta ação.' })
      }
      next()
    } catch {
      return res.status(500).json({ msg: 'Erro ao verificar permissão.' })
    }
  }
}
