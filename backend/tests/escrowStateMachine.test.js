import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertEscrowTransition,
  isTerminalEscrowStatus,
} from '../src/services/escrowStateMachine.js'

test('transições válidas', () => {
  assert.equal(assertEscrowTransition('PENDING', 'HELD').allowed, true)
  assert.equal(assertEscrowTransition('HELD', 'RELEASED').allowed, true)
  assert.equal(assertEscrowTransition('HELD', 'DISPUTED').allowed, true)
  assert.equal(assertEscrowTransition('DISPUTED', 'RELEASED').allowed, true)
})

test('transições inválidas são bloqueadas', () => {
  assert.equal(assertEscrowTransition('PENDING', 'RELEASED').allowed, false)
  assert.equal(assertEscrowTransition('PENDING', 'DISPUTED').allowed, false)
  assert.equal(assertEscrowTransition('DISPUTED', 'HELD').allowed, false)
})

test('estado terminal RELEASED não permite transição', () => {
  assert.equal(isTerminalEscrowStatus('RELEASED'), true)
  assert.equal(isTerminalEscrowStatus('HELD'), false)
  const r = assertEscrowTransition('RELEASED', 'DISPUTED')
  assert.equal(r.allowed, false)
  assert.match(r.error, /final/)
})
