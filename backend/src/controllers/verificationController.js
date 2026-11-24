import { getUserById, updateUser, listByIds } from '../repositories/userRepository.js'
import { getVerification, upsertVerification, listVerificationsByStatus } from '../repositories/verificationRepository.js'
import { saveDocument, readDocument, removeDocument } from '../services/verificationStorage.js'
import {
  VERIFICATION_STATUS,
  canEditDocuments,
  canReview,
  validateSubmission,
  ownerView,
  normalizeStatus,
  DOCUMENT_KINDS,
} from '../services/verificationDomain.js'
import { notifyVerification } from '../services/notificationService.js'
import { listVerificationsQuerySchema } from '../schemas/verificationSchemas.js'
import { logger, securityLogger } from '../lib/logger.js'

/** GET /verification/me — situação da verificação do cuidador logado. */
export const getMyVerification = async (req, res) => {
  try {
    const verification = await getVerification(req.userId)
    return res.status(200).json({ verification: ownerView(verification) })
  } catch (err) {
    logger.error('verification:get_failed', { error: err.message, userId: req.userId })
    return res.status(500).json({ msg: 'Erro ao buscar sua verificação.' })
  }
}

/** POST /verification/documents/:kind — envia/troca um documento (multipart "file"). */
export const uploadDocument = async (req, res) => {
  const { kind } = req.params
  if (!req.file) return res.status(422).json({ msg: 'Selecione um arquivo.' })
  try {
    const current = await getVerification(req.userId)
    if (!canEditDocuments(current?.status)) {
      return res.status(409).json({ msg: 'Sua verificação já foi enviada; aguarde a análise.' })
    }
    const file = await saveDocument(req.userId, kind, req.file.buffer)
    const previous = current?.documents?.[kind]?.file
    const updated = await upsertVerification(req.userId, {
      status: normalizeStatus(current?.status),
      documents: { ...(current?.documents ?? {}), [kind]: { file, mime: req.file.mimetype, size: req.file.size, uploadedAt: new Date() } },
    })
    if (previous && previous !== file) await removeDocument(previous)
    securityLogger.info('verification:document_uploaded', { userId: req.userId, kind })
    return res.status(200).json({ verification: ownerView(updated) })
  } catch (err) {
    logger.error('verification:upload_failed', { error: err.message, userId: req.userId, kind })
    return res.status(500).json({ msg: 'Não foi possível salvar o documento.' })
  }
}

/** POST /verification/submit — manda para análise da equipe. */
export const submitVerification = async (req, res) => {
  const { criminalRecordCode, criminalRecordIssuedAt } = req.body
  try {
    const current = await getVerification(req.userId)
    const check = validateSubmission({ status: current?.status, documents: current?.documents, criminalRecordIssuedAt })
    if (!check.ok) return res.status(422).json({ msg: check.error })

    const updated = await upsertVerification(req.userId, {
      status: VERIFICATION_STATUS.EM_ANALISE,
      criminalRecordCode,
      criminalRecordIssuedAt,
      declarationAcceptedAt: new Date(),
      submittedAt: new Date(),
      rejectionReason: null,
    })
    await updateUser(req.userId, { verificationStatus: VERIFICATION_STATUS.EM_ANALISE })
    securityLogger.info('verification:submitted', { userId: req.userId })
    return res.status(200).json({ verification: ownerView(updated) })
  } catch (err) {
    logger.error('verification:submit_failed', { error: err.message, userId: req.userId })
    return res.status(500).json({ msg: 'Não foi possível enviar sua verificação.' })
  }
}

