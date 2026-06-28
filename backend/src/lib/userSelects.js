/**
 * Projeções (select) reutilizáveis do model User.
 *
 * Separamos dois níveis de exposição para evitar vazamento de PII:
 *
 *  - USER_PUBLIC_SELECT  → dados visíveis para QUALQUER usuário autenticado
 *                          (feed, perfil de terceiros). NÃO inclui email/cpf.
 *  - USER_SELF_SELECT    → tudo do público + dados sensíveis (email, cpf),
 *                          devolvido apenas quando o usuário consulta a si mesmo.
 */

export const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  birthDate: true,
  role: true,
  bio: true,
  profileImage: true,
  crm_crf: true,
  registerNumber: true,
  hourlyRate: true,
  specialties: true,
  approach: true,
  description: true,
  city: true,
  state: true,
}

export const USER_SELF_SELECT = {
  ...USER_PUBLIC_SELECT,
  email: true,
  cpf: true,
}
