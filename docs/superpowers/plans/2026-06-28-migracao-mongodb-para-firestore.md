# Migração MongoDB → Firebase (Firestore) — Plano de Implementação

> **Para executores agentic:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para rastreio.

**Goal:** Remover por completo a dependência de MongoDB/Prisma do backend Virla, movendo toda a persistência de dados (usuários, solicitações, cobranças, pagamentos e escrow) para o **Firebase Firestore**, preservando as garantias de atomicidade do fluxo financeiro.

**Architecture:** O backend já usa `firebase-admin`. Toda a camada de dados passa de Prisma/Mongo para Firestore via Admin SDK, encapsulada em **repositórios** (`src/repositories/*`) — nenhum controller/serviço fala com o banco diretamente. O chat **permanece** no Realtime Database (já migrado na Sprint 0; é nativo de tempo real). Autenticação continua com bcrypt + JWT próprio; apenas o armazenamento do `User` muda. Transações ACID multi-documento do escrow passam a usar `db.runTransaction()` (compare-and-set por leitura-na-transação).

**Tech Stack:** Node 18+ (ESM), Express, `firebase-admin` (Firestore), Jest (testes), `@google-cloud/firestore` (tipos/emulador). Remoção: `@prisma/client`, `prisma`.

## Global Constraints

- **Sem MongoDB/Prisma residual:** ao final, `grep -ri "prisma\|mongo" backend/src backend/server.js backend/package.json` retorna 0 ocorrências de código ativo (comentários históricos podem ser reescritos, não mantidos).
- **Atomicidade financeira inviolável:** toda transição de Escrow (HOLD/RELEASE/DISPUTE) e a criação de auditoria correspondente ocorrem dentro de **uma** `db.runTransaction()`. Nunca escrever escrow e audit log em escritas separadas.
- **Idempotência preservada:** a chave de idempotência (`EscrowIdempotencyKey.key`) vira o **ID do documento** na coleção `escrowIdempotencyKeys` — a unicidade é garantida por `transaction.create()` (falha se já existe).
- **Unicidade de email:** Firestore não tem `@unique`. Email único é garantido por documento-índice `usersByEmail/{emailLowercase}` escrito na mesma transação de criação do usuário.
- **IDs preservados na migração:** o script de migração de dados grava cada documento usando o `_id` antigo do Mongo como ID do Firestore (`collection.doc(oldId).set(...)`), para não quebrar referências cruzadas existentes.
- **Tipos:** `DateTime` → `Firestore.Timestamp`; enums → `string`; campos de array (`specialties`, `tipoCuidado`, `viewedByIds`) → arrays nativos; valores monetários permanecem **inteiros em centavos**.
- **Backend usa Admin SDK (ignora Security Rules).** O frontend NÃO acessa o Firestore diretamente (só RTDB p/ chat + Auth p/ token). As regras do Firestore ficam `allow read, write: if false` (deny-all p/ clientes).
- **Sem downtime obrigatório:** migração feita com export → import; cutover por variável de ambiente.

---

## File Structure

**Novos arquivos:**
- `backend/src/lib/firestore.js` — inicializa e exporta o `db` (Firestore) a partir do app `firebase-admin` já existente.
- `backend/src/repositories/_helpers.js` — conversões (Timestamp↔Date), `mapDoc`, `nowTs`, paginação por cursor.
- `backend/src/repositories/userRepository.js`
- `backend/src/repositories/solicitacaoRepository.js`
- `backend/src/repositories/chargeRequestRepository.js`
- `backend/src/repositories/paymentRepository.js`
- `backend/src/repositories/escrowRepository.js` — inclui audit log + idempotência (mesma coleção-família).
- `backend/scripts/migrate-mongo-to-firestore.js` — export Mongo → import Firestore (one-shot, idempotente).
- `backend/firestore.indexes.json` — índices compostos.
- `backend/firestore.rules` — deny-all p/ clientes.
- Testes: `backend/tests/repositories/*.test.js`, `backend/tests/escrowService.firestore.test.js`.

**Modificados (trocam `prisma.*` por repositório):**
- `backend/src/lib/firebase.js` (passa a exportar também o Firestore `db`)
- `backend/src/services/escrowService.js`, `chargeRequestService.js`, `paymentWebhookService.js`
- `backend/src/controllers/authController.js`, `userController.js`, `solicitacaoController.js`, `chargeRequestController.js`, `paymentController.js`, `escrowController.js`, `messageController.js`, `observabilityController.js`
- `backend/src/middlewares/requireRole.js`
- `backend/server.js` (nada de Prisma a fechar; ajustar shutdown se preciso)
- `backend/package.json` (remover deps/scripts Prisma), `backend/.env.example` (remover `DATABASE_URL`)

