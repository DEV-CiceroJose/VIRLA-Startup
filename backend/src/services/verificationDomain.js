/**
 * Regras da verificação de cuidadores (documentos + antecedentes).
 *
 * Fluxo: o cuidador envia documento com foto, selfie com o documento e a
 * certidão de antecedentes criminais (com o código de validação), e declara
 * que as informações são verdadeiras. A equipe VIRLA confere — inclusive a
 * autenticidade da certidão no site do órgão emissor — e aprova ou reprova.
 * Só cuidadores APROVADOS aparecem no feed e recebem solicitações.
 *
 * Módulo puro (sem Firestore/disco) para ser testado isoladamente.
 */

export const VERIFICATION_STATUS = Object.freeze({
  NAO_ENVIADO: 'NAO_ENVIADO',
  EM_ANALISE: 'EM_ANALISE',
  APROVADO: 'APROVADO',
  REPROVADO: 'REPROVADO',
})

export const DOCUMENT_KINDS = Object.freeze(['identity', 'selfie', 'criminalRecord'])

export const DOCUMENT_LABELS = Object.freeze({
  identity: 'Documento com foto',
  selfie: 'Selfie com o documento',
  criminalRecord: 'Certidão de antecedentes criminais',
})

export const DOCUMENT_MIMES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024

/** A certidão precisa ser recente: emitida há no máximo 90 dias. */
export const CRIMINAL_RECORD_MAX_AGE_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

export function normalizeStatus(status) {
  return Object.values(VERIFICATION_STATUS).includes(status) ? status : VERIFICATION_STATUS.NAO_ENVIADO
}

/** Documentos só podem ser trocados antes do envio ou depois de uma reprovação. */
export function canEditDocuments(status) {
  const s = normalizeStatus(status)
  return s === VERIFICATION_STATUS.NAO_ENVIADO || s === VERIFICATION_STATUS.REPROVADO
}

export function missingDocuments(documents = {}) {
  return DOCUMENT_KINDS.filter((kind) => !documents?.[kind]?.file)
}

/** Dias desde a emissão (data AAAA-MM-DD, sem fuso) até `now`. */
export function daysSince(isoDate, now = new Date()) {
  const [y, m, d] = String(isoDate || '').split('-').map(Number)
  if (!y || !m || !d) return null
  const issued = Date.UTC(y, m - 1, d)
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((today - issued) / DAY_MS)
}

/**
 * Confere se a verificação pode ir para análise.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateSubmission({ status, documents, criminalRecordIssuedAt, now = new Date() }) {
  if (!canEditDocuments(status)) {
    return { ok: false, error: 'Sua verificação já foi enviada.' }
  }
  const missing = missingDocuments(documents)
  if (missing.length > 0) {
    return { ok: false, error: `Envie: ${missing.map((k) => DOCUMENT_LABELS[k].toLowerCase()).join(', ')}.` }
  }
  const age = daysSince(criminalRecordIssuedAt, now)
  if (age === null) return { ok: false, error: 'Informe a data de emissão da certidão.' }
  if (age < 0) return { ok: false, error: 'A data de emissão da certidão não pode ser no futuro.' }
  if (age > CRIMINAL_RECORD_MAX_AGE_DAYS) {
    return { ok: false, error: `A certidão precisa ter sido emitida nos últimos ${CRIMINAL_RECORD_MAX_AGE_DAYS} dias.` }
  }
  return { ok: true }
}

/** Revisão só acontece sobre verificações em análise. */
export function canReview(status) {
  return normalizeStatus(status) === VERIFICATION_STATUS.EM_ANALISE
}

/** Famílias só veem (e só recebem contato de) cuidadores aprovados. */
export function isCaregiverVisible(user) {
  if (!user || user.role !== 'CUIDADOR') return true
  return user.verificationStatus === VERIFICATION_STATUS.APROVADO
}

/** Resumo seguro para o próprio cuidador (sem caminhos de arquivo). */
export function ownerView(verification) {
  const v = verification ?? {}
  const documents = Object.fromEntries(
    DOCUMENT_KINDS.map((kind) => [kind, v.documents?.[kind]?.file
      ? { sent: true, mime: v.documents[kind].mime, uploadedAt: v.documents[kind].uploadedAt ?? null }
      : { sent: false }]),
  )
  return {
    status: normalizeStatus(v.status),
    documents,
    criminalRecordCode: v.criminalRecordCode ?? null,
    criminalRecordIssuedAt: v.criminalRecordIssuedAt ?? null,
    submittedAt: v.submittedAt ?? null,
    reviewedAt: v.reviewedAt ?? null,
    rejectionReason: v.rejectionReason ?? null,
  }
}
