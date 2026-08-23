import { getUserById } from '../repositories/userRepository.js'
import * as reportRepo from '../repositories/serviceReportRepository.js'
import { hashAuditValue, ServiceReportError, signatureNameMatches } from '../services/serviceReportDomain.js'
import { logger } from '../lib/logger.js'

function handleReportError(err, res, context) {
  if (err instanceof ServiceReportError) {
    return res.status(err.statusCode).json({ msg: err.message, code: err.code })
  }
  logger.error(context, { error: err.message, stack: err.stack })
  return res.status(500).json({ msg: 'Erro interno ao processar o relatório.' })
}

export async function createServiceReport(req, res) {
  try {
    const report = await reportRepo.createForSolicitacao({
      ...req.body,
      caregiverId: req.userId,
    })
    return res.status(201).json({ report })
  } catch (err) {
    return handleReportError(err, res, 'report:create_failed')
  }
}

export async function getReportBySolicitacao(req, res) {
  try {
    const report = await reportRepo.getBySolicitacaoId(req.params.solicitacaoId)
    if (!report) return res.status(200).json({ report: null })
    if (![report.familiarId, report.caregiverId].includes(req.userId)) {
      return res.status(403).json({ msg: 'Acesso negado.' })
    }
    return res.status(200).json({ report })
  } catch (err) {
    return handleReportError(err, res, 'report:get_failed')
  }
}

export async function signServiceReport(req, res) {
  try {
    const signer = await getUserById(req.userId)
    if (!signer) return res.status(404).json({ msg: 'Familiar não encontrado.' })
    if (!signatureNameMatches(req.body.typedName, signer.name)) {
      return res.status(422).json({ msg: 'A assinatura deve corresponder ao nome completo da sua conta VIRLA.' })
    }

    const auditSecret = process.env.SIGNATURE_AUDIT_SECRET
    if (!auditSecret) {
      logger.error('report:audit_secret_missing', { userId: req.userId })
      return res.status(503).json({
        msg: 'A assinatura eletrônica está temporariamente indisponível.',
        code: 'SIGNATURE_AUDIT_NOT_CONFIGURED',
      })
    }
    const report = await reportRepo.signByFamiliar(req.params.reportId, {
      familiarId: req.userId,
      typedName: req.body.typedName,
      signerName: signer.name,
      ipHash: hashAuditValue(req.ip, auditSecret),
      userAgentHash: hashAuditValue(req.headers['user-agent'], auditSecret),
    })
    logger.info('report:signed', { reportId: report.id, userId: req.userId, reportHash: report.reportHash })
    return res.status(200).json({ report })
  } catch (err) {
    return handleReportError(err, res, 'report:sign_failed')
  }
}
