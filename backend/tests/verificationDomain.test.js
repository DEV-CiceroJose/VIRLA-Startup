import test from 'node:test'
import assert from 'node:assert/strict'
import {
  VERIFICATION_STATUS as S,
  canEditDocuments,
  missingDocuments,
  daysSince,
  validateSubmission,
  canReview,
  isCaregiverVisible,
  ownerView,
} from '../src/services/verificationDomain.js'

const allDocs = {
  identity: { file: 'u/identity.enc', mime: 'image/png' },
  selfie: { file: 'u/selfie.enc', mime: 'image/jpeg' },
  criminalRecord: { file: 'u/cr.enc', mime: 'application/pdf' },
}
const now = new Date('2026-11-24T12:00:00Z')

test('documentos só mudam antes do envio ou após reprovação', () => {
  assert.equal(canEditDocuments(undefined), true)
  assert.equal(canEditDocuments(S.NAO_ENVIADO), true)
  assert.equal(canEditDocuments(S.REPROVADO), true)
  assert.equal(canEditDocuments(S.EM_ANALISE), false)
  assert.equal(canEditDocuments(S.APROVADO), false)
})

test('lista os documentos que faltam', () => {
  assert.deepEqual(missingDocuments({}), ['identity', 'selfie', 'criminalRecord'])
  assert.deepEqual(missingDocuments({ identity: allDocs.identity }), ['selfie', 'criminalRecord'])
  assert.deepEqual(missingDocuments(allDocs), [])
})

test('daysSince conta dias inteiros e rejeita datas inválidas', () => {
  assert.equal(daysSince('2026-11-24', now), 0)
  assert.equal(daysSince('2026-11-14', now), 10)
  assert.equal(daysSince('2026-11-25', now), -1)
  assert.equal(daysSince('xx', now), null)
})

test('envio exige os três documentos e certidão recente', () => {
  assert.equal(validateSubmission({ status: S.NAO_ENVIADO, documents: allDocs, criminalRecordIssuedAt: '2026-11-01', now }).ok, true)
  assert.match(validateSubmission({ documents: { identity: allDocs.identity }, criminalRecordIssuedAt: '2026-11-01', now }).error, /selfie/)
  assert.match(validateSubmission({ documents: allDocs, criminalRecordIssuedAt: '2026-07-01', now }).error, /90 dias/)
  assert.match(validateSubmission({ documents: allDocs, criminalRecordIssuedAt: '2026-12-01', now }).error, /futuro/)
  assert.match(validateSubmission({ status: S.EM_ANALISE, documents: allDocs, criminalRecordIssuedAt: '2026-11-01', now }).error, /já foi enviada/)
})

test('revisão só para verificações em análise', () => {
  assert.equal(canReview(S.EM_ANALISE), true)
  assert.equal(canReview(S.APROVADO), false)
  assert.equal(canReview(undefined), false)
})

test('feed: só cuidadores aprovados aparecem; famílias não são afetadas', () => {
  assert.equal(isCaregiverVisible({ role: 'CUIDADOR', verificationStatus: S.APROVADO }), true)
  assert.equal(isCaregiverVisible({ role: 'CUIDADOR', verificationStatus: S.EM_ANALISE }), false)
  assert.equal(isCaregiverVisible({ role: 'CUIDADOR' }), false)
  assert.equal(isCaregiverVisible({ role: 'FAMILIAR' }), true)
})

test('ownerView nunca expõe o caminho dos arquivos', () => {
  const view = ownerView({ status: S.REPROVADO, documents: allDocs, rejectionReason: 'Foto ilegível' })
  assert.equal(view.status, S.REPROVADO)
  assert.equal(view.documents.identity.sent, true)
  assert.equal(JSON.stringify(view).includes('.enc'), false)
  assert.equal(view.rejectionReason, 'Foto ilegível')
  assert.equal(ownerView(null).status, S.NAO_ENVIADO)
})
