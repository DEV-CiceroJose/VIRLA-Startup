import { z } from 'zod'
import { amountCentsSchema, objectIdSchema } from './paymentSchemas.js'

export const createChargeBodySchema = z.object({
  familiarId: objectIdSchema,
  baseAmount: amountCentsSchema,
  description: z.string().max(200).optional().default('Serviço Virla'),
})

export const peerIdParamSchema = z.object({
  peerId: objectIdSchema,
})
