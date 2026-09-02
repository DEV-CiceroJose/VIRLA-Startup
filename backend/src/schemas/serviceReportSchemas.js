import { z } from 'zod'
import { objectIdSchema } from './paymentSchemas.js'
import { todayDateOnly } from '../utils/paymentSchedule.js'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data no formato AAAA-MM-DD.')
const timeOnly = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe o horário no formato HH:mm.')

export const createServiceReportBodySchema = z.object({
  solicitacaoId: objectIdSchema,
  serviceDate: dateOnly,
  startedAt: timeOnly,
  endedAt: timeOnly,
  activities: z.string().trim().min(20, 'Descreva as atividades realizadas com pelo menos 20 caracteres.').max(4000),
  observations: z.string().trim().max(3000).optional().default(''),
  incidents: z.string().trim().max(3000).optional().default(''),
}).superRefine((data, ctx) => {
  const today = todayDateOnly()
  if (data.serviceDate > today) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['serviceDate'],
      message: 'A data do serviço não pode estar no futuro.',
    })
  }
  if (data.endedAt <= data.startedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endedAt'],
      message: 'O horário de término deve ser posterior ao início.',
    })
  }
})

export const signServiceReportBodySchema = z.object({
  accepted: z.literal(true, { errorMap: () => ({ message: 'Confirme que o serviço foi prestado.' }) }),
  typedName: z.string().trim().min(3, 'Digite seu nome completo para assinar.').max(120),
  declaration: z.literal(true, { errorMap: () => ({ message: 'Aceite a declaração de assinatura.' }) }),
})

export const serviceReportIdParamSchema = z.object({ reportId: objectIdSchema })
export const reportSolicitacaoIdParamSchema = z.object({ solicitacaoId: objectIdSchema })
