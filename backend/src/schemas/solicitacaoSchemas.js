import { z } from 'zod'
import { objectIdSchema } from './paymentSchemas.js'
import { TURNO_VALUES, FREQUENCIA_VALUES } from '../utils/solicitacaoOptions.js'

const URGENCIAS = ['BAIXA', 'MEDIA', 'ALTA']

export const createSolicitacaoBodySchema = z.object({
  titulo: z.string().min(3, 'Título deve ter ao menos 3 caracteres.').max(100),
  descricao: z.string().min(10, 'Descreva a solicitação com mais detalhes.').max(2000),
  tipoCuidado: z
    .array(z.string().min(1).max(40))
    .max(10, 'Selecione no máximo 10 tipos de cuidado.')
    .optional()
    .default([]),
  cidade: z.string().min(1, 'Informe a cidade.').max(80),
  estado: z
    .string()
    .length(2, 'Selecione o estado (UF).')
    .transform((s) => s.toUpperCase()),
  dataInicio: z
    .string()
    .refine((v) => v != null && v !== '' && !Number.isNaN(Date.parse(v)), 'Informe uma data de início válida.'),
  valorHora: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .refine((v) => {
      if (v === undefined || v === null || v === '') return true
      const n = Number(v)
      return !Number.isNaN(n) && n >= 10 && n <= 500
    }, 'Valor/hora deve estar entre R$ 10 e R$ 500.'),
  turno: z.enum(TURNO_VALUES).optional().nullable(),
  frequencia: z.enum(FREQUENCIA_VALUES).optional().nullable(),
  urgencia: z.enum(URGENCIAS).optional().default('MEDIA'),
})

export const updateSolicitacaoStatusBodySchema = z.object({
  status: z.enum(['ABERTA', 'VISUALIZADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']),
})

export const solicitacaoIdParamSchema = z.object({
  id: objectIdSchema,
})
