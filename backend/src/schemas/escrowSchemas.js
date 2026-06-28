import { z } from 'zod'
import { objectIdSchema } from './paymentSchemas.js'

export const escrowIdParamSchema = z.object({
  escrowId: objectIdSchema,
})

export const disputeBodySchema = z.object({
  reason: z
    .string()
    .max(500, 'Motivo da disputa muito longo.')
    .optional()
    .default(''),
})

/** Chave de idempotência — obrigatória em liberação/disputa (anti double-submit). */
export const idempotencyKeyHeaderSchema = z
  .string()
  .trim()
  .min(8, 'Idempotency-Key deve ter ao menos 8 caracteres.')
  .max(128)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Idempotency-Key contém caracteres inválidos.')
