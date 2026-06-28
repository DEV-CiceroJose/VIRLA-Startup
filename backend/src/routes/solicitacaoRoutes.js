import express from 'express'
import checkToken from '../middlewares/checkToken.js'
import { requireRole } from '../middlewares/requireRole.js'
import { validateZod } from '../middlewares/validateZod.js'
import { rateLimit } from '../middlewares/rateLimit.js'
import {
  createSolicitacao,
  updateSolicitacao,
  listMySolicitacoes,
  getSolicitacao,
  cancelSolicitacao,
  listAvailableSolicitacoes,
  markSolicitacaoViewed,
  assumirSolicitacao,
  concluirSolicitacao,
} from '../controllers/solicitacaoController.js'
import {
  createSolicitacaoBodySchema,
  solicitacaoIdParamSchema,
} from '../schemas/solicitacaoSchemas.js'

const router = express.Router()

// Melhoria #1 — anti-abuso: sem isso, um usuário autenticado conseguia criar
// solicitações/ações sem limite (spam). Limites generosos para uso legítimo,
// mas suficientes para impedir scripts automatizados.
const createSolicitacaoLimiter = rateLimit({ windowMs: 60_000, max: 10, name: 'solicitacao:create' })
const writeSolicitacaoLimiter = rateLimit({ windowMs: 60_000, max: 20, name: 'solicitacao:write' })

// ─── Familiar ──────────────────────────────────────────────────────
router.post(
  '/solicitacoes',
  checkToken,
  requireRole('FAMILIAR'),
  createSolicitacaoLimiter,
  validateZod(createSolicitacaoBodySchema),
  createSolicitacao,
)
router.get('/solicitacoes/minhas', checkToken, requireRole('FAMILIAR'), listMySolicitacoes)
router.put(
  '/solicitacoes/:id',
  checkToken,
  requireRole('FAMILIAR'),
  writeSolicitacaoLimiter,
  validateZod(solicitacaoIdParamSchema, 'params'),
  validateZod(createSolicitacaoBodySchema),
  updateSolicitacao,
)
router.patch(
  '/solicitacoes/:id/cancelar',
  checkToken,
  requireRole('FAMILIAR'),
  writeSolicitacaoLimiter,
  validateZod(solicitacaoIdParamSchema, 'params'),
  cancelSolicitacao,
)
router.patch(
  '/solicitacoes/:id/concluir',
  checkToken,
  requireRole('FAMILIAR'),
  writeSolicitacaoLimiter,
  validateZod(solicitacaoIdParamSchema, 'params'),
  concluirSolicitacao,
)

// ─── Cuidador ──────────────────────────────────────────────────────
router.get('/solicitacoes/disponiveis', checkToken, requireRole('CUIDADOR'), listAvailableSolicitacoes)
router.put(
  '/solicitacoes/:id/visualizar',
  checkToken,
  requireRole('CUIDADOR'),
  writeSolicitacaoLimiter,
  validateZod(solicitacaoIdParamSchema, 'params'),
  markSolicitacaoViewed,
)
router.patch(
  '/solicitacoes/:id/assumir',
  checkToken,
  requireRole('CUIDADOR'),
  writeSolicitacaoLimiter,
  validateZod(solicitacaoIdParamSchema, 'params'),
  assumirSolicitacao,
)

// ─── Compartilhado ─────────────────────────────────────────────────
router.get(
  '/solicitacoes/:id',
  checkToken,
  validateZod(solicitacaoIdParamSchema, 'params'),
  getSolicitacao,
)

export default router
