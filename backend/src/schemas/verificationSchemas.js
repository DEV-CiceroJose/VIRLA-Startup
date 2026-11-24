import { z } from 'zod'
import { DOCUMENT_KINDS } from '../services/verificationDomain.js'

export const documentKindParamSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS, { errorMap: () => ({ message: 'Tipo de documento inválido.' }) }),
})

export const documentAccessParamSchema = z.object({
  userId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, 'Usuário inválido.'),
  kind: z.enum(DOCUMENT_KINDS, { errorMap: () => ({ message: 'Tipo de documento inválido.' }) }),
})

export const reviewParamSchema = z.object({
  userId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, 'Usuário inválido.'),
})

export const submitVerificationBodySchema = z.object({
  criminalRecordCode: z
    .string()
    .trim()
    .min(4, 'Informe o código de validação da certidão.')
    .max(64, 'Código de validação muito longo.')
    .regex(/^[A-Za-z0-9./-]+$/, 'Use só letras, números, ponto, barra e hífen no código.'),
  criminalRecordIssuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data de emissão da certidão.'),
  declaration: z.literal(true, {
    errorMap: () => ({ message: 'Confirme a declaração de veracidade para enviar.' }),
  }),
}).strict()

export const rejectVerificationBodySchema = z.object({
  reason: z.string().trim().min(10, 'Explique o motivo em pelo menos 10 caracteres.').max(500),
}).strict()

export const listVerificationsQuerySchema = z.object({
  status: z.enum(['EM_ANALISE', 'APROVADO', 'REPROVADO']).optional().default('EM_ANALISE'),
})
