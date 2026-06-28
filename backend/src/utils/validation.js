/**
 * Validações de entrada compartilhadas — camada anti-manipulação de IDs e valores.
 */

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i

/**
 * Verifica se o valor é um ObjectId MongoDB válido (24 hex).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_REGEX.test(value)
}

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
