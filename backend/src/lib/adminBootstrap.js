import { firebaseAdmin, FIREBASE_CONFIGURED } from './firebase.js'
import { logger, securityLogger } from './logger.js'

/**
 * Equipe VIRLA definida pela variável de ambiente VIRLA_ADMIN_EMAILS
 * (e-mails separados por vírgula, ponto e vírgula ou espaço). Na subida do
 * servidor, cada conta existente recebe o custom claim `admin: true` (o
 * `role` é mantido). Quem não tem conta ainda é só registrado no log.
 * Para revogar, tire o e-mail da variável e rode scripts/set-admin.js --remove.
 */
export function parseAdminEmails(value) {
  return [...new Set(String(value ?? '')
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))]
}

export async function bootstrapAdmins(value = process.env.VIRLA_ADMIN_EMAILS) {
  const emails = parseAdminEmails(value)
  if (emails.length === 0 || !FIREBASE_CONFIGURED) return
  const auth = firebaseAdmin.auth()
  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email)
      if (user.customClaims?.admin === true) continue
      await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true })
      securityLogger.info('admin:granted_from_env', { userId: user.uid })
    } catch (err) {
      if (err?.code === 'auth/user-not-found') logger.warn('admin:email_without_account', { email: email.replace(/^(.{2}).*(@.*)$/, '$1***$2') })
      else logger.error('admin:bootstrap_failed', { error: err.message })
    }
  }
}
