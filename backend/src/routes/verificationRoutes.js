import express from 'express'
import multer from 'multer'
import checkToken from '../middlewares/checkToken.js'
import { requireRole } from '../middlewares/requireRole.js'
import { requireAdmin } from '../middlewares/requireAdmin.js'
import { validateZod } from '../middlewares/validateZod.js'
import { rateLimit } from '../middlewares/rateLimit.js'
import { DOCUMENT_MIMES, MAX_DOCUMENT_BYTES } from '../services/verificationDomain.js'
import {
  documentKindParamSchema,
  documentAccessParamSchema,
  reviewParamSchema,
  submitVerificationBodySchema,
  rejectVerificationBodySchema,
} from '../schemas/verificationSchemas.js'
import {
  getMyVerification,
  uploadDocument,
  submitVerification,
  getDocument,
  adminListVerifications,
  adminApprove,
  adminReject,
} from '../controllers/verificationController.js'

const router = express.Router()

// Documentos ficam só em memória até serem cifrados e gravados (nada em /uploads).
const ALLOWED = new Set(DOCUMENT_MIMES)
const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true)
    const err = new Error('Envie uma imagem (JPG, PNG, WEBP) ou PDF de até 8 MB.')
    err.status = 422
    return cb(err)
  },
})

const uploadLimiter = rateLimit({ windowMs: 60_000, max: 12, name: 'verification:upload' })
const reviewLimiter = rateLimit({ windowMs: 60_000, max: 30, name: 'verification:review' })

// ─── Cuidador ────────────────────────────────────────────────────────────
router.get('/verification/me', checkToken, requireRole('CUIDADOR'), getMyVerification)
router.post(
  '/verification/documents/:kind',
  checkToken,
  requireRole('CUIDADOR'),
  uploadLimiter,
  validateZod(documentKindParamSchema, 'params'),
  uploadDoc.single('file'),
  uploadDocument,
)
router.post(
  '/verification/submit',
  checkToken,
  requireRole('CUIDADOR'),
  uploadLimiter,
  validateZod(submitVerificationBodySchema),
  submitVerification,
)

// Dono ou equipe (a autorização fina fica no controller).
router.get(
  '/verification/documents/:userId/:kind',
  checkToken,
  validateZod(documentAccessParamSchema, 'params'),
  getDocument,
)

// ─── Equipe VIRLA ────────────────────────────────────────────────────────
router.get('/admin/verifications', checkToken, requireAdmin, adminListVerifications)
router.post(
  '/admin/verifications/:userId/approve',
  checkToken,
  requireAdmin,
  reviewLimiter,
  validateZod(reviewParamSchema, 'params'),
  adminApprove,
)
router.post(
  '/admin/verifications/:userId/reject',
  checkToken,
  requireAdmin,
  reviewLimiter,
  validateZod(reviewParamSchema, 'params'),
  validateZod(rejectVerificationBodySchema),
  adminReject,
)

export default router
