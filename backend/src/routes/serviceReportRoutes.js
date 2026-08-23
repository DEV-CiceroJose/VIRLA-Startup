import express from 'express'
import checkToken from '../middlewares/checkToken.js'
import { requireRole } from '../middlewares/requireRole.js'
import { validateZod } from '../middlewares/validateZod.js'
import { rateLimit } from '../middlewares/rateLimit.js'
import { createServiceReport, getReportBySolicitacao, signServiceReport } from '../controllers/serviceReportController.js'
import {
  createServiceReportBodySchema,
  reportSolicitacaoIdParamSchema,
  serviceReportIdParamSchema,
  signServiceReportBodySchema,
} from '../schemas/serviceReportSchemas.js'

const router = express.Router()
const writeLimiter = rateLimit({ windowMs: 60_000, max: 15, name: 'service-report:write' })

router.post('/service-reports', checkToken, requireRole('CUIDADOR'), writeLimiter, validateZod(createServiceReportBodySchema), createServiceReport)
router.get('/service-reports/solicitacao/:solicitacaoId', checkToken, validateZod(reportSolicitacaoIdParamSchema, 'params'), getReportBySolicitacao)
router.post('/service-reports/:reportId/sign', checkToken, requireRole('FAMILIAR'), writeLimiter, validateZod(serviceReportIdParamSchema, 'params'), validateZod(signServiceReportBodySchema), signServiceReport)

export default router

