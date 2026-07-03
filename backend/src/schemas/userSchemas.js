import { z } from 'zod'
import { isValidCPF, stripCpf } from '../utils/cpf.js'
import { isValidEmail } from '../utils/email.js'
import { validateBirthDate } from '../utils/date.js'
import { isValidName } from '../utils/name.js'

export const cpfSchema = z
  .string()
  .min(1, 'CPF é obrigatório.')
  .transform((v) => stripCpf(v))
  .refine((v) => v.length === 11, { message: 'CPF deve ter 11 dígitos.' })
  .refine(isValidCPF, { message: 'CPF inválido (dígitos verificadores).' })

export const emailSchema = z
  .string()
  .min(1, 'E-mail é obrigatório.')
  .max(254)
  .transform((v) => v.trim().toLowerCase())
  .refine(isValidEmail, { message: 'E-mail inválido.' })

export const nameSchema = z
  .string()
  .min(1, 'Nome é obrigatório.')
  .max(120)
  .refine(isValidName, { message: 'Informe um nome válido (apenas letras).' })

export const birthDateSchema = z.string().superRefine((v, ctx) => {
  const res = validateBirthDate(v)
  if (!res.valid) ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error })
})

export const userRoleSchema = z.enum(['CUIDADOR', 'FAMILIAR'], {
  errorMap: () => ({ message: 'Tipo de usuário inválido.' }),
})

export const profileImageSchema = z
  .string()
  .max(7_500_000)
  .optional()
  .nullable()
  .refine(
    (v) => !v || /^data:image\/(jpeg|png|webp);/i.test(v) || /^https?:\/\//i.test(v),
    { message: 'Imagem inválida. Envie um JPG, PNG ou WEBP.' },
  )

export const hourlyRateSchema = z
  .union([z.number(), z.string()])
  .nullable()
  .optional()
  .refine((v) => {
    if (v == null || v === '') return true
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= 10 && n <= 500
  }, { message: 'Valor por hora deve estar entre R$ 10 e R$ 500.' })

/** Atualização de perfil — todos os campos opcionais (PATCH-like via PUT). */
export const updateUserBodySchema = z
  .object({
    name: nameSchema.optional(),
    birthDate: birthDateSchema.optional().nullable(),
    bio: z.string().max(2000).optional(),
    email: emailSchema.optional(),
    profileImage: profileImageSchema,
    crm_crf: z.string().max(80).optional().nullable(),
    hourlyRate: hourlyRateSchema,
    registerNumber: z.string().max(80).optional().nullable(),
    approach: z.string().max(200).optional().nullable(),
    specialties: z.union([z.string(), z.array(z.string())]).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    city: z.string().max(80).optional().nullable(),
    state: z.string().max(2).optional().nullable(),
  })
  // Bloqueia campos sensíveis/imutáveis que não podem ser alterados por update.
  .strict()

export const createUserBodySchema = z.object({
  name: nameSchema,
  birthDate: birthDateSchema,
  role: userRoleSchema,
  bio: z.string().max(2000).optional().default(''),
  cpf: cpfSchema,
  profileImage: profileImageSchema,
  crm_crf: z.string().max(80).optional().nullable(),
  hourlyRate: hourlyRateSchema,
  registerNumber: z.string().max(80).optional().nullable(),
  approach: z.string().max(200).optional().nullable(),
  specialties: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
})
