# Migração de Autenticação para Firebase Auth — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a autenticação própria (bcrypt + JWT) pelo Firebase Auth como fonte de identidade, habilitando login e-mail/senha, Google, reset de senha e verificação de e-mail bloqueante.

**Architecture:** O frontend usa o Firebase Auth SDK; o ID token vai como `Bearer` em cada request. O backend verifica o ID token (`verifyIdToken`), lê `role` de custom claim e recusa e-mail não verificado (403). A coleção `users` do Firestore vira o perfil, chaveada pelo uid do Firebase. O custom token do chat é removido (o usuário já está logado no Firebase Auth).

**Tech Stack:** Firebase Auth (JS SDK v10, client) + firebase-admin (backend), Express 5, Zod, React + Vite, vitest + testing-library (frontend), node:test (backend), sonner (toasts), Tailwind + UI kit local.

## Global Constraints

- **Backend ESM** (`"type": "module"`) — usar `import`/`export`, extensões `.js` nos imports.
- **Backend tests:** `node --test "tests/*.test.js"` — unitários puros, **sem mock de módulo**. Lógica testável deve ser injetável/pura.
- **Repositórios não têm teste unitário** (dependem do Firestore) — verificação é manual/via server, seguindo a convenção do projeto.
- **Frontend tests:** `vitest` + `@testing-library/react`; mocks via `vi.mock`.
- **Perfil `users`:** doc id = uid do Firebase; **sem campo `password`**; `email` denormalizado.
- **CPF obrigatório**; verificação de e-mail **bloqueante** (front + back); Google já vem verificado.
- **Compat localStorage:** manter populando `meuId`, `meuNome`, `meuRole` após login (páginas legadas leem esses); remover apenas `meuToken`.
- **Mensagens ao usuário em pt-BR.** Credenciais inválidas → mensagem genérica (anti-enumeração).
- **Firebase Admin passa a ser obrigatório** no backend (auth depende dele).
- Commits pequenos e frequentes; mensagens em pt-BR seguindo o padrão do repo (`feat(auth):`, `refactor(auth):`, etc.).

---

## FASE A — Backend

### Task 1: `checkToken` verifica ID token do Firebase (factory injetável)

**Files:**
- Modify: `backend/src/middlewares/checkToken.js`
- Test: `backend/tests/checkToken.test.js` (create)

**Interfaces:**
- Produces:
  - `makeCheckToken(verifyIdToken, { requireVerified }) => (req,res,next)` — factory; `verifyIdToken(idToken): Promise<DecodedIdToken>`.
  - `checkToken` — instância `requireVerified: true` (verificador real do Firebase Admin).
  - `checkTokenAllowUnverified` — instância `requireVerified: false`.
  - Efeitos no `req`: `req.userId` (uid), `req.userRole` (claim `role`, pode ser undefined), `req.email`, `req.emailVerified`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/tests/checkToken.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeCheckToken } from '../src/middlewares/checkToken.js'

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
}

const decodedOk = { uid: 'uid123', role: 'CUIDADOR', email: 'a@b.com', email_verified: true }

test('checkToken: token válido e verificado popula req e chama next', async () => {
  const check = makeCheckToken(async () => decodedOk, { requireVerified: true })
  const req = { headers: { authorization: 'Bearer tok' } }
  const res = mockRes()
  let called = false
  await check(req, res, () => { called = true })
  assert.equal(called, true)
  assert.equal(req.userId, 'uid123')
  assert.equal(req.userRole, 'CUIDADOR')
  assert.equal(req.email, 'a@b.com')
  assert.equal(req.emailVerified, true)
})

test('checkToken: sem header Authorization retorna 401', async () => {
  const check = makeCheckToken(async () => decodedOk, { requireVerified: true })
  const req = { headers: {} }
  const res = mockRes()
  await check(req, res, () => { throw new Error('não deveria chamar next') })
  assert.equal(res.statusCode, 401)
})

test('checkToken: token inválido (verifyIdToken lança) retorna 401', async () => {
  const check = makeCheckToken(async () => { throw new Error('bad token') }, { requireVerified: true })
  const req = { headers: { authorization: 'Bearer tok' } }
  const res = mockRes()
  await check(req, res, () => { throw new Error('não deveria chamar next') })
  assert.equal(res.statusCode, 401)
})

test('checkToken (requireVerified): e-mail não verificado retorna 403', async () => {
  const check = makeCheckToken(async () => ({ ...decodedOk, email_verified: false }), { requireVerified: true })
  const req = { headers: { authorization: 'Bearer tok' } }
  const res = mockRes()
  await check(req, res, () => { throw new Error('não deveria chamar next') })
  assert.equal(res.statusCode, 403)
})

test('checkTokenAllowUnverified: e-mail não verificado ainda chama next', async () => {
  const check = makeCheckToken(async () => ({ ...decodedOk, email_verified: false }), { requireVerified: false })
  const req = { headers: { authorization: 'Bearer tok' } }
  const res = mockRes()
  let called = false
  await check(req, res, () => { called = true })
  assert.equal(called, true)
  assert.equal(req.emailVerified, false)
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd backend && node --test tests/checkToken.test.js`
Expected: FAIL — `makeCheckToken` não existe / não é função.

- [ ] **Step 3: Reescrever o middleware**

Substituir todo o conteúdo de `backend/src/middlewares/checkToken.js`:

```js
import { firebaseAdmin } from '../lib/firebase.js'
import { authLogger } from '../lib/logger.js'

/**
 * Factory do middleware de autenticação. Verifica o ID token do Firebase e
 * popula req.userId/userRole/email/emailVerified.
 *
 * @param {(idToken: string) => Promise<object>} verifyIdToken - verificador (injetável p/ testes)
 * @param {{ requireVerified: boolean }} opts - se true, recusa e-mail não verificado (403)
 */
export function makeCheckToken(verifyIdToken, { requireVerified }) {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization']
    if (!authHeader) {
      authLogger.warn('http:auth_missing', { path: req.path, method: req.method, ip: req.ip })
      return res.status(401).json({ msg: 'Token não fornecido' })
    }
    const idToken = authHeader.split(' ')[1]
    if (!idToken) {
      authLogger.warn('http:auth_malformed', { path: req.path, method: req.method, ip: req.ip })
      return res.status(401).json({ msg: 'Formato de token inválido' })
    }

    let decoded
    try {
      decoded = await verifyIdToken(idToken)
    } catch (err) {
      authLogger.warn('http:auth_invalid', { error: err.message, path: req.path, method: req.method, ip: req.ip })
      return res.status(401).json({ msg: 'Token inválido ou expirado' })
    }

    req.userId = decoded.uid
    req.userRole = decoded.role // custom claim; pode ser undefined até o perfil ser criado
    req.email = decoded.email
    req.emailVerified = decoded.email_verified === true

    if (requireVerified && !req.emailVerified) {
      authLogger.warn('http:auth_email_unverified', { userId: req.userId, path: req.path })
      return res.status(403).json({ msg: 'Confirme seu e-mail para continuar.' })
    }

    authLogger.info('http:auth_ok', { userId: req.userId, path: req.path, method: req.method })
    next()
  }
}

/** Verificador real do Firebase Admin. */
const realVerify = (idToken) => firebaseAdmin.auth().verifyIdToken(idToken)

/** Exige e-mail verificado (maioria das rotas). */
export const checkToken = makeCheckToken(realVerify, { requireVerified: true })

/** Verifica o token mas NÃO exige e-mail confirmado (POST /users, GET /users/me). */
export const checkTokenAllowUnverified = makeCheckToken(realVerify, { requireVerified: false })

export default checkToken
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd backend && node --test tests/checkToken.test.js`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/middlewares/checkToken.js backend/tests/checkToken.test.js
git commit -m "feat(auth): checkToken verifica ID token do Firebase + gate de e-mail verificado"
```

---

### Task 2: Schemas de usuário sem senha; remover schema de login

**Files:**
- Modify: `backend/src/schemas/userSchemas.js` (remover `password` de `createUserBodySchema`)
- Delete: `backend/src/schemas/authSchemas.js`
- Test: `backend/tests/userSchemas.test.js` (create)

**Interfaces:**
- Consumes: `createUserBodySchema`, `updateUserBodySchema` (existentes).
- Produces: `createUserBodySchema` sem `password` e sem `email` obrigatório do body (o e-mail vem do token verificado). `role`, `name`, `cpf` continuam obrigatórios.

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/tests/userSchemas.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createUserBodySchema } from '../src/schemas/userSchemas.js'

