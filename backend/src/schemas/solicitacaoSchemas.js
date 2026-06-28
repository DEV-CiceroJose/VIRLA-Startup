import { z } from 'zod'
import { objectIdSchema } from './paymentSchemas.js'

const URGENCIAS = ['BAIXA', 'MEDIA', 'ALTA']

export const createSolicitacaoBodySchema = z.object({
  titulo: z.string().min(3, 'Título deve ter ao menos 3 caracteres.').max(100),
  descricao: z.string().min(10, 'Descreva a solicitação com mais detalhes.').max(2000),
  tipoCuidado: z
    .array(z.string().min(1).max(40))
    .max(10, 'Selecione no máximo 10 tipos de cuidado.')
    .optional()
    .default([]),
  cidade: z.string().max(80).optional(),
  estado: z.string().max(2).optional(),
  urgencia: z.enum(URGENCIAS).optional().default('MEDIA'),
})

export const updateSolicitacaoStatusBodySchema = z.object({
  status: z.enum(['ABERTA', 'VISUALIZADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']),
})

export const solicitacaoIdParamSchema = z.object({
  id: objectIdSchema,
})