**Removidos:**
- `backend/prisma/` (schema.prisma, seed.js, migrations)
- `backend/src/lib/prisma.js`
- `backend/scripts/migrate-messages-to-firebase.js` (script one-shot já cumprido — confirmar com o usuário)

---

## Mapeamento de Modelos (Prisma → Firestore)

| Model Prisma (Mongo) | Coleção Firestore | ID do doc | Notas de migração |
|---|---|---|---|
| `User` | `users` | `_id` antigo | + doc-índice `usersByEmail/{email}` (unicidade). `birthDate` Date→Timestamp. Arrays `specialties`. `password` (bcrypt hash) copiado como está. |
| `Solicitacao` | `solicitacoes` | `_id` antigo | arrays `tipoCuidado`, `viewedByIds`. Índices: `(familiarId,status)`, `(status,createdAt)`. |
| `ChargeRequest` | `chargeRequests` | `_id` antigo | Índices: `(familiarId,status)`, `(caregiverId,familiarId,status)`. |
| `Payment` | `payments` | `_id` antigo | `billingId` único → doc-índice `paymentsByBilling/{billingId}` OU consulta `where('billingId','==',...)` (ver Task de pagamento). |
| `Escrow` | `escrows` | `_id` antigo | `paymentId` único → doc-índice `escrowsByPayment/{paymentId}`. |
| `EscrowAuditLog` | `escrows/{id}/auditLogs` (subcoleção) | auto | append-only; `orderBy createdAt asc`. |
| `EscrowIdempotencyKey` | `escrowIdempotencyKeys` | **a própria `key`** | unicidade via `transaction.create`. |
| `Message` | **Realtime Database** (já lá) | — | model Prisma é legado/morto pós-Sprint 0. Remover do schema; nenhuma migração de dados (já no RTDB). |

## Mapeamento de Padrões de Query

| Prisma | Firestore | Onde aparece |
|---|---|---|
| `findUnique({where:{id}})` | `db.collection(c).doc(id).get()` | em toda parte |
| `findUnique({where:{email}})` | ler `usersByEmail/{email}` → pega `userId` → `users.doc(id)` | `authController.LoginUser` |
| `findUnique({where:{paymentId}})` (escrow) | ler `escrowsByPayment/{paymentId}` | `escrowService.holdEscrowFunds` |
| `findMany({where, orderBy, select})` | `query.where(...).orderBy(...).get()` + projeção em memória | user/solicitacao/charge |
| `findMany({where:{id:{in:ids}}})` | `db.getAll(...refs)` (sem limite de 30) | `messageController` peers |
| `OR:[{billingId},{gatewayBillingId}]` | 2 queries sequenciais (1ª; se vazia, 2ª) ou `Filter.or(...)` do Admin SDK ≥ v11.4 | `paymentWebhookService`, `chargeRequestController` |
| `count({where})` | `query.count().get()` (aggregation) | `userController` paginação |
| `skip/take` (offset) | cursor `startAfter(lastDoc).limit(n)` | `userController.list` |
| `$transaction(fn)` | `db.runTransaction(fn)` | escrow |
| `updateMany({where:{id,status},data})` (compare-and-set) | dentro da transação: `tx.get(ref)`; checar `status`; `tx.update(ref,...)` | escrow |
| `escrowAuditLog.create` em `tx` | `tx.set(escrowRef.collection('auditLogs').doc(), ...)` | escrow |
| `prisma.$runCommandRaw({ping:1})` (health) | `db.listCollections()` com timeout, ou `usersByEmail` doc-get leve | `observabilityController.checkDatabase` |

---

## Ordem de Execução (fases)

1. **Fundação** (Tasks 1–3): Firestore client, helpers, regras/índices. Sem trocar lógica ainda.
2. **Slice canônico — User/Auth** (Tasks 4–6): repositório + auth + user controllers. É o template para os demais.
3. **Domínios não-financeiros** (Tasks 7–8): Solicitação, ChargeRequest.
4. **Domínio financeiro** (Tasks 9–11): Payment, Escrow (transações), webhook. **Maior risco.**
5. **Saúde/observabilidade + limpeza** (Tasks 12–14): health check, remover Prisma, atualizar package.json/env.
6. **Migração de dados + cutover** (Task 15): script export/import e validação.

> **Pagamento está oculto na UI** (flag `PAYMENT_ENABLED=false`), mas o backend financeiro continua existindo e DEVE ser migrado com o mesmo rigor — a flag não remove a lógica.

---

### Task 1: Cliente Firestore

**Files:**
- Create: `backend/src/lib/firestore.js`
- Modify: `backend/src/lib/firebase.js` (reaproveitar o `app` já inicializado)
- Test: `backend/tests/firestore.init.test.js`