/** GET /verification/documents/:userId/:kind — o próprio cuidador ou a equipe. */
export const getDocument = async (req, res) => {
  const { userId, kind } = req.params
  if (req.userId !== userId && req.isAdmin !== true) {
    securityLogger.warn('verification:document_forbidden', { userId: req.userId, targetId: userId, kind, ip: req.ip })
    return res.status(403).json({ msg: 'Você não tem acesso a este documento.' })
  }
  try {
    const verification = await getVerification(userId)
    const doc = verification?.documents?.[kind]
    if (!doc?.file) return res.status(404).json({ msg: 'Documento não encontrado.' })
    const buffer = await readDocument(doc.file)
    if (req.isAdmin === true && req.userId !== userId) {
      securityLogger.info('verification:document_viewed_by_admin', { adminId: req.userId, targetId: userId, kind })
    }
    res.setHeader('Content-Type', doc.mime)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.status(200).send(buffer)
  } catch (err) {
    logger.error('verification:document_read_failed', { error: err.message, userId: req.userId, targetId: userId, kind })
    return res.status(500).json({ msg: 'Não foi possível abrir o documento.' })
  }
}

// ─── Equipe VIRLA ────────────────────────────────────────────────────────

/** GET /admin/verifications?status=EM_ANALISE */
export const adminListVerifications = async (req, res) => {
  const parsed = listVerificationsQuerySchema.safeParse(req.query ?? {})
  if (!parsed.success) return res.status(422).json({ msg: 'Filtro inválido.' })
  try {
    const items = await listVerificationsByStatus(parsed.data.status)
    const users = new Map((await listByIds(items.map((v) => v.id))).map((u) => [u.id, u]))
    const verifications = items
      .map((v) => {
        const u = users.get(v.id)
        return {
          userId: v.id,
          name: u?.name ?? '—',
          email: u?.email ?? null,
          cpf: u?.cpf ?? null,
          birthDate: u?.birthDate ?? null,
          profileImage: u?.profileImage ?? null,
          council: u?.council ?? null,
          registerNumber: u?.registerNumber ?? null,
          city: u?.city ?? null,
          state: u?.state ?? null,
          ...ownerView(v),
          reviewedBy: v.reviewedBy ?? null,
          documentKinds: DOCUMENT_KINDS.filter((k) => v.documents?.[k]?.file),
        }
      })
      .sort((a, b) => new Date(a.submittedAt ?? 0) - new Date(b.submittedAt ?? 0))
    return res.status(200).json({ verifications })
  } catch (err) {
    logger.error('verification:admin_list_failed', { error: err.message, userId: req.userId })
    return res.status(500).json({ msg: 'Erro ao listar verificações.' })
  }
}

async function review(req, res, approve) {
  const { userId } = req.params
  try {
    const [verification, user] = await Promise.all([getVerification(userId), getUserById(userId)])
    if (!verification || !user) return res.status(404).json({ msg: 'Verificação não encontrada.' })
    if (!canReview(verification.status)) {
      return res.status(409).json({ msg: 'Esta verificação não está em análise.' })
    }
    const status = approve ? VERIFICATION_STATUS.APROVADO : VERIFICATION_STATUS.REPROVADO
    const updated = await upsertVerification(userId, {
      status,
      reviewedAt: new Date(),
      reviewedBy: req.userId,
      rejectionReason: approve ? null : req.body.reason,
    })
    await updateUser(userId, { verificationStatus: status })
    securityLogger.info(approve ? 'verification:approved' : 'verification:rejected', { adminId: req.userId, targetId: userId })
    try {
      await notifyVerification(req.app.get('io'), {
        userId,
        type: approve ? 'VERIFICACAO_APROVADA' : 'VERIFICACAO_REPROVADA',
      })
    } catch (e) {
      logger.warn('verification:notify_failed', { error: e.message, targetId: userId })
    }
    return res.status(200).json({ verification: ownerView(updated) })
  } catch (err) {
    logger.error('verification:review_failed', { error: err.message, userId: req.userId, targetId: userId })
    return res.status(500).json({ msg: 'Não foi possível concluir a revisão.' })
  }
}

/** POST /admin/verifications/:userId/approve */
export const adminApprove = (req, res) => review(req, res, true)
/** POST /admin/verifications/:userId/reject { reason } */
export const adminReject = (req, res) => review(req, res, false)
