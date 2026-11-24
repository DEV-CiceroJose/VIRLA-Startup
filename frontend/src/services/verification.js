import api from './api'

/** Chamadas da verificação de cuidadores (documentos + antecedentes). */

export const DOCUMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024
export const CRIMINAL_RECORD_MAX_AGE_DAYS = 90
/** Emissão gratuita da certidão de antecedentes criminais da Polícia Federal. */
export const PF_CERTIDAO_URL = 'https://servicos.pf.gov.br/epol-sinic-publico/'

export async function getMyVerification() {
  const { data } = await api.get('/verification/me')
  return data.verification
}

export async function uploadVerificationDocument(kind, file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post(`/verification/documents/${kind}`, form)
  return data.verification
}

export async function submitVerification(body) {
  const { data } = await api.post('/verification/submit', body)
  return data.verification
}

/** Baixa o documento autenticado (Blob com o tipo do arquivo). */
export async function fetchDocument(userId, kind) {
  const { data } = await api.get(`/verification/documents/${userId}/${kind}`, { responseType: 'blob' })
  return data
}

/** URL local (blob:) do documento, para abrir em outra aba. */
export async function documentObjectUrl(userId, kind) {
  return URL.createObjectURL(await fetchDocument(userId, kind))
}

export async function listVerifications(status) {
  const { data } = await api.get('/admin/verifications', { params: { status } })
  return data.verifications
}

export async function approveVerification(userId) {
  const { data } = await api.post(`/admin/verifications/${userId}/approve`)
  return data.verification
}

export async function rejectVerification(userId, reason) {
  const { data } = await api.post(`/admin/verifications/${userId}/reject`, { reason })
  return data.verification
}