**Interfaces:**
- Produces: `export const db` (instância `Firestore`), `export const FIRESTORE_CONFIGURED: boolean`.

- [ ] **Step 1: Escrever teste de inicialização (mock do firebase-admin)**

```js
// backend/tests/firestore.init.test.js
import { jest } from '@jest/globals'

test('db expõe collection() quando firebase está configurado', async () => {
  const { db } = await import('../src/lib/firestore.js')
  expect(typeof db.collection).toBe('function')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx jest tests/firestore.init.test.js`
Expected: FAIL — `Cannot find module '../src/lib/firestore.js'`.

- [ ] **Step 3: Implementar `firestore.js`**

```js
// backend/src/lib/firestore.js
import admin from 'firebase-admin'
import { FIREBASE_CONFIGURED } from './firebase.js'
import { logger } from './logger.js'

// Reutiliza o app inicializado em firebase.js (mesmo credential.cert).
// Se o Firebase não estiver configurado, expõe um proxy que falha com
// mensagem contendo "Firebase" (mesmo padrão de degradação do RTDB).
function unavailable() {
  return new Proxy({}, { get() {
    throw new Error('Firebase Firestore não está configurado ou falhou ao iniciar.')
  }})
}

let db
try {
  db = FIREBASE_CONFIGURED ? admin.firestore() : unavailable()
  if (FIREBASE_CONFIGURED) {
    db.settings({ ignoreUndefinedProperties: true })
    logger.info('firestore:initialized')
  }
} catch (err) {
  logger.error('firestore:init_failed', { error: err.message })
  db = unavailable()
}

export const FIRESTORE_CONFIGURED = FIREBASE_CONFIGURED
export { db }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx jest tests/firestore.init.test.js`
Expected: PASS. (Configurar `tests/setup` para variáveis FIREBASE_* fake/emulador; ver Task 2.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/firestore.js backend/tests/firestore.init.test.js
git commit -m "feat(db): inicializa cliente Firestore reusando firebase-admin"
```

---

### Task 2: Helpers de repositório + emulador nos testes

**Files:**
- Create: `backend/src/repositories/_helpers.js`
- Create: `backend/tests/_firestoreEmulator.js` (bootstrap do emulador)
- Test: `backend/tests/repositories/_helpers.test.js`

**Interfaces:**
- Produces:
  - `mapDoc(snap)` → `{ id, ...data, <Timestamps convertidos p/ Date> }`
  - `toTimestamp(date)` / `nowTs()` → `Firestore.Timestamp`
  - `project(obj, selectMap)` → aplica um `USER_PUBLIC_SELECT`-like em memória
  - `paginate(query, { cursorDoc, limit })` → `{ items, nextCursor }`

- [ ] **Step 1: Teste das conversões**

```js
// backend/tests/repositories/_helpers.test.js
import { Timestamp } from 'firebase-admin/firestore'
import { mapDoc, project } from '../../src/repositories/_helpers.js'

test('mapDoc converte Timestamp em Date e injeta id', () => {
  const snap = { id: 'abc', data: () => ({ createdAt: Timestamp.fromMillis(0), name: 'X' }) }
  const out = mapDoc(snap)
  expect(out.id).toBe('abc')
  expect(out.createdAt).toBeInstanceOf(Date)
  expect(out.name).toBe('X')
})

test('project mantém só as chaves marcadas true', () => {
  expect(project({ a: 1, b: 2, c: 3 }, { a: true, c: true })).toEqual({ a: 1, c: 3 })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest tests/repositories/_helpers.test.js` → FAIL (módulo ausente).

- [ ] **Step 3: Implementar `_helpers.js`**

```js
// backend/src/repositories/_helpers.js
import { Timestamp } from 'firebase-admin/firestore'

export const nowTs = () => Timestamp.now()
export const toTimestamp = (d) => (d ? Timestamp.fromDate(new Date(d)) : null)

export function mapDoc(snap) {
  if (!snap || !snap.exists && typeof snap.exists !== 'undefined') return null
  const data = snap.data()
  if (!data) return null
  const out = { id: snap.id }
  for (const [k, v] of Object.entries(data)) {
    out[k] = v instanceof Timestamp ? v.toDate() : v
  }
  return out
}

export function project(obj, selectMap) {
  if (!obj) return obj
  const out = {}
  for (const [k, keep] of Object.entries(selectMap)) if (keep && k in obj) out[k] = obj[k]
  return out
}

export async function paginate(query, { cursorDoc, limit }) {
  let q = query.limit(limit)
  if (cursorDoc) q = query.startAfter(cursorDoc).limit(limit)
  const snap = await q.get()
  const items = snap.docs.map(mapDoc)
  const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1] : null
  return { items, nextCursor }
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx jest tests/repositories/_helpers.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/_helpers.js backend/tests/repositories/_helpers.test.js backend/tests/_firestoreEmulator.js
git commit -m "feat(db): helpers de repositorio (mapDoc, project, paginate) + emulador nos testes"
```

> **Nota de execução:** os testes de repositório/escrow das Tasks seguintes rodam contra o **Firestore Emulator** (`firebase emulators:exec --only firestore`). Documente o comando no README do backend. Sem emulador, marque-os `describe.skip` e registre como dívida.

---

### Task 3: Regras e índices do Firestore

**Files:**
- Create: `backend/firestore.rules`
- Create: `backend/firestore.indexes.json`

- [ ] **Step 1: Regras deny-all (cliente não acessa Firestore; só backend via Admin SDK)**

```
// backend/firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

- [ ] **Step 2: Índices compostos (derivados dos `@@index` do schema)**

```json
{
  "indexes": [
    { "collectionGroup": "solicitacoes", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "familiarId", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" } ] },
    { "collectionGroup": "solicitacoes", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "status", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "chargeRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "familiarId", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" } ] },
    { "collectionGroup": "chargeRequests", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "caregiverId", "order": "ASCENDING" }, { "fieldPath": "familiarId", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" } ] }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/firestore.rules backend/firestore.indexes.json
git commit -m "feat(db): regras deny-all e indices compostos do Firestore"
```

> Deploy dos índices no cutover: `firebase deploy --only firestore:indexes,firestore:rules`.

---

### Task 4: `userRepository` (slice canônico)

**Files:**
- Create: `backend/src/repositories/userRepository.js`
- Test: `backend/tests/repositories/userRepository.test.js` (emulador)

**Interfaces:**
- Produces:
  - `getUserById(id)` → user | null
  - `getUserByEmail(email)` → user | null (via `usersByEmail`)
  - `createUser(data)` → user (transação: cria `users/{id}` + `usersByEmail/{email}`; lança `EMAIL_TAKEN` se índice existir)
  - `updateUser(id, patch)` → user
  - `listUsers({ where, page, limit })` → `{ users, total }` (cursor-based; ver nota de paginação)
  - `listUsersByIds(ids)` → user[] (`db.getAll`)
  - `countUsers(where)` → number

- [ ] **Step 1: Testes (emulador) — criar, unicidade de email, buscar por email**

```js
// backend/tests/repositories/userRepository.test.js
import * as repo from '../../src/repositories/userRepository.js'

test('createUser grava usuario e indice de email; duplicado falha', async () => {
  const u = await repo.createUser({ name: 'A', email: 'a@x.com', role: 'FAMILIAR', bio: '', password: 'h' })
  expect(u.id).toBeTruthy()
  expect(await repo.getUserByEmail('a@x.com')).toMatchObject({ id: u.id })
  await expect(repo.createUser({ name: 'B', email: 'a@x.com', role: 'CUIDADOR', bio: '', password: 'h' }))
    .rejects.toThrow('EMAIL_TAKEN')
})
```

- [ ] **Step 2: Rodar e ver falhar** — `firebase emulators:exec --only firestore "npx jest tests/repositories/userRepository.test.js"` → FAIL.

- [ ] **Step 3: Implementar `userRepository.js`**

```js
// backend/src/repositories/userRepository.js
import { db } from '../lib/firestore.js'
import { mapDoc, toTimestamp } from './_helpers.js'

const users = () => db.collection('users')
const emailIndex = (email) => db.collection('usersByEmail').doc(String(email).toLowerCase())

export async function getUserById(id) {
  return mapDoc(await users().doc(id).get())
}

export async function getUserByEmail(email) {
  const idx = await emailIndex(email).get()
  if (!idx.exists) return null
  return getUserById(idx.data().userId)
}

export async function createUser(data) {
  const ref = users().doc()
  await db.runTransaction(async (tx) => {
    const idxRef = emailIndex(data.email)
    const idx = await tx.get(idxRef)
    if (idx.exists) { const e = new Error('EMAIL_TAKEN'); e.statusCode = 409; throw e }
    const payload = { ...data, birthDate: data.birthDate ? toTimestamp(data.birthDate) : null }
    tx.set(ref, payload)
    tx.set(idxRef, { userId: ref.id })
  })
  return getUserById(ref.id)
}

export async function updateUser(id, patch) {
  const p = { ...patch }
  if ('birthDate' in p) p.birthDate = p.birthDate ? toTimestamp(p.birthDate) : null
  await users().doc(id).update(p)
  return getUserById(id)
}

export async function listUsersByIds(ids) {
  if (!ids.length) return []
  const refs = ids.map((id) => users().doc(id))
  const snaps = await db.getAll(...refs)
  return snaps.map(mapDoc).filter(Boolean)
}

export async function countUsers(where = {}) {
  let q = users()
  for (const [k, v] of Object.entries(where)) q = q.where(k, '==', v)
  return (await q.count().get()).data().count
}

// Paginação: Firestore não tem offset eficiente. Para a tela de listagem
// (volume baixo no MVP) buscamos página por cursor; mantemos a assinatura
// {users,total} esperada pelo controller, com `total` via countUsers.
export async function listUsers({ where = {}, limit = 20, cursorId = null }) {
  let q = users()
  for (const [k, v] of Object.entries(where)) q = q.where(k, '==', v)
  q = q.orderBy('__name__').limit(limit)
  if (cursorId) q = q.startAfter(await users().doc(cursorId).get())
  const snap = await q.get()
  return { users: snap.docs.map(mapDoc), total: await countUsers(where), nextCursorId: snap.docs.at(-1)?.id ?? null }
}
```

- [ ] **Step 4: Rodar e ver passar** — comando da Step 2 → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/userRepository.js backend/tests/repositories/userRepository.test.js
git commit -m "feat(db): userRepository em Firestore (unicidade de email via doc-indice)"
```

---

### Task 5: Migrar `authController` para `userRepository`

**Files:**
- Modify: `backend/src/controllers/authController.js:3,15,27,51`
- Test: `backend/tests/authController.firestore.test.js`

**Interfaces:**
- Consumes: `getUserById`, `getUserByEmail` da Task 4.

- [ ] **Step 1: Teste — login busca usuário via repo (mock do repositório)**

```js
// backend/tests/authController.firestore.test.js
import { jest } from '@jest/globals'
jest.unstable_mockModule('../src/repositories/userRepository.js', () => ({
  getUserByEmail: jest.fn(async () => ({ id: 'u1', password: '$2b$10$hash', role: 'FAMILIAR', name: 'A' })),
  getUserById: jest.fn(),
}))
// ... importa LoginUser depois do mock; asserta 401 p/ senha errada e 200 p/ ok
```

- [ ] **Step 2: Rodar e ver falhar** — FAIL (controller ainda chama `prisma`).

- [ ] **Step 3: Trocar chamadas Prisma por repositório**

Substituir em `authController.js`:
- `import prisma from '../lib/prisma.js'` → `import { getUserById, getUserByEmail } from '../repositories/userRepository.js'`
- `prisma.user.findUnique({ where: { email } })` → `getUserByEmail(email)`
- `prisma.user.findUnique({ where: { id: req.params.id }, select })` → `getUserById(req.params.id)` + aplicar `project(user, isSelf ? USER_SELF_SELECT : USER_PUBLIC_SELECT)` em memória.
- `prisma.user.findUnique({ where: { id: req.userId } })` (checagem de role do requester) → `getUserById(req.userId)`.

- [ ] **Step 4: Rodar e ver passar** — PASS.

- [ ] **Step 5: Commit** — `git commit -m "refactor(auth): authController usa userRepository (Firestore)"`

---

### Task 6: Migrar `userController` + `middlewares/requireRole`

**Files:**
- Modify: `backend/src/controllers/userController.js` (10 chamadas prisma), `backend/src/middlewares/requireRole.js`
- Test: `backend/tests/userController.firestore.test.js`

- [ ] **Step 1:** Teste cobrindo: criar usuário (hash bcrypt + `createUser`), `listUsers` com paginação por cursor, `getUserById` projeção pública vs self, update de perfil.
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3:** Trocar `prisma.user.*` por `userRepository.*`. **Atenção:** a paginação muda de `?page=N` (offset) para `?cursor=<id>` — atualizar o contrato da rota e o frontend que consome a listagem (`frontend/src/...` que chama `/users?page=`). Documentar a quebra de contrato no PR. `requireRole` troca `prisma.user.findUnique` por `getUserById`.
- [ ] **Step 4:** Rodar e ver passar.
- [ ] **Step 5:** Commit — `refactor(users): userController e requireRole em Firestore; paginacao por cursor`.

> **RISCO (médio):** mudança de paginação offset→cursor afeta o frontend. Se preferir manter `?page=N` no MVP, implemente offset emulado (buscar `page*limit` e descartar) — aceitável só p/ volumes pequenos. Decidir com o usuário.

---

### Task 7: `solicitacaoRepository` + `solicitacaoController`

**Files:**
- Create: `backend/src/repositories/solicitacaoRepository.js`
- Modify: `backend/src/controllers/solicitacaoController.js` (15 chamadas prisma)
- Test: `backend/tests/repositories/solicitacaoRepository.test.js` (emulador)

**Interfaces:**
- Produces: `create`, `getById`, `update`, `listByFamiliar(familiarId)`, `listOpenFeed({ excludeViewedBy, status })`, `addViewer(id, caregiverId)` (array-union), `assignCaregiver(id, caregiverId)`.

- [ ] **Step 1:** Testes: criar; `listByFamiliar` ordenado por `createdAt desc`; feed por `status=ABERTA`; `addViewer` usa `FieldValue.arrayUnion` (sem duplicar).
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3:** Implementar repositório. Mapear o `OR` do feed (`solicitacaoController:282`) para 2 queries + merge, OU `Filter.or`. `viewedByIds` via `arrayUnion`. Trocar todas as 15 chamadas no controller.
- [ ] **Step 4:** Rodar e ver passar (exige índices da Task 3).
- [ ] **Step 5:** Commit — `feat(solicitacao): repositorio e controller em Firestore`.

---

### Task 8: `chargeRequestRepository` + controller/serviço

**Files:**
- Create: `backend/src/repositories/chargeRequestRepository.js`
- Modify: `backend/src/controllers/chargeRequestController.js` (7), `backend/src/services/chargeRequestService.js` (4)
- Test: `backend/tests/repositories/chargeRequestRepository.test.js`

**Interfaces:**
- Produces: `create`, `getById`, `update`, `findPendingForPair({caregiverId,familiarId})`, `listForFamiliar(familiarId)`.

- [ ] **Step 1:** Testes: cobrança PENDING única por par; transição para PAID/CANCELLED; listagem ordenada.
- [ ] **Step 2:** Falhar. **Step 3:** Implementar; o `OR` em `chargeRequestController:81` vira 2 queries ou `Filter.or`. **Step 4:** Passar. **Step 5:** Commit — `feat(charge): repositorio e controller em Firestore`.

---

### Task 9: `paymentRepository` + `paymentController` + webhook

**Files:**
- Create: `backend/src/repositories/paymentRepository.js`
- Modify: `backend/src/controllers/paymentController.js` (8), `backend/src/services/paymentWebhookService.js` (4)
- Test: `backend/tests/repositories/paymentRepository.test.js`

**Interfaces:**
- Produces: `create`, `getById`, `getByBillingId(billingId)` (via doc-índice `paymentsByBilling`), `markPaid(id, paidAt)`, `findByEitherBillingId(billingId)` (cobre `OR:[billingId, gatewayBillingId]`).

- [ ] **Step 1:** Testes: criar pagamento + índice de billing; `findByEitherBillingId` acha por gateway id; `markPaid` idempotente.
- [ ] **Step 2:** Falhar.
- [ ] **Step 3:** Implementar. `billingId` único via `paymentsByBilling/{billingId}`. O `OR:[{billingId},{gatewayBillingId}]` (webhook) → tentar índice de billing; se nada, `where('gatewayBillingId','==',id)`. Trocar chamadas no controller e no webhook.
- [ ] **Step 4:** Passar. **Step 5:** Commit — `feat(payment): repositorio e webhook em Firestore`.

---

### Task 10: `escrowRepository` — transações ACID (NÚCLEO DE RISCO)

**Files:**
- Create: `backend/src/repositories/escrowRepository.js`
- Test: `backend/tests/repositories/escrowRepository.test.js` (emulador, inclui teste de concorrência)

**Interfaces:**
- Produces:
  - `createEscrowForPayment(tx, {...})` — agora recebe uma `tx` do Firestore.
  - `getByPaymentId(paymentId)` (via `escrowsByPayment`)
  - `runTransition({ escrowId, fromStatuses, targetStatus, patch, writeAudit, idempotencyKey?, operation?, actorId, buildBody })` — encapsula `db.runTransaction` com compare-and-set + auditoria + (opcional) idempotência por doc-id.
  - `getAuditTrail(escrowId)` (subcoleção, `orderBy createdAt asc`)

- [ ] **Step 1: Teste de compare-and-set sob concorrência**

```js
// dois RELEASE concorrentes sobre o mesmo escrow → exatamente 1 aplica,
// o outro retorna idempotente/conflito; estado final = RELEASED; 1 audit log.
test('transicao concorrente aplica uma vez só', async () => { /* dispara 2 runTransition em paralelo */ })
```

- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3: Implementar `runTransition` com `db.runTransaction`**

Padrão (substitui o `updateMany` condicional do Prisma):
```js
// dentro de db.runTransaction(async (tx) => { ... })
const ref = db.collection('escrows').doc(escrowId)
const snap = await tx.get(ref)
if (!snap.exists) throw Object.assign(new Error('Custódia não encontrada.'), { statusCode: 404 })
const escrow = mapDoc(snap)
if (!fromStatuses.includes(escrow.status)) {
  // já no alvo? → idempotente; senão → 409 conflito
}
// idempotência: tx.get(idemRef); se existir e bater operação → retorna body cacheado; senão cria
tx.update(ref, patch)                                   // compare-and-set garantido pela transação
tx.set(ref.collection('auditLogs').doc(), auditPayload) // mesma transação
if (idempotencyKey) tx.create(db.collection('escrowIdempotencyKeys').doc(idempotencyKey), idemRecord)
```
A `tx.create` no doc-id = chave garante a unicidade (lança se repetida). Toda a lógica de `escrowStateMachine.assertEscrowTransition` é reaproveitada **sem mudança**.

- [ ] **Step 4:** Rodar e ver passar (incluindo o teste de concorrência).
- [ ] **Step 5:** Commit — `feat(escrow): repositorio Firestore com transacoes ACID e idempotencia por doc-id`.

---

### Task 11: Migrar `escrowService` + `escrowController` para o repositório

**Files:**
- Modify: `backend/src/services/escrowService.js` (6 chamadas prisma + `$transaction`), `backend/src/controllers/escrowController.js` (2)
- Test: `backend/tests/escrowService.firestore.test.js` (porta `escrowStateMachine.test.js` + fluxo HOLD/RELEASE/DISPUTE)

- [ ] **Step 1:** Portar os testes existentes de escrow para o novo backend (mesmos cenários: PENDING→HELD só com PAID; RELEASE só pelo payer; DISPUTE só por participante; idempotência retorna mesmo body).
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3:** Reescrever `holdEscrowFunds`, `transitionEscrowWithIdempotency`, `releaseEscrowFunds`, `disputeEscrowFunds`, `getEscrowAuditTrail`, `createEscrowForPayment` usando `escrowRepository.runTransition`/`getByPaymentId`/`getAuditTrail`. Remover `import prisma`. **A máquina de estados e as funções `authorize` permanecem idênticas.**
- [ ] **Step 4:** Rodar e ver passar.
- [ ] **Step 5:** Commit — `refactor(escrow): service e controller sobre escrowRepository (sem Prisma)`.

---

### Task 12: Migrar `messageController` (peers) + health check

**Files:**
- Modify: `backend/src/controllers/messageController.js:107` (`prisma.user.findMany({id:{in}})` → `listUsersByIds`), `backend/src/controllers/observabilityController.js:9` (ping Mongo → ping Firestore)
- Test: `backend/tests/observability.firestore.test.js`

- [ ] **Step 1:** Teste do health: `checkDatabase` retorna `{ok:true}` quando Firestore responde; `{ok:false}` no timeout.
- [ ] **Step 2:** Falhar.
- [ ] **Step 3:** `checkDatabase` passa a fazer uma leitura leve com timeout:
```js
await Promise.race([
  db.collection('_health').doc('ping').get(),
  new Promise((_, r) => setTimeout(() => r(new Error('db_timeout')), timeoutMs)),
])
```
`messageController` usa `listUsersByIds(peerIds)`.
- [ ] **Step 4:** Passar. **Step 5:** Commit — `refactor(health,messages): Firestore no health check e peers`.

---

### Task 13: Remover Prisma/Mongo do projeto

**Files:**
- Delete: `backend/prisma/` (todo), `backend/src/lib/prisma.js`, `backend/scripts/migrate-messages-to-firebase.js`
- Modify: `backend/package.json` (remover `@prisma/client`, `prisma`, scripts `prisma:*`, `postinstall` de generate), `backend/.env.example` (remover `DATABASE_URL`), comentários em `validation.js`/`metrics.js`/`paymentSchemas.js` que dizem "ObjectId Mongo" (reescrever: IDs do Firestore têm 20 chars alfanuméricos — ajustar `isValidObjectId`/regex se ainda validarem 24-hex! ver risco).

- [ ] **Step 1:** `grep -rn "prisma\|mongo" backend/src backend/server.js` → garantir 0 código ativo.
- [ ] **Step 2:** Ajustar `validation.js`/`paymentSchemas.js`: a validação de ID hoje exige `^[0-9a-fA-F]{24}$` (ObjectId). **IDs do Firestore não são 24-hex** → trocar por validação de ID do Firestore (`^[A-Za-z0-9_-]{1,1500}$`) ou remover a checagem de formato. Atualizar os testes `validation.test.js`.
- [ ] **Step 3:** `cd backend && npm remove @prisma/client prisma && npm install`.
- [ ] **Step 4:** Rodar a suíte inteira: `npx jest` → tudo verde.
- [ ] **Step 5:** Commit — `chore(db): remove Prisma/MongoDB do backend`.

> **RISCO (ALTO e fácil de esquecer):** a regex de ObjectId 24-hex em `validation.js`/`paymentSchemas.js`/`metrics.js`. Se não for ajustada, **toda rota que valida `:id` rejeitará os novos IDs do Firestore** com 422. Esta é a causa mais provável de "tudo quebrar" pós-migração.

---

### Task 14: README + `.env.example` de Firebase-only

**Files:**
- Modify: `backend/.env.example`, `README.MD`, `GUIA_DE_DEPLOY.md`

- [ ] **Step 1:** Remover `DATABASE_URL`; documentar variáveis `FIREBASE_*` + `FIRESTORE` + comando do emulador para testes.
- [ ] **Step 2:** Atualizar deploy: remover passo `prisma generate`/`migrate`; adicionar `firebase deploy --only firestore:indexes,firestore:rules`.
- [ ] **Step 3:** Commit — `docs: atualiza setup para Firebase-only`.

---

### Task 15: Script de migração de dados + cutover

**Files:**
- Create: `backend/scripts/migrate-mongo-to-firestore.js`
- Test: dry-run validado manualmente contra um dump.

**Interfaces:**
- Lê do Mongo (usando o `mongodb` driver direto OU um último `PrismaClient` temporário em branch separada) e grava no Firestore preservando IDs.

- [ ] **Step 1:** Implementar export por coleção, na ordem: `users` (+`usersByEmail`), `solicitacoes`, `chargeRequests`, `payments` (+`paymentsByBilling`), `escrows` (+`escrowsByPayment`, +subcoleção `auditLogs`), `escrowIdempotencyKeys` (doc-id=key). Converter Date→Timestamp, enums→string. **Idempotente:** usar `set` com `doc(oldId)`; rodar 2x não duplica.
- [ ] **Step 2:** Dry-run com `--limit 5` logando o que gravaria (sem escrever).
- [ ] **Step 3:** Rodar contra base real (janela de manutenção curta), conferindo contagens por coleção (Mongo vs Firestore) com `count()`.
- [ ] **Step 4:** Cutover: deploy do backend Firebase-only + índices/regras; smoke test (login, criar solicitação, fluxo de cobrança em ambiente de teste com `PAYMENT_ENABLED=true`).
- [ ] **Step 5:** Commit — `feat(migration): script Mongo->Firestore com preservacao de IDs`. Depois: **rotacionar/descartar credenciais do Mongo** e desligar o cluster.

---

## Riscos (resumo priorizado)

1. **🔴 Validação de ID 24-hex (ObjectId):** `validation.js`/`paymentSchemas.js`/`metrics.js` rejeitam IDs do Firestore. Corrigir na Task 13 — causa nº 1 de "tudo quebrar".
2. **🔴 Atomicidade do escrow:** preservada por `db.runTransaction` (Task 10/11); cobrir com teste de concorrência. Erro aqui = movimento de fundos duplicado.
3. **🟠 Paginação offset→cursor:** quebra contrato `/users?page=N` com o frontend (Task 6). Decidir manter offset emulado vs adotar cursor.
4. **🟠 Unicidade (email, billingId, paymentId, idempotencyKey):** sem `@unique` no Firestore — garantida por doc-índices/doc-id em transação. Se mal feito, gera duplicatas.
5. **🟠 `OR` queries:** Firestore exige split em N queries ou `Filter.or` (Admin SDK ≥ 11.4). Conferir versão do `firebase-admin`.
6. **🟡 Migração de dados:** conversão de tipos (Date/enum/array) e preservação de IDs; validar por contagem.
7. **🟡 Custo/quotas:** Firestore cobra por leitura/escrita; o health check e listagens frequentes podem multiplicar leituras — usar leitura leve no health.
8. **🟡 `Message` legado:** confirmar que o model Prisma `Message` está morto (chat já no RTDB) antes de removê-lo.

## Self-Review (cobertura do spec)

- "Usar somente Firebase" → Tasks 1–13 movem 100% da persistência; Task 13 remove Prisma/Mongo (constraint global verificada por grep). ✅
- "Todo código MongoDB removido" → Task 13 + ajuste das regex de ObjectId. ✅
- "Pagamento oculto" → já entregue (flag `PAYMENT_ENABLED`); backend de pagamento ainda é migrado (Tasks 9–11). ✅
- Mapeamento de modelos → tabela dedicada. ✅ Ordem → seção "Ordem de Execução". ✅ Riscos → seção dedicada. ✅
- Chat permanece no RTDB (já é Firebase) → Task 12 não toca no transporte de mensagens. ✅
