/**
 * Validações de entrada compartilhadas — camada anti-manipulação de IDs e valores.
 */

// Aceita IDs do Firestore (~20 chars alfanuméricos, podendo conter - e _) e
// também ObjectIds do Mongo (24 hex) para registros migrados do banco antigo.
const ID_REGEX = /^[A-Za-z0-9_-]{16,128}$/

/**
 * Verifica se o valor é um ID de documento válido (Firestore ou ObjectId
 * migrado). Antes validava apenas ObjectId de 24 hex; ampliado na migração
 * para Firebase. Mantém o nome `isValidObjectId` por compatibilidade de import.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidId(value) {
  return typeof value === 'string' && ID_REGEX.test(value)
}

export const isValidObjectId = isValidId

/**
 * Rejeita valores monetários inválidos (zero, negativo, não-inteiro, acima do teto).
 * @param {unknown} amount - valor em centavos
 * @param {{ maxCents?: number }} [opts]
 * @returns {{ valid: true; amount: number } | { valid: false; error: string }}
 */
export function validateAmountCents(amount, opts = {}) {
  const maxCents = opts.maxCents ?? 50_000_000 // R$ 500.000,00

  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    return { valid: false, error: 'Valor deve ser um número inteiro em centavos.' }
  }
  if (amount <= 0) {
    return { valid: false, error: 'Valor deve ser maior que zero.' }
  }
  if (amount > maxCents) {
    return { valid: false, error: 'Valor excede o limite permitido.' }
  }
  return { valid: true, amount }
}

/**
 * Normaliza e valida chave de idempotência (header Idempotency-Key).
 * @param {unknown} key
 * @returns {{ valid: true; key: string } | { valid: false; error: string }}
 */
export function validateIdempotencyKey(key) {
  if (typeof key !== 'string') {
    return { valid: false, error: 'Cabeçalho Idempotency-Key é obrigatório.' }
  }
  const trimmed = key.trim()
  if (trimmed.length < 8 || trimmed.length > 128) {
    return { valid: false, error: 'Idempotency-Key deve ter entre 8 e 128 caracteres.' }
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return { valid: false, error: 'Idempotency-Key contém caracteres inválidos.' }
  }
  return { valid: true, key: trimmed }
}
