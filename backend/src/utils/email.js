/** Validação de e-mail (formato RFC simplificado). */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export function isValidEmail(value) {
  const email = String(value ?? '').trim()
  if (!email || email.length > 254) return false
  if (!EMAIL_REGEX.test(email)) return false
  const domain = email.split('@')[1]
  if (!domain || !domain.includes('.')) return false
  const tld = domain.split('.').pop()
  return Boolean(tld && tld.length >= 2)
}
