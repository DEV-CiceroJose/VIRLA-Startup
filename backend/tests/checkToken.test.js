import test from 'node:test'
import assert from 'node:assert/strict'
import { makeCheckToken } from '../src/middlewares/checkToken.js'

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
}

const decodedOk = { uid: 'uid123', role: 'CUIDADOR', email: 'a@b.com', email_verified: true }

test('checkToken: token válido e verificado popula req e chama next', async () => {
  const check = makeCheckToken(async () => decodedOk, { requireVerified: true })
  const req = { headers: { authorization: 'Bearer tok' } }
  const res = mockRes()
  let called = false
  await check(req, res, () => { called = true })
  assert.equal(called, true)
  assert.equal(req.userId, 'uid123')
  assert.equal(req.userRole, 'CUIDADOR')
  assert.equal(req.email, 'a@b.com')
  assert.equal(req.emailVerified, true)
})

test('checkToken: sem header Authorization retorna 401', async () => {
  const check = makeCheckToken(async () => decodedOk, { requireVerified: true })
  const req = { headers: {} }
  const res = mockRes()
  await check(req, res, () => { throw new Error('não deveria chamar next') })
  assert.equal(res.statusCode, 401)
})

test('checkToken: token inválido (verifyIdToken lança) retorna 401', async () => {
  const check = makeCheckToken(async () => { throw new Error('bad token') }, { requireVerified: true })
  const req = { headers: { authorization: 'Bearer tok' } }
  const res = mockRes()
  await check(req, res, () => { throw new Error('não deveria chamar next') })
  assert.equal(res.statusCode, 401)
})

test('checkToken (requireVerified): e-mail não verificado retorna 403', async () => {
  const check = makeCheckToken(async () => ({ ...decodedOk, email_verified: false }), { requireVerified: true })
  const req = { headers: { authorization: 'Bearer tok' } }
  const res = mockRes()
  await check(req, res, () => { throw new Error('não deveria chamar next') })
  assert.equal(res.statusCode, 403)
})

test('checkTokenAllowUnverified: e-mail não verificado ainda chama next', async () => {
  const check = makeCheckToken(async () => ({ ...decodedOk, email_verified: false }), { requireVerified: false })
  const req = { headers: { authorization: 'Bearer tok' } }
  const res = mockRes()
  let called = false
  await check(req, res, () => { called = true })
  assert.equal(called, true)
  assert.equal(req.emailVerified, false)
})
