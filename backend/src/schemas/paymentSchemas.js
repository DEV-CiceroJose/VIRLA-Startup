import { z } from 'zod'
import { isValidCPF, stripCpf } from '../utils/cpf.js'

/**
 * ID de documento — impede injeção de IDs malformados.
 * Aceita IDs do Firestore (~20 chars alfanuméricos, com - e _) e ObjectIds do
 * Mongo (24 hex) de registros migrados. Mesmo formato de `isValidId` em
 * utils/validation.js — manter os dois em sincronia. Antes era /^[a-f\d]{24}$/i
 * (só Mongo), o que rejeitava IDs do Firestore com "ID inválido." em todas as
 * rotas de solicitação/cobrança/pagamento/escrow após a migração.
 */
export const objectIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,128}$/, 'ID inválido.')

/** Valor em centavos: inteiro positivo com teto. */
export const amountCentsSchema = z
  .number({ invalid_type_error: 'Valor deve ser numérico.' })
  .int('Valor deve ser inteiro (centavos).')
  .positive('Valor deve ser maior que zero.')
  .max(50_000_000, 'Valor excede o limite permitido.')

/** CPF com dígitos verificadores (11 dígitos após normalização). */
export const taxIdSchema = z
  .string()
  .min(1, 'CPF é obrigatório.')
  .max(20)
  .transform((v) => stripCpf(v))
  .refine((v) => v.length === 11, { message: 'CPF deve ter 11 dígitos.' })
  .refine(isValidCPF, { message: 'CPF inválido (dígitos verificadores).' })

export const initiateBillingBodySchema = z.object({
  amount: amountCentsSchema,
  description: z
    .string()
    .max(200, 'Descrição muito longa.')
    .optional()
    .default('Serviço Virla'),
  taxId: taxIdSchema,
  cellphone: z
    .string()
    .max(20)
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, '') : undefined)),
  payeeId: objectIdSchema,
  chargeRequestId: objectIdSchema.optional(),
})

export const billingIdParamSchema = z.object({
  billingId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/, 'billingId com formato inválido.'),
})
