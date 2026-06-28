import { z } from 'zod'
import { emailSchema } from './userSchemas.js'

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória.').max(128),
})
