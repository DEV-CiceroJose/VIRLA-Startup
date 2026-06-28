import 'dotenv/config'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const required = ['zod', 'firebase-admin', 'express']
const missing = required.filter((pkg) => !existsSync(join(root, 'node_modules', pkg, 'package.json')))

if (missing.length) {
  console.error('\n[Virla] Dependências ausentes:', missing.join(', '))
  console.error('[Virla] Na pasta backend, execute:\n')
  console.error('  npm install\n')
  process.exit(1)
}

if (!process.env.FIREBASE_PROJECT_ID) {
  console.warn('[Virla] Aviso: variáveis FIREBASE_* não definidas no .env — o Firestore/Chat não vai conectar.')
}