test('createUserBodySchema NÃO exige password (auth é do Firebase)', () => {
  const r = createUserBodySchema.safeParse({
    name: 'Ana Silva',
    role: 'FAMILIAR',
    cpf: '390.533.447-05', // CPF válido
  })
  assert.equal(r.success, true, JSON.stringify(r.error?.issues))
  assert.equal('password' in r.data, false)
})

test('createUserBodySchema exige role válido', () => {
  const r = createUserBodySchema.safeParse({ name: 'Ana', role: 'OUTRO', cpf: '390.533.447-05' })
  assert.equal(r.success, false)
})

test('createUserBodySchema exige CPF válido', () => {
  const r = createUserBodySchema.safeParse({ name: 'Ana', role: 'FAMILIAR', cpf: '111.111.111-11' })
  assert.equal(r.success, false)
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd backend && node --test tests/userSchemas.test.js`
Expected: FAIL — schema ainda exige `password`/`email`.

- [ ] **Step 3: Editar o schema**

Em `backend/src/schemas/userSchemas.js`, no `createUserBodySchema`, **remover** as linhas:

```js
  email: emailSchema,
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres.').max(128),
```

O `email` deixa de vir do body (será obtido do token). O restante do objeto permanece igual. Manter o `import { emailSchema }`? Sim — `updateUserBodySchema` ainda usa `emailSchema.optional()`; deixar o import. Se após a edição do controller o `updateUserBodySchema` também remover `email`, remover o import então.

- [ ] **Step 4: Deletar `authSchemas.js`**

```bash
git rm backend/src/schemas/authSchemas.js
```

(É usado só por `authRoutes.js`, corrigido na Task 6.)

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `cd backend && node --test tests/userSchemas.test.js`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/src/schemas/userSchemas.js backend/tests/userSchemas.test.js
git commit -m "refactor(auth): createUserBodySchema sem senha/email; remove authSchemas"
```

---

### Task 3: userRepository — `createUserWithId` e `cpfExists`

**Files:**
- Modify: `backend/src/repositories/userRepository.js`

**Interfaces:**
- Produces:
  - `createUserWithId(uid: string, data: object): Promise<object>` — cria doc com id = uid e retorna o perfil.
  - `cpfExists(cpf: string, exceptId?: string|null): Promise<boolean>` — true se já há outro user com o CPF.

> Repositórios não têm teste unitário no projeto (dependem do Firestore). Verificação é via controller/manual (Task 4 e Task 17), seguindo a convenção.

- [ ] **Step 1: Adicionar as funções**

Em `backend/src/repositories/userRepository.js`, **substituir** a função `createUser` existente por `createUserWithId` e **adicionar** `cpfExists` logo após `emailExists`:

```js
/** true se já existe outro usuário com este CPF (ignora `exceptId`). */
export async function cpfExists(cpf, exceptId = null) {
  if (!cpf) return false
  const snap = await col().where('cpf', '==', cpf).limit(2).get()
  return snap.docs.some((d) => d.id !== exceptId)
}

/** Cria o perfil com id = uid do Firebase Auth (não usa id automático). */
export async function createUserWithId(uid, data) {
  await col().doc(uid).set(serialize(data))
  return getUserById(uid)
}
```

Remover a antiga:

```js
export async function createUser(data) {
  const ref = col().doc()
  await ref.set(serialize(data))
  return getUserById(ref.id)
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/repositories/userRepository.js
git commit -m "feat(auth): createUserWithId (id = uid) e cpfExists no userRepository"
```

---

### Task 4: `createUsers` cria perfil por uid + custom claim; `deleteUsers` remove do Firebase Auth

**Files:**
- Modify: `backend/src/controllers/userController.js`

**Interfaces:**
- Consumes: `req.userId` (uid), `req.email` (do token); `createUserWithId`, `cpfExists`, `emailExists` (repo); `firebaseAdmin` (`setCustomUserClaims`, `deleteUser`).
- Produces: `POST /users` cria `users/{uid}` com `role` em custom claim; `DELETE /users/:id` remove perfil + usuário do Firebase Auth.

> Controller verificado via server/manual (Task 17), como os demais controllers do projeto.

- [ ] **Step 1: Ajustar imports e `createUsers`**

Em `backend/src/controllers/userController.js`:

Trocar o import do repo para incluir os novos nomes e remover `createUser`/`getUserByEmail` se não usados mais:

```js
import {
  getUserById,
  emailExists,
  cpfExists,
  createUserWithId,
  updateUser,
  deleteUser,
  listByRole,
} from '../repositories/userRepository.js'
import { firebaseAdmin } from '../lib/firebase.js'
```

Remover `import bcrypt from 'bcrypt'` (não há mais hash).

Substituir a função `createUsers` inteira por:

```js
/**
 * POST /users — cria o PERFIL do usuário já autenticado no Firebase Auth.
 * O uid e o e-mail vêm do token verificado (checkTokenAllowUnverified), não do
 * body. Body validado por createUserBodySchema (sem senha/email).
 */
const createUsers = async (req, res) => {
  const uid = req.userId
  const email = req.email
  const {
    name, birthDate: birthDateRaw, role, bio, cpf,
    profileImage, crm_crf, hourlyRate: hourlyRateRaw, registerNumber,
    approach, specialties, description, city, state,
  } = req.body

  const birthDate = parseBirthDate(birthDateRaw)
  const hourlyRate = parseHourlyRate(hourlyRateRaw)
  if (hourlyRateRaw != null && hourlyRateRaw !== '' && hourlyRate === null) {
    return res.status(422).json({ msg: 'Valor por hora inválido' })
  }

  try {
    // Idempotência: se o perfil já existe (retry), não recria.
    const already = await getUserById(uid)
    if (already) {
      const user = project(already, USER_SELF_SELECT)
      return res.status(200).json({ user })
    }
    if (await emailExists(email, uid)) {
      return res.status(409).json({ msg: 'Este e-mail já está cadastrado' })
    }
    if (await cpfExists(cpf, uid)) {
      return res.status(409).json({ msg: 'Este CPF já está cadastrado' })
    }

    const created = await createUserWithId(uid, {
      name,
      birthDate,
      role,
      bio: bio ?? '',
      email,
      cpf: cpf ?? null,
      profileImage: emptyToNull(profileImage),
      crm_crf: role === 'CUIDADOR' ? emptyToNull(crm_crf) : null,
      registerNumber: emptyToNull(registerNumber),
      hourlyRate,
      specialties: parseSpecialties(specialties),
      approach: emptyToNull(approach),
      description: emptyToNull(description),
      city: emptyToNull(city),
      state: emptyToNull(state),
    })

    // role em custom claim → checkToken/requireRole leem sem read extra no Firestore.
    await firebaseAdmin.auth().setCustomUserClaims(uid, { role })

    const user = project(created, USER_SELF_SELECT)
    authLogger.info('auth:register_success', { userId: uid, role, ip: req.ip })
    return res.status(201).json({ user })
  } catch (error) {
    logger.error('user:create_failed', { error: error.message, stack: error.stack, endpoint: req.originalUrl })
    return res.status(500).json({ msg: 'Erro ao criar conta. Tente novamente.' })
  }
}
```

- [ ] **Step 2: Ajustar `updateUsers` (e-mail não editável) e `deleteUsers`**

Em `updateUsers`, remover a linha que injeta `email` no patch e o bloco de `emailExists`:

Remover:
```js
    ...(req.body.email != null && { email: req.body.email }),
```
e remover:
```js
    // Unicidade de email no update (substitui o tratamento de P2002 do Prisma).
    if (data.email != null && (await emailExists(data.email, req.params.id))) {
      return res.status(409).json({ msg: 'Este e-mail já está cadastrado' })
    }
```
(O e-mail é gerido pelo Firebase Auth; não muda por esta rota.)

Em `deleteUsers`, dentro do `try`, antes/depois de `await deleteUser(...)`, adicionar a remoção no Firebase Auth:

```js
  try {
    await deleteUser(req.params.id)
    // Remove também a credencial no Firebase Auth (o id do perfil = uid).
    try {
      await firebaseAdmin.auth().deleteUser(req.params.id)
    } catch (e) {
      logger.warn('user:firebase_delete_failed', { userId: req.userId, error: e.message })
    }
    authLogger.info('user:deleted', { userId: req.userId })
    res.status(200).json({ message: 'Usuário deletado com sucesso' })
  } catch (error) {
```

- [ ] **Step 3: Rodar toda a suíte backend (não deve quebrar)**

Run: `cd backend && npm test`
Expected: PASS (inclui checkToken e userSchemas; nenhum teste referencia `createUser`/`bcrypt`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/userController.js
git commit -m "feat(auth): POST /users cria perfil por uid + custom claim de role; delete remove do Firebase Auth"
```

---

### Task 5: `authController` — remover login; adicionar `GET /users/me`

**Files:**
- Modify: `backend/src/controllers/authController.js`

**Interfaces:**
- Produces: `getCurrentUser(req,res)` → 200 `{ user }` (self select) ou 404 se não há perfil. Handler de `GET /users/me`.
- Removed: `LoginUser`.

- [ ] **Step 1: Reescrever o controller**

Substituir todo o `backend/src/controllers/authController.js` por:

```js
import { getUserById as findUserById } from '../repositories/userRepository.js'
import { project } from '../repositories/_helpers.js'
import { logger } from '../lib/logger.js'
import { USER_PUBLIC_SELECT, USER_SELF_SELECT } from '../lib/userSelects.js'

export const getUserById = async (req, res) => {
  try {
    const isSelf = req.userId === req.params.id
    const fullUser = await findUserById(req.params.id)
    if (!fullUser) {
      return res.status(404).json({ msg: 'Usuário não encontrado!' })
    }
    if (!isSelf && fullUser.role === 'FAMILIAR') {
      const requester = await findUserById(req.userId)
      if (requester?.role === 'CUIDADOR') {
        return res.status(403).json({ msg: 'Acesse este familiar através de uma Solicitação.' })
      }
    }
    const user = project(fullUser, isSelf ? USER_SELF_SELECT : USER_PUBLIC_SELECT)
    res.status(200).json({ user })
  } catch (error) {
    logger.error('user:get_by_id_failed', {
      error: error.message, stack: error.stack, userId: req.userId,
      targetId: req.params.id, endpoint: req.originalUrl,
    })
    res.status(500).json({ error: 'Erro interno ao buscar usuário' })
  }
}

/**
 * GET /users/me — perfil do usuário autenticado, ou 404 se ainda não criou
 * (usado pelo frontend para decidir se manda para "Completar cadastro").
 * Usa checkTokenAllowUnverified: precisa responder mesmo antes da verificação
 * de e-mail (o modal de verificação vive no frontend).
 */
export const getCurrentUser = async (req, res) => {
  try {
    const fullUser = await findUserById(req.userId)
    if (!fullUser) {
      return res.status(404).json({ msg: 'Perfil não encontrado.' })
    }
    res.status(200).json({ user: project(fullUser, USER_SELF_SELECT) })
  } catch (error) {
    logger.error('user:get_me_failed', { error: error.message, stack: error.stack, userId: req.userId })
    res.status(500).json({ error: 'Erro interno ao buscar perfil' })
  }
}
```

- [ ] **Step 2: Rodar a suíte backend**

Run: `cd backend && npm test`
Expected: PASS (nada referencia `LoginUser`).

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/authController.js
git commit -m "refactor(auth): remove LoginUser; adiciona GET /users/me"
```

---

### Task 6: Rotas, remoção do custom token do chat, Firebase obrigatório, remover bcrypt

**Files:**
- Modify: `backend/src/routes/authRoutes.js`
- Modify: `backend/src/routes/userRoutes.js`
- Delete: `backend/src/routes/firebaseRoutes.js`, `backend/src/controllers/firebaseController.js`
- Modify: `backend/server.js` (remover registro da rota firebase, se houver)
- Modify: `backend/src/lib/firebase.js` (comentário/comportamento; Admin obrigatório)
- Modify: `backend/package.json` (remover `bcrypt`)

**Interfaces:**
- Consumes: `checkToken`, `checkTokenAllowUnverified` (Task 1), `getCurrentUser` (Task 5).

- [ ] **Step 1: `authRoutes.js`**

Substituir todo o conteúdo por:

```js
import express from "express"
import { getUserById, getCurrentUser } from "../controllers/authController.js"
import { checkToken, checkTokenAllowUnverified } from "../middlewares/checkToken.js"

const router = express.Router()

// Perfil do próprio usuário (permite e-mail não verificado: usado para decidir
// o fluxo de "completar cadastro" logo após o signup).
router.get('/users/me', checkTokenAllowUnverified, getCurrentUser)
router.get('/users/:id', checkToken, getUserById)

export default router
```

(Removidos: `LoginUser`, `POST /auth/login`, `loginBodySchema`, `validateZod`, `rateLimit` de login.)

- [ ] **Step 2: `userRoutes.js`**

Trocar a linha do `POST /users` para usar `checkTokenAllowUnverified` e ajustar imports:

De:
```js
import checkToken from '../middlewares/checkToken.js'
...
router.post('/users', registerLimiter, validateZod(createUserBodySchema), createUsers)
```
Para:
```js
import checkToken, { checkTokenAllowUnverified } from '../middlewares/checkToken.js'
...
// Criação do PERFIL exige token válido do Firebase (uid/email vêm dele), mas
// permite e-mail ainda não verificado (o signup ocorre antes da verificação).
router.post('/users', registerLimiter, checkTokenAllowUnverified, validateZod(createUserBodySchema), createUsers)
```
As demais rotas (`PUT/DELETE /users/:id`, `GET /users/:id/feed`) permanecem com `checkToken`.

- [ ] **Step 3: Remover a rota/controller do custom token do chat**

```bash
git rm backend/src/routes/firebaseRoutes.js backend/src/controllers/firebaseController.js
```

Em `backend/server.js`, remover o import e o `app.use(...)` de `firebaseRoutes` (procurar por `firebaseRoutes` / `firebase/token`). Se `firebaseController` for importado em outro lugar, remover.

- [ ] **Step 4: Firebase Admin obrigatório**

Em `backend/src/lib/firebase.js`, ajustar o comentário do topo e a mensagem de `firebase:missing_env` para refletir que **auth também depende do Admin SDK** (não só o chat). Não remover a degradação do chat; apenas atualizar o texto do `console.error` para:

```js
    `AVISO: variáveis de ambiente do Firebase ausentes: ${missing.join(', ')}.\n` +
    'Autenticação (verificação de ID token) e o chat em tempo real ficarão ' +
    'indisponíveis até isso ser corrigido. Configure-as no .env (veja .env.example).'
```

- [ ] **Step 5: Remover dependência `bcrypt`**

Em `backend/package.json`, remover a linha `"bcrypt": "^6.0.0",` de `dependencies`. Depois:

```bash
cd backend && npm install
```

Confirmar que nenhum arquivo importa `bcrypt`:

Run: `cd backend && grep -rn "bcrypt" src/ || echo OK`
Expected: `OK`

- [ ] **Step 6: Subir o server para sanity-check**

Run: `cd backend && npm start` (com `.env` configurado). Ou verificar que `node -e "import('./src/routes/authRoutes.js')"` importa sem erro.
Expected: servidor sobe sem erro de import; rota `POST /auth/login` não existe mais.

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "refactor(auth): rotas via Firebase ID token; remove custom token do chat e bcrypt"
```

---

## FASE B — Frontend

### Task 7: Google provider no `services/firebase.js`

**Files:**
- Modify: `frontend/src/services/firebase.js`

**Interfaces:**
- Produces: `googleProvider` exportado (`GoogleAuthProvider`), além de `firebaseAuth` já existente.

- [ ] **Step 1: Adicionar o provider**

Em `frontend/src/services/firebase.js`, no import do auth e nos exports:

Trocar:
```js
import { getAuth } from 'firebase/auth'
```
Por:
```js
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
```

Ao final, trocar:
```js
export { rtdb, firebaseAuth }
```
Por:
```js
export const googleProvider = new GoogleAuthProvider()
export { rtdb, firebaseAuth }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/firebase.js
git commit -m "feat(auth): expõe GoogleAuthProvider no firebase.js"
```

---

### Task 8: `services/auth.js` — wrappers do Firebase Auth + `mapAuthError`

**Files:**
- Create: `frontend/src/services/auth.js`
- Test: `frontend/src/services/auth.test.js`

**Interfaces:**
- Produces:
  - `registerWithEmail(email, senha): Promise<User>` (cria + `sendEmailVerification`)
  - `loginWithEmail(email, senha): Promise<User>`
  - `loginWithGoogle(): Promise<User>`
  - `resetPassword(email): Promise<void>`
  - `logout(): Promise<void>`
  - `resendVerification(): Promise<void>`
  - `reloadUser(): Promise<boolean>` (retorna `emailVerified` atual)
  - `getIdToken(): Promise<string|null>`
  - `onAuthChange(cb): unsubscribe`
  - `mapAuthError(code): string` (mensagem pt-BR)

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/services/auth.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendEmailVerification = vi.fn(() => Promise.resolve())
const createUserWithEmailAndPassword = vi.fn(() => Promise.resolve({ user: { uid: 'u1' } }))
const signInWithEmailAndPassword = vi.fn(() => Promise.resolve({ user: { uid: 'u1' } }))
const signInWithPopup = vi.fn(() => Promise.resolve({ user: { uid: 'g1' } }))
const sendPasswordResetEmail = vi.fn(() => Promise.resolve())

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: (...a) => createUserWithEmailAndPassword(...a),
  signInWithEmailAndPassword: (...a) => signInWithEmailAndPassword(...a),
  signInWithPopup: (...a) => signInWithPopup(...a),
  sendPasswordResetEmail: (...a) => sendPasswordResetEmail(...a),
  sendEmailVerification: (...a) => sendEmailVerification(...a),
  signOut: vi.fn(() => Promise.resolve()),
  onAuthStateChanged: vi.fn(),
}))
vi.mock('./firebase', () => ({ firebaseAuth: { currentUser: null }, googleProvider: {} }))

import { registerWithEmail, mapAuthError } from './auth'

describe('services/auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registerWithEmail cria a conta e dispara verificação de e-mail', async () => {
    await registerWithEmail('a@b.com', 'segredo1')
    expect(createUserWithEmailAndPassword).toHaveBeenCalled()
    expect(sendEmailVerification).toHaveBeenCalledWith({ uid: 'u1' })
  })

  it('mapAuthError traduz códigos conhecidos e usa mensagem genérica p/ credenciais', () => {
    expect(mapAuthError('auth/email-already-in-use')).toMatch(/já está/i)
    expect(mapAuthError('auth/invalid-credential')).toMatch(/inválid/i)
    expect(mapAuthError('auth/wrong-password')).toMatch(/inválid/i)
    expect(mapAuthError('codigo/desconhecido')).toMatch(/tente novamente|erro/i)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd frontend && npx vitest run src/services/auth.test.js`
Expected: FAIL — `./auth` não existe.

- [ ] **Step 3: Criar `services/auth.js`**

```js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { firebaseAuth, googleProvider } from './firebase'

/** Cria conta por e-mail/senha e dispara o e-mail de verificação. */
export async function registerWithEmail(email, senha) {
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, senha)
  await sendEmailVerification(cred.user)
  return cred.user
}

export async function loginWithEmail(email, senha) {
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, senha)
  return cred.user
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(firebaseAuth, googleProvider)
  return cred.user
}

export function resetPassword(email) {
  return sendPasswordResetEmail(firebaseAuth, email)
}

export function logout() {
  return signOut(firebaseAuth)
}

export function resendVerification() {
  if (!firebaseAuth.currentUser) return Promise.resolve()
  return sendEmailVerification(firebaseAuth.currentUser)
}

/** Recarrega o usuário e devolve o estado atual de emailVerified. */
export async function reloadUser() {
  if (!firebaseAuth.currentUser) return false
  await firebaseAuth.currentUser.reload()
  return firebaseAuth.currentUser.emailVerified === true
}

/** ID token atual (renovado pelo SDK). `forceRefresh` recarrega custom claims. */
export function getIdToken(forceRefresh = false) {
  const u = firebaseAuth.currentUser
  return u ? u.getIdToken(forceRefresh) : Promise.resolve(null)
}

export function onAuthChange(cb) {
  return onAuthStateChanged(firebaseAuth, cb)
}

const MESSAGES = {
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente em alguns minutos.',
  'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
  'auth/invalid-credential': 'Credenciais inválidas.',
  'auth/wrong-password': 'Credenciais inválidas.',
  'auth/user-not-found': 'Credenciais inválidas.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
  'auth/popup-blocked': 'Habilite pop-ups para entrar com o Google.',
}

/** Mensagem pt-BR para um código de erro do Firebase Auth. '' = silencioso. */
export function mapAuthError(code) {
  if (code in MESSAGES) return MESSAGES[code]
  return 'Não foi possível concluir. Tente novamente.'
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd frontend && npx vitest run src/services/auth.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/auth.js frontend/src/services/auth.test.js
git commit -m "feat(auth): serviço services/auth.js (email/google/reset/verify) + mapAuthError"
```

---

### Task 9: `services/api.js` — interceptor async com ID token

**Files:**
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/services/api.test.js`

**Interfaces:**
- Consumes: `getIdToken` (Task 8).
- Produces: interceptor de request `async` que anexa `Bearer <idToken>`; interceptor de response que em 401/403 redireciona para `/login` (exceto quando já em `/login`).

- [ ] **Step 1: Atualizar os testes**

Substituir `frontend/src/services/api.test.js` por:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'

const getIdTokenMock = vi.fn()
vi.mock('./auth', () => ({ getIdToken: (...a) => getIdTokenMock(...a) }))

import api from './api'

const requestFulfilled = api.interceptors.request.handlers[0].fulfilled
const responseRejected = api.interceptors.response.handlers[0].rejected

function stubLocation(pathname) {
  const assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname, assign, href: `http://localhost${pathname}` },
  })
  return assign
}

