import { z } from 'zod'
import { objectIdSchema } from './paymentSchemas.js'

export const notificationIdParamSchema = z.object({ id: objectIdSchema })
export const senderIdParamSchema = z.object({ senderId: objectIdSchema })
