import { db } from '../lib/firestore.js'
import { mapDoc, nowTs } from './_helpers.js'
import { calculateChargeTotalCents } from '../utils/paymentFees.js'
import { createReportHash, ServiceReportError } from '../services/serviceReportDomain.js'

const reportsCol = () => db.collection('serviceReports')
const solicitacoesCol = () => db.collection('solicitacoes')

export async function getById(id) {
  if (!id) return null
  return mapDoc(await reportsCol().doc(id).get())
}

export async function getBySolicitacaoId(solicitacaoId) {
  return getById(solicitacaoId)
}

export async function createForSolicitacao(data) {
  const reportRef = reportsCol().doc(data.solicitacaoId)
  const solicitacaoRef = solicitacoesCol().doc(data.solicitacaoId)

  await db.runTransaction(async (tx) => {
    const [reportSnap, solicitacaoSnap] = await Promise.all([
      tx.get(reportRef),
      tx.get(solicitacaoRef),
    ])
    if (reportSnap.exists) {
      throw new ServiceReportError('REPORT_EXISTS', 'Já existe um relatório para esta solicitação.', 409)
    }
    if (!solicitacaoSnap.exists) {
      throw new ServiceReportError('SOLICITACAO_NOT_FOUND', 'Solicitação não encontrada.', 404)
    }
    const solicitacao = solicitacaoSnap.data()
    if (solicitacao.status !== 'EM_ANDAMENTO') {
      throw new ServiceReportError('INVALID_STATUS', 'O relatório só pode ser criado durante um serviço em andamento.', 409)
    }
    if (solicitacao.assignedCaregiverId !== data.caregiverId) {
      throw new ServiceReportError('REPORT_FORBIDDEN', 'Apenas o cuidador responsável pode criar o relatório.', 403)
    }

    const fees = calculateChargeTotalCents(data.baseAmount)
    const now = nowTs()
    tx.set(reportRef, {
      solicitacaoId: data.solicitacaoId,
      caregiverId: data.caregiverId,
      familiarId: solicitacao.familiarId,
      serviceDate: data.serviceDate,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      activities: data.activities,
      observations: data.observations ?? '',
      incidents: data.incidents ?? '',
      baseAmount: fees.baseCents,
      platformFeeCents: fees.platformFeeCents,
      fixedFeeCents: fees.fixedFeeCents,
      totalAmount: fees.totalCents,
      status: 'PENDING_SIGNATURE',
      signature: null,
      reportHash: null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    })
  })

  return getById(data.solicitacaoId)
}

export async function signByFamiliar(reportId, { familiarId, typedName, signerName, ipHash, userAgentHash }) {
  const reportRef = reportsCol().doc(reportId)
  const solicitacaoRef = solicitacoesCol().doc(reportId)

  await db.runTransaction(async (tx) => {
    const [reportSnap, solicitacaoSnap] = await Promise.all([
      tx.get(reportRef),
      tx.get(solicitacaoRef),
    ])
    if (!reportSnap.exists) throw new ServiceReportError('REPORT_NOT_FOUND', 'Relatório não encontrado.', 404)
    const report = { id: reportSnap.id, ...reportSnap.data() }
    if (report.familiarId !== familiarId) {
      throw new ServiceReportError('REPORT_FORBIDDEN', 'Apenas o familiar responsável pode assinar.', 403)
    }
    if (report.status !== 'PENDING_SIGNATURE') {
      throw new ServiceReportError('REPORT_ALREADY_SIGNED', 'Este relatório já foi assinado ou processado.', 409)
    }
    if (!solicitacaoSnap.exists || solicitacaoSnap.data().status !== 'EM_ANDAMENTO') {
      throw new ServiceReportError('INVALID_STATUS', 'O serviço não está mais disponível para confirmação.', 409)
    }

    const when = nowTs()
    const reportHash = createReportHash(report)
    tx.update(reportRef, {
      status: 'SIGNED',
      reportHash,
      signature: {
        signedByUserId: familiarId,
        signedByName: signerName,
        typedName,
        declarationVersion: 'virla-service-confirmation-v1',
        signedAt: when,
        ipHash,
        userAgentHash,
      },
      updatedAt: when,
    })
    tx.update(solicitacaoRef, { status: 'CONCLUIDA', updatedAt: when })
  })

  return getById(reportId)
}

export async function attachCheckout(reportId, session) {
  await reportsCol().doc(reportId).update({
    status: 'PAYMENT_PENDING',
    stripeCheckoutSessionId: session.id,
    stripeCheckoutUrl: session.url,
    updatedAt: nowTs(),
  })
  return getById(reportId)
}

export async function markPaid(reportId, { paymentIntentId, paidAt = new Date() }) {
  if (!reportId) return null
  await reportsCol().doc(reportId).update({
    status: 'PAID',
    stripePaymentIntentId: paymentIntentId ?? null,
    paidAt,
    updatedAt: nowTs(),
  })
  return getById(reportId)
}

export async function markPaymentStatus(reportId, status) {
  if (!reportId) return null
  await reportsCol().doc(reportId).update({ status, updatedAt: nowTs() })
  return getById(reportId)
}

