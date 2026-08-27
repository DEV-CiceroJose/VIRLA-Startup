import crypto from 'crypto'
import { paymentIsDue } from '../utils/paymentSchedule.js'

export class ServiceReportError extends Error {
  constructor(code, message, statusCode = 422) {
    super(message)
    this.name = 'ServiceReportError'
    this.code = code
    this.statusCode = statusCode
  }
}

export function canonicalReportSnapshot(report) {
  return JSON.stringify({
    id: report.id,
    solicitacaoId: report.solicitacaoId,
    caregiverId: report.caregiverId,
    familiarId: report.familiarId,
    serviceDate: report.serviceDate,
    startedAt: report.startedAt,
    endedAt: report.endedAt,
    activities: report.activities,
    observations: report.observations ?? '',
    incidents: report.incidents ?? '',
    contractHourlyRate: report.contractHourlyRate,
    paymentRecurrence: report.paymentRecurrence,
    paymentDueDate: report.paymentDueDate,
    baseAmount: report.baseAmount,
    platformFeeCents: report.platformFeeCents,
    fixedFeeCents: report.fixedFeeCents,
    totalAmount: report.totalAmount,
  })
}

export function createReportHash(report) {
  return crypto.createHash('sha256').update(canonicalReportSnapshot(report)).digest('hex')
}

export function hashAuditValue(value, secret) {
  if (!value || !secret) return null
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex')
}

export function signatureNameMatches(typedName, accountName) {
  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
  return normalize(typedName) !== '' && normalize(typedName) === normalize(accountName)
}

export function assertCheckoutEligible(report, familiarId) {
  if (!report) {
    throw new ServiceReportError('REPORT_NOT_FOUND', 'Relatório não encontrado.', 404)
  }
  if (report.familiarId !== familiarId) {
    throw new ServiceReportError('REPORT_FORBIDDEN', 'Este relatório não pertence a você.', 403)
  }
  if (report.status !== 'SIGNED' && report.status !== 'PAYMENT_PENDING') {
    throw new ServiceReportError(
      'REPORT_NOT_SIGNED',
      'O pagamento só é liberado após a confirmação e assinatura do relatório.',
      409,
    )
  }
  if (!report.signature?.signedAt || !report.reportHash) {
    throw new ServiceReportError('SIGNATURE_INVALID', 'A assinatura auditável do relatório está incompleta.', 409)
  }
  const expectedHash = createReportHash(report)
  const storedHash = String(report.reportHash)
  const validHash = /^[a-f0-9]{64}$/.test(storedHash)
    && crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(expectedHash, 'hex'))
  if (!validHash) {
    throw new ServiceReportError(
      'REPORT_INTEGRITY_INVALID',
      'O conteúdo do relatório não corresponde ao documento assinado.',
      409,
    )
  }
  if (!paymentIsDue(report.paymentDueDate)) {
    const dueDate = new Date(`${report.paymentDueDate}T12:00:00`).toLocaleDateString('pt-BR')
    throw new ServiceReportError(
      'PAYMENT_NOT_DUE',
      `O relatório está assinado, mas o pagamento deste contrato só estará disponível em ${dueDate}.`,
      409,
    )
  }
}
