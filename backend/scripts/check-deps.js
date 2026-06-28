import 'dotenv/config'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const required = ['zod', '@prisma/client', 'express']
const missing = required.filter((pkg) => !existsSync(join(root, 'node_modules', pkg, 'package.json')))

if (missing.length) {
  console.error('\n[Virla] Dependências ausentes:', missing.join(', '))
  console.error('[Virla] Na pasta backend, execute:\n')
  console.error('  npm install\n')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.warn('[Virla] Aviso: DATABASE_URL não está definida no .env — o banco não vai conectar.')
}
