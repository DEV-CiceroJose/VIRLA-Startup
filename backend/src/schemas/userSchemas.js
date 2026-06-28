import { z } from 'zod'
import { isValidCPF, stripCpf } from '../utils/cpf.js'
import { isValidEmail } from '../utils/email.js'

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

export const userRoleSchema = z.enum(['CUIDADOR', 'FAMILIAR'], {
  errorMap: () => ({ message: 'Tipo de usuário inválido.' }),
})

/** Aceita data URL (upload) ou URL http(s) legada. */
export const profileImageSchema = z
  .string()
  .max(3_000_000)
  .optional()
  .nullable()
  .refine(
    (v) => !v || v.startsWith('data:image/') || /^https?:\/\//i.test(v),
    { message: 'Imagem inválida. Envie um arquivo de imagem.' },
  )

/** Atualização de perfil — todos os campos opcionais (PATCH-like via PUT). */
export const updateUserBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    birthDate: z.string().optional().nullable(),
    bio: z.string().max(2000).optional(),
    email: emailSchema.optional(),
    profileImage: profileImageSchema,
    crm_crf: z.string().max(80).optional().nullable(),
    hourlyRate: z.union([z.number(), z.string()]).optional().nullable(),
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
  name: z.string().min(1, 'Nome é obrigatório.').max(120),
  birthDate: z.string().optional().nullable(),
  role: userRoleSchema,
  bio: z.string().max(2000).optional().default(''),
  email: emailSchema,
  cpf: cpfSchema,
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres.').max(128),
  profileImage: profileImageSchema,
  crm_crf: z.string().max(80).optional().nullable(),
  hourlyRate: z.union([z.number(), z.string()]).optional().nullable(),
  registerNumber: z.string().max(80).optional().nullable(),
  approach: z.string().max(200).optional().nullable(),
  specialties: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
})