describe('api · interceptor de requisição', () => {
  beforeEach(() => vi.clearAllMocks())

  it('anexa Bearer com o ID token do Firebase', async () => {
    getIdTokenMock.mockResolvedValue('id-token-abc')
    const config = await requestFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer id-token-abc')
  })

  it('não anexa Authorization quando não há usuário logado', async () => {
    getIdTokenMock.mockResolvedValue(null)
    const config = await requestFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBeUndefined()
  })
})

describe('api · interceptor de resposta', () => {
  beforeEach(() => vi.clearAllMocks())

  it('403 fora do login redireciona para /login', async () => {
    const assign = stubLocation('/home')
    await expect(
      responseRejected({ response: { status: 403 }, config: { url: '/users/1' } }),
    ).rejects.toBeTruthy()
    expect(assign).toHaveBeenCalledWith('/login')
  })

  it('401 na tela de login NÃO redireciona', async () => {
    const assign = stubLocation('/login')
    await expect(
      responseRejected({ response: { status: 401 }, config: { url: '/users/me' } }),
    ).rejects.toBeTruthy()
    expect(assign).not.toHaveBeenCalled()
  })

  it('erros não-401/403 são apenas repassados', async () => {
    const assign = stubLocation('/home')
    await expect(
      responseRejected({ response: { status: 500 }, config: { url: '/users/1' } }),
    ).rejects.toBeTruthy()
    expect(assign).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/services/api.test.js`
Expected: FAIL (interceptor ainda usa `meuToken`).

- [ ] **Step 3: Reescrever `services/api.js`**

```js
import axios from 'axios'
import { getIdToken } from './auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002',
})

// Anexa o ID token do Firebase (renovado pelo SDK) em cada request protegido.
api.interceptors.request.use(async (config) => {
  const token = await getIdToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 (token inválido/expirado) ou 403 (e-mail não verificado / sem permissão):
// manda para o login, exceto quando já estamos na própria tela de login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const isLoginPage = window.location.pathname === '/login'
    if ((status === 401 || status === 403) && !isLoginPage) {
      window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

export default api
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/services/api.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/api.js frontend/src/services/api.test.js
git commit -m "refactor(auth): interceptor do axios usa ID token do Firebase (remove meuToken)"
```

---

### Task 10: `context/AuthContext` + `useAuth`

**Files:**
- Create: `frontend/src/context/AuthContext.jsx`

**Interfaces:**
- Consumes: `onAuthChange`, `getIdToken` (Task 8); `api` (`GET /users/me`).
- Produces: `<AuthProvider>` e `useAuth() => { firebaseUser, profile, emailVerified, needsProfile, loading, refreshProfile }`. Efeito colateral: popula `localStorage` `meuId`, `meuNome`, `meuRole` quando há perfil; limpa no logout.

- [ ] **Step 1: Criar o contexto**

```jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { onAuthChange } from '../services/auth'
import api from '../services/api'

const AuthContext = createContext(null)

function syncLocalStorage(profile) {
  if (profile) {
    localStorage.setItem('meuId', profile.id)
    if (profile.name) localStorage.setItem('meuNome', profile.name)
    if (profile.role) localStorage.setItem('meuRole', profile.role)
  } else {
    localStorage.removeItem('meuId')
    localStorage.removeItem('meuNome')
    localStorage.removeItem('meuRole')
  }
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/users/me')
      setProfile(data.user)
      syncLocalStorage(data.user)
      return data.user
    } catch (err) {
      if (err.response?.status === 404) {
        setProfile(null)
        syncLocalStorage(null)
        return null
      }
      throw err
    }
  }, [])

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setFirebaseUser(user)
      if (!user) {
        setProfile(null)
        syncLocalStorage(null)
        setLoading(false)
        return
      }
      try {
        await refreshProfile()
      } catch {
        /* deixa profile como está; erro transitório */
      } finally {
        setLoading(false)
      }
    })
    return unsub
  }, [refreshProfile])

  const value = {
    firebaseUser,
    profile,
    emailVerified: firebaseUser?.emailVerified === true,
    needsProfile: Boolean(firebaseUser) && profile === null,
    loading,
    refreshProfile,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
```

- [ ] **Step 2: Envolver o app com o provider**

Em `frontend/src/main.jsx`, importar `AuthProvider` e envolver o `<AppShell />` (ou o Router) com ele. Exemplo (ajustar ao conteúdo atual do `main.jsx`):

```jsx
import { AuthProvider } from './context/AuthContext'
// ...
root.render(
  <BrowserRouter>
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  </BrowserRouter>
)
```

- [ ] **Step 3: Sanity build**

Run: `cd frontend && npx vitest run` (não deve haver novos erros de import) e `npm run build`.
Expected: build ok.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/context/AuthContext.jsx frontend/src/main.jsx
git commit -m "feat(auth): AuthContext/useAuth com estado do Firebase + perfil (/users/me)"
```

---

### Task 11: `EmailVerificationModal`

**Files:**
- Create: `frontend/src/components/EmailVerificationModal/index.jsx`

**Interfaces:**
- Consumes: `resendVerification`, `reloadUser`, `logout` (Task 8); `ui/Button`, `sonner`.
- Produces: `<EmailVerificationModal open email onVerified onLogout />` — modal bloqueante.

- [ ] **Step 1: Criar o componente**

```jsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui'
import { resendVerification, reloadUser, logout } from '../../services/auth'

export default function EmailVerificationModal({ open, email, onVerified, onLogout }) {
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  if (!open) return null

  async function handleAlreadyConfirmed() {
    setChecking(true)
    try {
      const verified = await reloadUser()
      if (verified) onVerified()
      else toast.warning('Ainda não confirmamos seu e-mail. Verifique sua caixa de entrada.')
    } finally {
      setChecking(false)
    }
  }

  async function handleResend() {
    setResending(true)
    try {
      await resendVerification()
      toast.success('E-mail de confirmação reenviado.')
    } catch {
      toast.error('Não foi possível reenviar agora. Tente em instantes.')
    } finally {
      setResending(false)
    }
  }

  async function handleLogout() {
    await logout()
    onLogout()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-virla-texto">Confirme seu e-mail</h2>
        <p className="text-sm text-virla-muted">
          Enviamos um link de confirmação para <strong>{email}</strong>. Confirme para acessar a plataforma.
        </p>
        <div className="space-y-2">
          <Button fullWidth loading={checking} onClick={handleAlreadyConfirmed}>Já confirmei</Button>
          <Button fullWidth variant="secondary" loading={resending} onClick={handleResend}>
            Reenviar e-mail
          </Button>
          <button type="button" onClick={handleLogout} className="w-full text-sm text-virla-muted hover:text-virla-roxo pt-1">
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
```

> Ajustar a prop `variant` do `Button` ao que o UI kit expõe (ver `components/ui/Button.jsx`). Se não houver `variant`, usar `className` para o estilo secundário.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/EmailVerificationModal/index.jsx
git commit -m "feat(auth): EmailVerificationModal bloqueante (reenviar / já confirmei / sair)"
```

---

### Task 12: `pages/Login` — Firebase login + Google + reset + modal de verificação

**Files:**
- Modify: `frontend/src/pages/Login/index.jsx`
- Modify: `frontend/src/pages/Login/Login.test.jsx`

**Interfaces:**
- Consumes: `loginWithEmail`, `loginWithGoogle`, `resetPassword`, `mapAuthError`, `reloadUser` (Task 8); `useAuth` (Task 10); `EmailVerificationModal` (Task 11).

- [ ] **Step 1: Reescrever `pages/Login/index.jsx`**

```jsx
import { toast } from 'sonner'
import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Email from '@mui/icons-material/Email'
import Lock from '@mui/icons-material/Lock'
import LoginIcon from '@mui/icons-material/Login'
import ArrowBack from '@mui/icons-material/ArrowBack'
import { Field, Button, Card } from '../../components/ui'
import EmailVerificationModal from '../../components/EmailVerificationModal'
import { isValidEmail } from '../../utils/validators'
import { loginWithEmail, loginWithGoogle, resetPassword, mapAuthError, logout } from '../../services/auth'
import api from '../../services/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const inputEmail = useRef()
  const inputPassword = useRef()
  const [loading, setLoading] = useState(false)
  const [verifyModal, setVerifyModal] = useState({ open: false, email: '' })

  // Decide o destino após autenticar no Firebase: sem perfil → completar cadastro.
  async function routeAfterAuth() {
    try {
      await api.get('/users/me')
      navigate('/home')
    } catch (err) {
      if (err.response?.status === 404) navigate('/completar-cadastro')
      else throw err
    }
  }

  async function handleLogin(e) {
    e?.preventDefault()
    if (loading) return
    const email = inputEmail.current.value.trim()
    if (!isValidEmail(email)) {
      toast.warning('Informe um e-mail válido.')
      return
    }
    setLoading(true)
    try {
      const user = await loginWithEmail(email, inputPassword.current.value)
      if (!user.emailVerified) {
        setVerifyModal({ open: true, email })
        return
      }
      await routeAfterAuth()
    } catch (err) {
      const msg = mapAuthError(err.code)
      if (msg) toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    if (loading) return
    setLoading(true)
    try {
      await loginWithGoogle() // Google já vem verificado
      await routeAfterAuth()
    } catch (err) {
      const msg = mapAuthError(err.code)
      if (msg) toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot() {
    const email = inputEmail.current.value.trim()
    if (!isValidEmail(email)) {
      toast.warning('Digite seu e-mail no campo acima para redefinir a senha.')
      return
    }
    try {
      await resetPassword(email)
      toast.success('Se houver uma conta com esse e-mail, enviamos um link de redefinição.')
    } catch (err) {
      const msg = mapAuthError(err.code)
      if (msg) toast.error(msg)
    }
  }

  return (
    <div
      className="min-h-screen bg-virla-neve flex items-center justify-center px-4"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(128,0,128,0.12), transparent)' }}
    >
      <div className="w-full max-w-sm animate-fade-up">
        <div className="flex flex-col items-center mb-10">
          <img src="/favicon.ico" alt="" className="w-12 h-12 object-contain mb-3" aria-hidden />
          <h1 className="text-3xl font-display font-black text-virla-roxo tracking-tight">VIRLA</h1>
          <p className="text-virla-muted text-sm mt-1">Bem-vindo de volta</p>
        </div>

        <Card as="form" onSubmit={handleLogin} className="p-8 space-y-4">
          <h2 className="text-xl font-bold text-virla-texto mb-2">Entrar na plataforma</h2>

          <Field ref={inputEmail} label="E-mail" srOnlyLabel icon={Email} type="email" name="email" autoComplete="email" placeholder="seu@email.com" />
          <Field ref={inputPassword} label="Senha" srOnlyLabel icon={Lock} type="password" name="password" autoComplete="current-password" placeholder="Sua senha" />

          <button type="button" onClick={handleForgot} className="text-sm text-virla-roxo hover:underline self-end">
            Esqueci minha senha
          </button>

          <Button type="submit" fullWidth loading={loading} icon={LoginIcon} className="mt-2">
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>

          <Button type="button" fullWidth variant="secondary" onClick={handleGoogle} disabled={loading}>
            Entrar com Google
          </Button>

          <p className="text-center text-sm text-virla-muted pt-1">
            Não tem conta?{' '}
            <Link to="/cadastro" className="text-virla-roxo font-semibold hover:underline">Criar conta grátis</Link>
          </p>
        </Card>

        <Link to="/" className="flex items-center justify-center gap-1 mt-6 text-sm text-virla-muted hover:text-virla-roxo transition-colors">
          <ArrowBack sx={{ fontSize: 16 }} aria-hidden />
          Voltar à página inicial
        </Link>
      </div>

      <EmailVerificationModal
        open={verifyModal.open}
        email={verifyModal.email}
        onVerified={() => { setVerifyModal({ open: false, email: '' }); routeAfterAuth() }}
        onLogout={() => setVerifyModal({ open: false, email: '' })}
      />
    </div>
  )
}
```

> Ajustar `variant="secondary"` ao UI kit; se inexistente, estilizar via `className`.

- [ ] **Step 2: Reescrever `Login.test.jsx`**

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock('../../services/auth', () => ({
  loginWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  mapAuthError: (code) => (code === 'auth/invalid-credential' ? 'Credenciais inválidas.' : 'Erro.'),
}))
vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }))

import LoginPage from './index'
import { loginWithEmail, resetPassword } from '../../services/auth'
import api from '../../services/api'
import { toast } from 'sonner'

function renderLogin() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>)
}

describe('Página de Login (Firebase)', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

  it('renderiza e-mail, senha, Entrar, Google e "Esqueci minha senha"', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Sua senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /esqueci minha senha/i })).toBeInTheDocument()
  })

  it('e-mail inválido bloqueia o login', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'sem@dominio')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))
    expect(toast.warning).toHaveBeenCalled()
    expect(loginWithEmail).not.toHaveBeenCalled()
  })

  it('login verificado navega para /home', async () => {
    loginWithEmail.mockResolvedValue({ emailVerified: true })
    api.get.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
    await user.type(screen.getByPlaceholderText('Sua senha'), 'segredo1')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/home'))
  })

  it('login sem e-mail verificado mostra o modal e não navega', async () => {
    loginWithEmail.mockResolvedValue({ emailVerified: false })
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
    await user.type(screen.getByPlaceholderText('Sua senha'), 'segredo1')
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))
    await waitFor(() => expect(screen.getByText(/confirme seu e-mail/i)).toBeInTheDocument())
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('esqueci a senha com e-mail válido chama resetPassword', async () => {
    resetPassword.mockResolvedValue()
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
    await user.click(screen.getByRole('button', { name: /esqueci minha senha/i }))
    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('ana@provedor.com'))
  })
})
```

- [ ] **Step 3: Rodar os testes do Login**

Run: `cd frontend && npx vitest run src/pages/Login/Login.test.jsx`
Expected: PASS (5 testes).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Login/
git commit -m "feat(auth): Login via Firebase (email/Google/reset) + modal de verificação"
```

---

### Task 13: `pages/CompletarCadastro`

**Files:**
- Create: `frontend/src/pages/CompletarCadastro/index.jsx`
- Modify: `frontend/src/AppShell.jsx` (rota `/completar-cadastro`)

**Interfaces:**
- Consumes: `useAuth`, `getIdToken` (força refresh de claim após criar perfil); `api` (`POST /users`); UI kit.
- Produces: rota `/completar-cadastro` que coleta role + CPF + obrigatórios e cria o perfil.

- [ ] **Step 1: Criar a página**

```jsx
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Field, Button, Card } from '../../components/ui'
import api from '../../services/api'
import { getIdToken } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'

export default function CompletarCadastroPage() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [role, setRole] = useState('FAMILIAR')
  const [loading, setLoading] = useState(false)
  const nome = useRef()
  const cpf = useRef()

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return
    if (!nome.current.value.trim() || !cpf.current.value.trim()) {
      toast.warning('Preencha nome e CPF.')
      return
    }
    setLoading(true)
    try {
      await api.post('/users', {
        name: nome.current.value.trim(),
        cpf: cpf.current.value.trim(),
        role,
      })
      await getIdToken(true) // recarrega o token para trazer o custom claim de role
      await refreshProfile()
      navigate('/home')
    } catch (err) {
      const status = err.response?.status
      if (status === 409) toast.error(err.response.data?.msg ?? 'Dados já cadastrados.')
      else if (status === 422) toast.error(err.response.data?.msg ?? 'Verifique os campos.')
      else toast.error('Não foi possível concluir o cadastro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-virla-neve flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card as="form" onSubmit={handleSubmit} className="p-8 space-y-4">
          <h2 className="text-xl font-bold text-virla-texto">Completar cadastro</h2>
          <p className="text-sm text-virla-muted">Só faltam alguns dados para começar.</p>

          <Field ref={nome} label="Nome completo" name="name" placeholder="Seu nome" />
          <Field ref={cpf} label="CPF" name="cpf" placeholder="000.000.000-00" />

          <div className="flex gap-2">
            <Button type="button" fullWidth variant={role === 'FAMILIAR' ? 'primary' : 'secondary'} onClick={() => setRole('FAMILIAR')}>Familiar</Button>
            <Button type="button" fullWidth variant={role === 'CUIDADOR' ? 'primary' : 'secondary'} onClick={() => setRole('CUIDADOR')}>Cuidador</Button>
          </div>

          <Button type="submit" fullWidth loading={loading}>Concluir</Button>
        </Card>
      </div>
    </div>
  )
}
```

> Ajustar props `variant` ao UI kit. Se o cadastro exigir mais campos obrigatórios (ex.: `registerNumber` para CUIDADOR), adicioná-los condicionalmente aqui — o schema backend os aceita como opcionais.

- [ ] **Step 2: Registrar a rota**

Em `frontend/src/AppShell.jsx`: adicionar o lazy import e a rota. Como o acesso depende de estar autenticado no Firebase mas **sem** perfil, essa rota usa a guarda de auth (Task 16) — por ora, registrá-la entre as rotas autenticadas:

```jsx
const CompletarCadastro = lazy(() => import('./pages/CompletarCadastro'))
// ...
<Route path="/completar-cadastro" element={<ProtectedRoute><CompletarCadastro /></ProtectedRoute>} />
```

E adicionar `/completar-cadastro` a `HIDDEN_MENU_ROUTES`.

- [ ] **Step 3: Build sanity**

Run: `cd frontend && npm run build`
Expected: ok.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/CompletarCadastro/ frontend/src/AppShell.jsx
git commit -m "feat(auth): tela Completar cadastro (role + CPF) para 1º acesso via Google"
```

---

### Task 14: `pages/Cadastro` — registro via Firebase + Google + confirmação de senha

**Files:**
- Modify: `frontend/src/pages/Cadastro/index.jsx`
- Modify: `frontend/src/pages/Cadastro/Cadastro.test.jsx` (ajustar ao novo fluxo)

**Interfaces:**
- Consumes: `registerWithEmail`, `loginWithGoogle`, `mapAuthError` (Task 8); `api` (`POST /users`); `getIdToken`.

> A página de Cadastro atual não foi lida neste plano — o implementador deve ler `frontend/src/pages/Cadastro/index.jsx` antes de editar e preservar os campos existentes (bio, cidade, etc.). As mudanças abaixo são o **contrato** a aplicar sobre a estrutura atual.

- [ ] **Step 1: Trocar o fluxo de submit (e-mail/senha)**

Substituir a chamada atual `api.post('/users', { ...campos, email, password })` por:

```jsx
import { registerWithEmail, loginWithGoogle, mapAuthError, getIdToken } from '../../services/auth'
// ...
async function handleSubmit(e) {
  e.preventDefault()
  // ... validações existentes de campos ...
  // NOVO: confirmação de senha (FE-12)
  if (senha !== confirmaSenha) {
    toast.warning('As senhas não conferem.')
    return
  }
  setLoading(true)
  try {
    // 1) cria a credencial no Firebase (dispara verificação de e-mail)
    await registerWithEmail(email, senha)
    // 2) cria o perfil (o backend pega uid/email do token)
    await api.post('/users', {
      name, cpf, role, bio, birthDate, hourlyRate, registerNumber,
      crm_crf, approach, specialties, description, city, state,
      // NÃO enviar email/password — vêm do token/Firebase
    })
    await getIdToken(true) // traz o custom claim de role
    toast.success('Conta criada! Confirme seu e-mail para entrar.')
    navigate('/login')
  } catch (err) {
    const msg = mapAuthError(err.code) || err.response?.data?.msg || 'Não foi possível criar a conta.'
    if (msg) toast.error(msg)
  } finally {
    setLoading(false)
  }
}
```

- [ ] **Step 2: Adicionar campo "Confirmar senha" (FE-12)**

No formulário, logo após o campo de senha, adicionar um `Field type="password"` controlado por `confirmaSenha`/`setConfirmaSenha` (mesmo padrão dos demais campos da página).

- [ ] **Step 3: Botão "Cadastrar com Google"**

Adicionar um `Button type="button"` que chama:

```jsx
async function handleGoogle() {
  setLoading(true)
  try {
    await loginWithGoogle()
    navigate('/completar-cadastro')
  } catch (err) {
    const msg = mapAuthError(err.code)
    if (msg) toast.error(msg)
  } finally {
    setLoading(false)
  }
}
```

- [ ] **Step 4: Ajustar `Cadastro.test.jsx`**

Ler o teste atual e substituir as expectativas que assumem `POST /users` com `password`/`email` e/ou salvamento de `meuToken`. Mockar `../../services/auth` (registerWithEmail/loginWithGoogle/mapAuthError/getIdToken) e `../../services/api`. Garantir ao menos:
- senhas divergentes → `toast.warning` e `registerWithEmail` não chamado;
- fluxo feliz → `registerWithEmail` chamado, depois `api.post('/users', ...)` sem `password`, depois navega para `/login`.

- [ ] **Step 5: Rodar os testes de Cadastro**

Run: `cd frontend && npx vitest run src/pages/Cadastro/Cadastro.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Cadastro/
git commit -m "feat(auth): Cadastro via Firebase (email+Google) com confirmação de senha"
```

---

### Task 15: Guardas de rota via estado do Firebase + varredura `meuToken` + chat

**Files:**
- Modify: `frontend/src/AppShell.jsx`
- Modify: `frontend/src/hooks/useAuthRedirect.js`
- Modify: `frontend/src/hooks/useFirebaseChat.js`
- Modify: `frontend/src/services/socket.js`
- Delete: `frontend/src/services/firebaseAuth.js`

**Interfaces:**
- Consumes: `useAuth` (Task 10), `getIdToken` (Task 8).

- [ ] **Step 1: Guardas do `AppShell.jsx` usam `useAuth`**

Substituir as guardas que leem `localStorage.getItem('meuToken')`/`meuId` por checagem do contexto. Enquanto `loading` for true, exibir o `PageFallback` (evita "flash" para /login antes do Firebase inicializar). Exemplo do `ProtectedRoute`:

```jsx
import { useAuth } from './context/AuthContext'
// ...
function ProtectedRoute({ children }) {
  const { firebaseUser, needsProfile, loading } = useAuth()
  if (loading) return <PageFallback />
  if (!firebaseUser) return <Navigate to="/login" replace />
  if (needsProfile) return <Navigate to="/completar-cadastro" replace />
  return children
}
```

`FeedRoute`: mesma base + `const { profile } = useAuth()` e checar `profile?.role === 'CUIDADOR'`. `PagamentoRoute`/`PagamentoSucessoRoute`: trocar as checagens de `meuToken`/`meuId` por `firebaseUser`/`loading` (mantendo as demais regras de pagamento/sessão). A rota `/completar-cadastro` deve permitir `needsProfile` (não redirecionar em loop) — usar uma guarda dedicada:

```jsx
function ProfileSetupRoute({ children }) {
  const { firebaseUser, needsProfile, loading } = useAuth()
  if (loading) return <PageFallback />
  if (!firebaseUser) return <Navigate to="/login" replace />
  if (!needsProfile) return <Navigate to="/home" replace />
  return children
}
```
e usar `<ProfileSetupRoute>` na rota `/completar-cadastro` (substituindo o `ProtectedRoute` posto na Task 13).

- [ ] **Step 2: `useAuthRedirect.js` via contexto**

```js
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function useAuthRedirect() {
  const navigate = useNavigate()
  const { firebaseUser, profile, loading } = useAuth()
  const ready = Boolean(firebaseUser && profile)

  useEffect(() => {
    if (!loading && !firebaseUser) navigate('/login')
  }, [loading, firebaseUser, navigate])

  return { userId: profile?.id ?? null, ready }
}
```

- [ ] **Step 3: Chat deixa de usar custom token**

Em `frontend/src/hooks/useFirebaseChat.js`: remover `import { connectFirebaseAuth } from '../services/firebaseAuth'` e a chamada `await connectFirebaseAuth()` (o usuário já está logado no Firebase Auth). Se havia dependência do retorno, ajustar: o `firebaseAuth.currentUser` já existe.

- [ ] **Step 4: `socket.js` usa ID token**

Em `frontend/src/services/socket.js`, onde lê `localStorage.getItem('meuToken')` para autenticar o socket, trocar por obter o ID token do Firebase. Como a criação do socket pode ser síncrona, buscar o token antes de conectar:

```js
import { getIdToken } from './auth'
// ... na função que cria/conecta o socket:
const token = await getIdToken()
// usar `token` no auth do socket.io
```
Ajustar a função para ser `async` se necessário e atualizar quem a chama.

- [ ] **Step 5: Remover `firebaseAuth.js`**

```bash
git rm frontend/src/services/firebaseAuth.js
```

Confirmar que não restam referências:

Run: `cd frontend && grep -rn "meuToken\|firebaseAuth'\|connectFirebaseAuth\|/auth/login\|firebase/token" src/ || echo OK`
Expected: `OK` (nenhuma referência a `meuToken`, ao custom token ou a `/auth/login`).

- [ ] **Step 6: Rodar toda a suíte frontend + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: PASS + build ok.

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "refactor(auth): guardas via estado do Firebase; remove meuToken e custom token do chat"
```

---

### Task 16: Zeragem de dados, regras do RTDB e verificação E2E manual

**Files:**
- Create: `docs/superpowers/plans/auth-migration-cutover.md` (passos operacionais)

**Interfaces:** nenhuma (operacional).

- [ ] **Step 1: Documentar e executar a zeragem (pré-lançamento)**

Criar `docs/superpowers/plans/auth-migration-cutover.md` com:
- Apagar todos os docs da coleção `users` no Firestore (Console ou script admin) — ids antigos ficam órfãos após a migração.
- Limpar os dados de chat no Realtime Database (`chats/`) — ids antigos.
- Conferir que os usuários de teste antigos no Firebase Auth (se houver) foram removidos.

- [ ] **Step 2: Conferir as Security Rules do RTDB**

Localizar as regras (arquivo `database.rules.json` no repo, ou no Firebase Console). Confirmar que liberam `chats/{chatId}` com base em `auth.uid` e que o `chatId` é derivado dos uids dos participantes (que agora são os uids do Firebase = ids de perfil). Registrar no doc de cutover se alguma regra precisar de ajuste (não esperado).

- [ ] **Step 3: Verificação E2E via preview**

Subir backend (`cd backend && npm start`) e frontend (`cd frontend && npm run dev`) e exercitar:
1. **Cadastro e-mail/senha:** cria conta → recebe e-mail de verificação → tenta logar sem verificar → **modal bloqueante** aparece; API protegida retorna 403.
2. Verificar e-mail (link) → **Já confirmei** libera → entra.
3. **Google 1º acesso:** popup → **Completar cadastro** → escolhe role + CPF → entra em /home.
4. **Login Google 2º acesso:** entra direto.
5. **Esqueci a senha:** dispara e-mail de reset; redefinir e logar.
6. **Chat:** abre e envia mensagem (RTDB) sem erro de permissão.
7. **Logout:** volta ao login; rota protegida redireciona.

Capturar evidências (screenshots/console) das telas 1–3 e 6.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/auth-migration-cutover.md
git commit -m "docs(auth): passos de cutover (zeragem + rules) e roteiro de verificação E2E"
```

---

## Self-Review (cobertura do spec)

- **Firebase como fonte de identidade** → Tasks 1, 8, 12, 14.
- **users chaveado por uid, sem password, email denormalizado** → Tasks 3, 4.
- **Sessão via getIdToken (sem meuToken)** → Tasks 9, 10, 15.
- **Autorização backend: verifyIdToken + role claim + 403 e-mail não verificado + rotas isentas** → Tasks 1, 4, 5, 6.
- **Fluxo cadastro/login/Google/reset/logout** → Tasks 12, 13, 14; logout em 11/15.
- **Verificação de e-mail bloqueante (front + back)** → Tasks 1 (back 403), 11 (modal), 12 (gate no login).
- **Completar cadastro (Google sem role/CPF)** → Task 13.
- **Custom claims de role + getIdToken(true)** → Tasks 4, 13, 14.
- **CPF único** → Tasks 3, 4.
- **Remoção do custom token do chat** → Tasks 6, 15.
- **mapAuthError / anti-enumeração** → Task 8; reset neutro em Task 12.
- **Testes (checkToken, schema, auth.js, api, Login)** → Tasks 1, 2, 8, 9, 12; Cadastro em 14.
- **Zeragem + rules + E2E** → Task 16.

Sem placeholders de implementação; nomes de funções consistentes entre tasks (`makeCheckToken`, `checkToken`/`checkTokenAllowUnverified`, `createUserWithId`, `cpfExists`, `getCurrentUser`, `registerWithEmail`, `loginWithEmail`, `loginWithGoogle`, `resetPassword`, `getIdToken`, `reloadUser`, `mapAuthError`, `useAuth`, `refreshProfile`).

**Nota:** as páginas `Cadastro`, `socket.js`, `useFirebaseChat.js` e `main.jsx` não tiveram o conteúdo atual transcrito aqui — o implementador deve lê-las antes de editar e aplicar o **contrato** descrito, preservando o que já existe.
