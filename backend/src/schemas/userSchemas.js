import { z } from 'zod'
import { isValidCPF, stripCpf } from '../utils/cpf.js'
import { isValidEmail } from '../utils/email.js'
import { validateBirthDate } from '../utils/date.js'
import { isValidName } from '../utils/name.js'
import { COUNCIL_VALUES, isValidRegister } from '../utils/councils.js'
import { SPECIALTY_VALUES } from '../utils/specialties.js'
import { TURNO_VALUES, FREQUENCIA_VALUES } from '../utils/solicitacaoOptions.js'

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

export const councilSchema = z.enum(COUNCIL_VALUES, {
  errorMap: () => ({ message: 'Conselho profissional inválido.' }),
})

/** Regra do par conselho+registro (superRefine reutilizável em create/update). */
export function refineRegisterPair(data, ctx) {
  const hasCouncil = !!data.council
  const hasNumber = !!(data.registerNumber && String(data.registerNumber).trim())
  if (hasCouncil !== hasNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe o conselho e o número do registro.',
      path: ['registerNumber'],
    })
    return
  }
  if (hasCouncil && hasNumber && !isValidRegister(data.council, data.registerNumber)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Número de registro inválido para o conselho informado.',
      path: ['registerNumber'],
    })
  }
}

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

export const zipCodeSchema = z
  .string()
  .max(9)
  .optional()
  .nullable()
  .transform((v) => (v ? v.replace(/\D/g, '') : v))
  .refine((v) => !v || /^\d{8}$/.test(v), { message: 'CEP deve ter 8 dígitos (ex.: 00000-000).' })

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
    council: councilSchema.optional().nullable(),
    hourlyRate: hourlyRateSchema,
    registerNumber: z.string().max(80).optional().nullable(),
    approach: z.string().max(200).optional().nullable(),
    specialties: z.array(z.enum(SPECIALTY_VALUES)).max(12).optional().nullable(),
    availableShifts: z.array(z.enum(TURNO_VALUES)).max(TURNO_VALUES.length).optional().nullable(),
    serviceFrequencies: z.array(z.enum(FREQUENCIA_VALUES)).max(FREQUENCIA_VALUES.length).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    city: z.string().max(80).optional().nullable(),
    state: z.string().max(2).optional().nullable(),
    zipCode: zipCodeSchema,
  })
  // Bloqueia campos sensíveis/imutáveis que não podem ser alterados por update.
  .strict()
  .superRefine(refineRegisterPair)

export const createUserBodySchema = z.object({
  name: nameSchema,
  birthDate: birthDateSchema,
  role: userRoleSchema,
  bio: z.string().max(2000).optional().default(''),
  cpf: cpfSchema,
  profileImage: profileImageSchema,
  council: councilSchema.optional().nullable(),
  hourlyRate: hourlyRateSchema,
  registerNumber: z.string().max(80).optional().nullable(),
  approach: z.string().max(200).optional().nullable(),
  specialties: z.array(z.enum(SPECIALTY_VALUES)).max(12).optional().nullable(),
  availableShifts: z.array(z.enum(TURNO_VALUES)).max(TURNO_VALUES.length).optional().nullable(),
  serviceFrequencies: z.array(z.enum(FREQUENCIA_VALUES)).max(FREQUENCIA_VALUES.length).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  zipCode: zipCodeSchema,
}).superRefine(refineRegisterPair)
