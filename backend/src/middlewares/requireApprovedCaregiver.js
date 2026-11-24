import { getUserById } from '../repositories/userRepository.js'
import { VERIFICATION_STATUS } from '../services/verificationDomain.js'

/**
 * Cuidador só vê e assume solicitações depois que a equipe aprova a
 * verificação (documentos + antecedentes). Use depois de requireRole('CUIDADOR').
 */
export async function requireApprovedCaregiver(req, res, next) {
  try {
    const user = await getUserById(req.userId)
    if (!user) return res.status(404).json({ msg: 'Usuário não encontrado.' })
    if (user.verificationStatus === VERIFICATION_STATUS.APROVADO) return next()
    return res.status(403).json({
      msg: 'Conclua sua verificação de documentos e antecedentes para receber solicitações.',
      code: 'VERIFICATION_REQUIRED',
      verificationStatus: user.verificationStatus ?? VERIFICATION_STATUS.NAO_ENVIADO,
    })
  } catch {
    return res.status(500).json({ msg: 'Erro ao verificar seu cadastro.' })
  }
}
