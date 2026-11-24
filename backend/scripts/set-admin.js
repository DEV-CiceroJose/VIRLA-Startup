import 'dotenv/config'
import { firebaseAdmin } from '../src/lib/firebase.js'

/**
 * Dá (ou tira) o acesso de equipe VIRLA a uma conta existente.
 *   node scripts/set-admin.js pessoa@empresa.com          → concede
 *   node scripts/set-admin.js pessoa@empresa.com --remove → revoga
 * Mantém o custom claim `role`. A pessoa precisa sair e entrar de novo.
 */
const [email, flag] = process.argv.slice(2)
if (!email) {
  console.error('Uso: node scripts/set-admin.js <email> [--remove]')
  process.exit(1)
}

const auth = firebaseAdmin.auth()
const user = await auth.getUserByEmail(email)
const claims = { ...(user.customClaims ?? {}) }
if (flag === '--remove') delete claims.admin
else claims.admin = true
await auth.setCustomUserClaims(user.uid, claims)
console.log(`${flag === '--remove' ? 'Acesso de equipe removido de' : 'Acesso de equipe concedido a'} ${email}.`)
process.exit(0)
