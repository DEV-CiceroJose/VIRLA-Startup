# Fase 0 — Correções e Validações — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir BUG-01 (editar solicitação), BUG-02/SEC-06 (validação de data de nascimento 18+), FEED-01 (contagem do Feed) e AUTH-01 (criar senha para conta Google).

**Architecture:** Quatro correções independentes. Backend valida data de nascimento via um util puro (`utils/date.js`) aplicado em Zod; frontend passa a coletar `birthDate` no cadastro. AUTH-01 é 100% client-side Firebase (`linkWithCredential`), sem mudança de backend.

**Tech Stack:** Express 5 + Zod (backend, `node --test`), React + Vite + vitest (frontend), Firebase Auth (client SDK), sonner (toasts), UI kit local.

## Global Constraints

- **Backend ESM** (`"type":"module"`), imports com extensão `.js`.
- **Backend tests:** `node --test`, unitários puros, sem mock de módulo — lógica injetável/pura.
- **Frontend tests:** `vitest` + `@testing-library/react`, mocks via `vi.mock`.
- **Mensagens ao usuário em pt-BR.**
- **Idade mínima 18** (CUIDADOR e FAMILIAR); idade máxima 110; sem datas futuras/inválidas.
- **`birthDate` obrigatório no cadastro** (Cadastro + CompletarCadastro); opcional/nullable no update.
- **`Field`** encaminha `ref` para o input nativo; suporta `type`, `label`, `required`, `icon`.
- **`Button`** suporta `variant` (primary/secondary/ghost/danger/success), `loading`, `fullWidth`.
- Commits pequenos; mensagens pt-BR (`fix(...)`, `feat(...)`).
- **Nota de estado transitório:** ao tornar `birthDate` obrigatório no backend (Task 3) antes de o frontend enviá-lo (Tasks 4–5), o cadastro fica temporariamente quebrado entre esses commits — esperado num plano incremental, resolvido ao fim da fase.

---

### Task 1: BUG-01 — `cidade`/`estado` aceitam null no schema de solicitação

**Files:**
- Modify: `backend/src/schemas/solicitacaoSchemas.js`
- Test: `backend/tests/solicitacaoSchemas.test.js` (create)

**Interfaces:**
- Produces: `createSolicitacaoBodySchema` passa a aceitar `cidade: null` e `estado: null`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/tests/solicitacaoSchemas.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createSolicitacaoBodySchema } from '../src/schemas/solicitacaoSchemas.js'

test('createSolicitacaoBodySchema aceita cidade/estado null (edição de solicitação salva)', () => {
  const r = createSolicitacaoBodySchema.safeParse({
    titulo: 'Preciso de cuidador',
    descricao: 'Descrição com detalhes suficientes.',
    cidade: null,
    estado: null,
  })
  assert.equal(r.success, true, JSON.stringify(r.error?.issues))
})

test('createSolicitacaoBodySchema ainda aceita cidade/estado string', () => {
  const r = createSolicitacaoBodySchema.safeParse({
    titulo: 'Preciso de cuidador',
    descricao: 'Descrição com detalhes suficientes.',
    cidade: 'Fortaleza',
    estado: 'CE',
  })
  assert.equal(r.success, true, JSON.stringify(r.error?.issues))
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/solicitacaoSchemas.test.js`
Expected: FAIL no primeiro teste — "Esperava-se uma string, mas foi recebido um valor nulo" (Zod).

- [ ] **Step 3: Editar o schema**

Em `backend/src/schemas/solicitacaoSchemas.js`, no `createSolicitacaoBodySchema`, trocar:

```js
  cidade: z.string().max(80).optional(),
  estado: z.string().max(2).optional(),
```
por:
```js
  cidade: z.string().max(80).optional().nullable(),
  estado: z.string().max(2).optional().nullable(),
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/solicitacaoSchemas.test.js`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/schemas/solicitacaoSchemas.js backend/tests/solicitacaoSchemas.test.js
git commit -m "fix(solicitacao): cidade/estado aceitam null no schema (corrige erro ao editar) [BUG-01]"
```

---

### Task 2: BUG-02 — util de data (`utils/date.js`)

**Files:**
- Create: `backend/src/utils/date.js`
- Test: `backend/tests/date.test.js` (create)

**Interfaces:**
- Produces:
  - `calculateAge(birthDate, now = new Date()): number`
  - `validateBirthDate(value, { minAge = 18, maxAge = 110 } = {}): { valid: true, date: Date } | { valid: false, error: string }`

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/tests/date.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateAge, validateBirthDate } from '../src/utils/date.js'

const REF = new Date('2026-07-02T12:00:00Z')

test('calculateAge conta anos completos', () => {
  assert.equal(calculateAge('2000-07-02', REF), 26)
  assert.equal(calculateAge('2000-07-03', REF), 25) // aniversário ainda não ocorreu
})

test('validateBirthDate rejeita ausência', () => {
  assert.equal(validateBirthDate('').valid, false)
  assert.equal(validateBirthDate(null).valid, false)
})

test('validateBirthDate rejeita data inválida', () => {
  assert.equal(validateBirthDate('não-é-data').valid, false)
})

test('validateBirthDate rejeita data futura', () => {
  const futuro = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  assert.equal(validateBirthDate(futuro).valid, false)
})

test('validateBirthDate rejeita menor de 18', () => {
  const dezAnos = new Date()
  dezAnos.setFullYear(dezAnos.getFullYear() - 10)
  assert.equal(validateBirthDate(dezAnos.toISOString().split('T')[0]).valid, false)
})

test('validateBirthDate rejeita idade absurda (>110)', () => {
  assert.equal(validateBirthDate('1900-01-01').valid, false)
})

test('validateBirthDate aceita adulto válido', () => {
  const trintaAnos = new Date()
  trintaAnos.setFullYear(trintaAnos.getFullYear() - 30)
  const r = validateBirthDate(trintaAnos.toISOString().split('T')[0])
  assert.equal(r.valid, true)
  assert.ok(r.date instanceof Date)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/date.test.js`
Expected: FAIL — módulo `../src/utils/date.js` não existe.

- [ ] **Step 3: Criar o util**

Criar `backend/src/utils/date.js`:

```js
/**
 * Utilitários de data de nascimento — validação anti data-futura/menor-de-idade.
 */

/** Idade em anos completos até `now`. Aceita Date ou string parseável. */
export function calculateAge(birthDate, now = new Date()) {
  const birth = birthDate instanceof Date ? birthDate : new Date(birthDate)
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

/**
 * Valida uma data de nascimento: obrigatória, parseável, não futura, e com
 * idade entre minAge e maxAge.
 * @returns {{ valid: true, date: Date } | { valid: false, error: string }}
 */
export function validateBirthDate(value, { minAge = 18, maxAge = 110 } = {}) {
  if (value == null || value === '') {
    return { valid: false, error: 'Data de nascimento é obrigatória.' }
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { valid: false, error: 'Data de nascimento inválida.' }
  }
  const now = new Date()
  if (date.getTime() > now.getTime()) {
    return { valid: false, error: 'Data de nascimento não pode ser futura.' }
  }
  const age = calculateAge(date, now)
  if (age < minAge) {
    return { valid: false, error: `É necessário ter pelo menos ${minAge} anos.` }
  }
  if (age > maxAge) {
    return { valid: false, error: 'Data de nascimento inválida.' }
  }
  return { valid: true, date }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/date.test.js`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/date.js backend/tests/date.test.js
git commit -m "feat(validation): util validateBirthDate/calculateAge (18+, sem futura) [BUG-02]"
```

---

### Task 3: BUG-02 — `birthDate` validado nos schemas de usuário

**Files:**
- Modify: `backend/src/schemas/userSchemas.js`
- Test: `backend/tests/userSchemas.test.js` (já existe — adicionar casos)

**Interfaces:**
- Consumes: `validateBirthDate` (Task 2).
- Produces: `createUserBodySchema.birthDate` **obrigatório e validado**; `updateUserBodySchema.birthDate` opcional/nullable validado quando presente.

- [ ] **Step 1: Adicionar os testes que falham**

Em `backend/tests/userSchemas.test.js`, adicionar (no topo, ajustar import existente) — adicionar helper e casos:

```js
// helper: data de 30 anos atrás (adulto válido) no formato YYYY-MM-DD
function adultoISO() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 30)
  return d.toISOString().split('T')[0]
}

test('createUserBodySchema exige birthDate', () => {
  const r = createUserBodySchema.safeParse({ name: 'Ana Silva', role: 'FAMILIAR', cpf: '390.533.447-05' })
  assert.equal(r.success, false)
})

test('createUserBodySchema aceita birthDate de adulto', () => {
  const r = createUserBodySchema.safeParse({
    name: 'Ana Silva', role: 'FAMILIAR', cpf: '390.533.447-05', birthDate: adultoISO(),
  })
  assert.equal(r.success, true, JSON.stringify(r.error?.issues))
})

test('createUserBodySchema rejeita menor de 18', () => {
  const d = new Date(); d.setFullYear(d.getFullYear() - 10)
  const r = createUserBodySchema.safeParse({
    name: 'Ana', role: 'FAMILIAR', cpf: '390.533.447-05', birthDate: d.toISOString().split('T')[0],
  })
  assert.equal(r.success, false)
})

test('updateUserBodySchema aceita ausência de birthDate', () => {
  const r = updateUserBodySchema.safeParse({ name: 'Novo Nome' })
  assert.equal(r.success, true, JSON.stringify(r.error?.issues))
})

test('updateUserBodySchema rejeita birthDate futura quando enviada', () => {
  const futuro = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const r = updateUserBodySchema.safeParse({ birthDate: futuro })
  assert.equal(r.success, false)
})
```

Garantir que o import inclui `updateUserBodySchema`:
```js
import { createUserBodySchema, updateUserBodySchema } from '../src/schemas/userSchemas.js'
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/userSchemas.test.js`
Expected: FAIL — birthDate ainda é `z.string().optional().nullable()` (aceita ausência e não valida idade).

- [ ] **Step 3: Editar o schema**

Em `backend/src/schemas/userSchemas.js`:

Adicionar o import no topo:
```js
import { validateBirthDate } from '../utils/date.js'
```

Adicionar o schema reutilizável (após os outros schemas de campo, ex.: após `emailSchema`):
```js
export const birthDateSchema = z.string().superRefine((v, ctx) => {
  const res = validateBirthDate(v)
  if (!res.valid) ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.error })
})
```

No `createUserBodySchema`, trocar:
```js
  birthDate: z.string().optional().nullable(),
```
por:
```js
  birthDate: birthDateSchema,
```

No `updateUserBodySchema`, trocar:
```js
    birthDate: z.string().optional().nullable(),
```
por:
```js
    birthDate: birthDateSchema.optional().nullable(),
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/userSchemas.test.js`
Expected: PASS (todos, incluindo os pré-existentes).

- [ ] **Step 5: Rodar a suíte backend inteira**

Run: `cd backend && npm test`
Expected: PASS (nada mais quebra).

- [ ] **Step 6: Commit**

```bash
git add backend/src/schemas/userSchemas.js backend/tests/userSchemas.test.js
git commit -m "feat(validation): birthDate obrigatório/validado no create; validado no update [BUG-02/SEC-06]"
```

---

### Task 4: BUG-02 — campo de data no Cadastro

**Files:**
- Modify: `frontend/src/pages/Cadastro/index.jsx`
- Modify: `frontend/src/pages/Cadastro/Cadastro.test.jsx`

**Interfaces:**
- Consumes: `POST /users` agora exige `birthDate` (Task 3).

- [ ] **Step 1: Adicionar o ref, a validação e o payload**

Em `frontend/src/pages/Cadastro/index.jsx`:

Adicionar o ref (junto aos outros, após `inputConfirmPassword`):
```js
  const inputBirthDate = useRef()
```

No `createUser`, após ler `confirmPassword`, adicionar a leitura:
```js
    const birthDate = inputBirthDate.current?.value
```

Adicionar a validação client-side (após o bloco de confirmação de senha, antes de `setSubmitting(true)`):
```js
    if (!birthDate) {
      toast.warning('Informe sua data de nascimento.')
      return
    }
```

No `payload`, incluir `birthDate`:
```js
      const payload = {
        name,
        role,
        bio: '',
        cpf: cpfDigits,
        birthDate,
      }
```

- [ ] **Step 2: Adicionar o campo no formulário**

No JSX, logo após o `<Field>` de CPF (antes do bloco condicional `role === 'CUIDADOR'`), inserir:
```jsx
          <Field
            ref={inputBirthDate}
            label="Data de nascimento"
            required
            icon={CalendarMonth}
            type="date"
            max={new Date().toISOString().split('T')[0]}
          />
```

Adicionar o import do ícone no topo (junto aos outros `@mui/icons-material`):
```js
import CalendarMonth from '@mui/icons-material/CalendarMonth'
```

- [ ] **Step 3: Atualizar o teste**

Em `frontend/src/pages/Cadastro/Cadastro.test.jsx`, no teste de happy-path, preencher também a data de nascimento antes de submeter (usar uma data de adulto) e ajustar a asserção do payload para conter `birthDate`. Localizar o preenchimento dos campos e adicionar, por exemplo:
```js
    // data de nascimento (adulto) — o campo type="date" aceita 'YYYY-MM-DD'
    const dateInput = document.querySelector('input[type="date"]')
    fireEvent.change(dateInput, { target: { value: '1994-05-10' } })
```
Garantir o import de `fireEvent` (`import { render, screen, waitFor, fireEvent } from '@testing-library/react'`). Na asserção do `api.post`, o payload deve conter `birthDate: '1994-05-10'` — usar `expect.objectContaining({ birthDate: '1994-05-10' })` ou `toMatchObject`. Se existir um teste que verifica "senhas divergentes → registerWithEmail não chamado", ele continua válido (a checagem de senha ocorre antes da data).

- [ ] **Step 4: Rodar os testes do Cadastro + build + lint**

Run: `cd frontend && npx vitest run src/pages/Cadastro/Cadastro.test.jsx`
Expected: PASS.
Run: `cd frontend && npx eslint src/pages/Cadastro/index.jsx`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Cadastro/
git commit -m "feat(cadastro): campo data de nascimento obrigatório (18+) [BUG-02]"
```

---

### Task 5: BUG-02 — campo de data no Completar cadastro (Google)

**Files:**
- Modify: `frontend/src/pages/CompletarCadastro/index.jsx`

**Interfaces:**
- Consumes: `POST /users` exige `birthDate` (Task 3).

- [ ] **Step 1: Adicionar ref, campo e payload**

Em `frontend/src/pages/CompletarCadastro/index.jsx`:

Adicionar o import do ícone e do `useRef` já existente (o arquivo já usa `useRef`). Adicionar o ref (junto a `nome`/`cpf`):
```js
  const birthDate = useRef()
```

Na validação do submit, trocar:
```js
    if (!nome.current.value.trim() || !cpf.current.value.trim()) {
      toast.warning('Preencha nome e CPF.')
      return
    }
```
por:
```js
    if (!nome.current.value.trim() || !cpf.current.value.trim() || !birthDate.current.value) {
      toast.warning('Preencha nome, CPF e data de nascimento.')
      return
    }
```

No corpo do `api.post('/users', { ... })`, incluir `birthDate`:
```js
      await api.post('/users', {
        name: nome.current.value.trim(),
        cpf: cpf.current.value.trim(),
        role,
        birthDate: birthDate.current.value,
      })
```

No JSX, após o `<Field ref={cpf} ...>`, adicionar:
```jsx
          <Field ref={birthDate} label="Data de nascimento" type="date" name="birthDate" max={new Date().toISOString().split('T')[0]} />
```

- [ ] **Step 2: Verificar build + lint**

Run: `cd frontend && npx eslint src/pages/CompletarCadastro/index.jsx && npm run build`
Expected: sem erros; build ok.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CompletarCadastro/index.jsx
git commit -m "feat(cadastro): data de nascimento no completar cadastro (Google) [BUG-02]"
```

---

### Task 6: FEED-01 — remover contagem total do Feed

**Files:**
- Modify: `frontend/src/pages/Feed/index.jsx`

**Interfaces:** nenhuma externa.

- [ ] **Step 1: Remover o display do total, manter a paginação**

Em `frontend/src/pages/Feed/index.jsx`, trocar o bloco (por volta da linha 268):
```jsx
          <p className="text-virla-muted text-sm">
            {total} perfil{total !== 1 ? 'is' : ''} no total
            {totalPages > 1 && ` · página ${page} de ${totalPages}`}
          </p>
```
por:
```jsx
          {totalPages > 1 && (
            <p className="text-virla-muted text-sm">
              Página {page} de {totalPages}
            </p>
          )}
```

- [ ] **Step 2: Remover o state `total` (agora sem uso)**

Remover a linha do state:
```js
  const [total, setTotal] = useState(0)
```
E remover a linha que o setava no fetch:
```js
        setTotal(typeof payload.total === 'number' ? payload.total : users.length)
```
Manter `totalPages`/`setTotalPages` e `setTotalPages(...)`.

- [ ] **Step 3: Verificar lint (sem `no-unused-vars`) + build**

Run: `cd frontend && npx eslint src/pages/Feed/index.jsx`
Expected: sem erros (nenhum `total`/`setTotal` órfão).
Run: `cd frontend && npm run build`
Expected: build ok.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Feed/index.jsx
git commit -m "fix(feed): remove contagem total (corrige 'perfilis'); mantém paginação [FEED-01]"
```

---

### Task 7: AUTH-01 — `hasPasswordProvider` + `linkPassword` no `services/auth.js`

**Files:**
- Modify: `frontend/src/services/auth.js`
- Modify: `frontend/src/services/auth.test.js`

**Interfaces:**
- Produces:
  - `hasPasswordProvider(): boolean` — true se o usuário atual tem provedor `'password'`.
  - `linkPassword(novaSenha): Promise<void>` — vincula credencial de e-mail/senha.
  - `mapAuthError` ganha códigos: `requires-recent-login`, `credential-already-in-use`, `provider-already-linked`.

- [ ] **Step 1: Escrever o teste que falha**

Em `frontend/src/services/auth.test.js`, estender o mock de `firebase/auth` para incluir `EmailAuthProvider` e `linkWithCredential`, e ajustar o mock de `./firebase` para um `currentUser` mutável:

```js
const linkWithCredential = vi.fn(() => Promise.resolve())
const credentialFn = vi.fn((email, senha) => ({ email, senha, _type: 'cred' }))
```
No `vi.mock('firebase/auth', () => ({ ... }))`, adicionar:
```js
  linkWithCredential: (...a) => linkWithCredential(...a),
  EmailAuthProvider: { credential: (...a) => credentialFn(...a) },
```
Trocar o mock de `./firebase` para um objeto mutável:
```js
const fakeFirebaseAuth = { currentUser: null }
vi.mock('./firebase', () => ({ firebaseAuth: fakeFirebaseAuth, googleProvider: {} }))
```
Adicionar os testes:
```js
import { hasPasswordProvider, linkPassword } from './auth'

describe('services/auth · criar senha (AUTH-01)', () => {
  beforeEach(() => { vi.clearAllMocks(); fakeFirebaseAuth.currentUser = null })

  it('hasPasswordProvider é false para conta só-Google', () => {
    fakeFirebaseAuth.currentUser = { providerData: [{ providerId: 'google.com' }] }
    expect(hasPasswordProvider()).toBe(false)
  })

  it('hasPasswordProvider é true quando há provedor password', () => {
    fakeFirebaseAuth.currentUser = { providerData: [{ providerId: 'google.com' }, { providerId: 'password' }] }
    expect(hasPasswordProvider()).toBe(true)
  })

  it('linkPassword vincula credencial de e-mail/senha', async () => {
    fakeFirebaseAuth.currentUser = { email: 'g@x.com', providerData: [{ providerId: 'google.com' }] }
    await linkPassword('segredo123')
    expect(credentialFn).toHaveBeenCalledWith('g@x.com', 'segredo123')
    expect(linkWithCredential).toHaveBeenCalled()
  })
})
```

> Se o mock atual de `firebase/auth` usa `currentUser: null` fixo dentro de `./firebase`, esta mudança para `fakeFirebaseAuth` mutável substitui o mock anterior — ajustar os testes existentes que dependiam de `firebaseAuth.currentUser` se necessário (o teste de `registerWithEmail` não depende de currentUser).

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/services/auth.test.js`
Expected: FAIL — `hasPasswordProvider`/`linkPassword` não existem.

- [ ] **Step 3: Implementar em `services/auth.js`**

No import de `firebase/auth` (topo), adicionar `EmailAuthProvider` e `linkWithCredential`:
```js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  EmailAuthProvider,
  linkWithCredential,
} from 'firebase/auth'
```

Adicionar as funções (após `onAuthChange`, antes do `MESSAGES`):
```js
/** true se a conta atual já possui provedor de e-mail/senha. */
export function hasPasswordProvider() {
  const u = firebaseAuth.currentUser
  return u ? u.providerData.some((p) => p.providerId === 'password') : false
}

/** Vincula uma senha à conta atual (ex.: quem entrou só com Google). */
export async function linkPassword(novaSenha) {
  const u = firebaseAuth.currentUser
  if (!u) throw new Error('Nenhum usuário autenticado.')
  const credential = EmailAuthProvider.credential(u.email, novaSenha)
  await linkWithCredential(u, credential)
}
```

No objeto `MESSAGES`, adicionar:
```js
  'auth/requires-recent-login': 'Faça login novamente para criar sua senha.',
  'auth/credential-already-in-use': 'Esta conta já possui uma senha.',
  'auth/provider-already-linked': 'Esta conta já possui uma senha.',
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/services/auth.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/auth.js frontend/src/services/auth.test.js
git commit -m "feat(auth): hasPasswordProvider + linkPassword (criar senha p/ conta Google) [AUTH-01]"
```

---

### Task 8: Perfil — mostrar erro 422 (BUG-02) + seção "Criar senha" (AUTH-01)

**Files:**
- Modify: `frontend/src/pages/Perfil/index.jsx`

**Interfaces:**
- Consumes: `hasPasswordProvider`, `linkPassword`, `mapAuthError` (Task 7).

- [ ] **Step 1: Surfacar a mensagem 422 do backend no update**

Em `frontend/src/pages/Perfil/index.jsx`, no `catch` do `handleUpdate`, trocar:
```js
      setMessage({ type: 'error', text: 'Erro ao atualizar perfil. Tente novamente.' })
```
por:
```js
      setMessage({ type: 'error', text: err.response?.data?.msg ?? 'Erro ao atualizar perfil. Tente novamente.' })
```
(Assim a mensagem "É necessário ter pelo menos 18 anos." / "não pode ser futura." aparece no lugar do genérico.)

- [ ] **Step 2: Imports e estado da seção "Criar senha"**

Ajustar os imports no topo:
```js
import { useEffect, useState, useRef } from 'react'
```
Adicionar:
```js
import { toast } from 'sonner'
import { hasPasswordProvider, linkPassword, mapAuthError } from '../../services/auth'
```

Dentro do componente (junto aos outros `useState`), adicionar:
```js
  const [needsPassword] = useState(() => !hasPasswordProvider())
  const [passwordLinked, setPasswordLinked] = useState(false)
  const [linkingPwd, setLinkingPwd] = useState(false)
  const novaSenha = useRef()
  const confirmaNovaSenha = useRef()
```

Adicionar o handler (junto às outras funções do componente):
```js
  async function handleCriarSenha(e) {
    e.preventDefault()
    if (linkingPwd) return
    const s = novaSenha.current?.value ?? ''
    const c = confirmaNovaSenha.current?.value ?? ''
    if (s.length < 6) {
      toast.warning('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (s !== c) {
      toast.warning('As senhas não conferem.')
      return
    }
    setLinkingPwd(true)
    try {
      await linkPassword(s)
      setPasswordLinked(true)
      toast.success('Senha criada! Agora você também pode entrar com e-mail e senha.')
    } catch (err) {
      toast.error(mapAuthError(err.code) || 'Não foi possível criar a senha.')
    } finally {
      setLinkingPwd(false)
    }
  }
```

- [ ] **Step 3: Renderizar a seção (após o formulário de perfil, dentro do mesmo container)**

Localizar o fim do `<form onSubmit={handleUpdate}>` (o `</form>`), e logo após ele adicionar um card. Usar `Card` e `Button` (já importados) e inputs nativos com as classes de campo já usadas no arquivo (`FIELD_CLASS`):
```jsx
          {needsPassword && !passwordLinked && (
            <Card as="form" onSubmit={handleCriarSenha} className="mt-6 p-6 space-y-4">
              <h3 className="text-lg font-bold text-virla-texto">Criar senha</h3>
              <p className="text-sm text-virla-muted">
                Você entrou com o Google. Crie uma senha para também poder entrar com e-mail e senha.
              </p>
              <input
                ref={novaSenha}
                type="password"
                placeholder="Nova senha (mín. 6 caracteres)"
                autoComplete="new-password"
                className={FIELD_CLASS}
              />
              <input
                ref={confirmaNovaSenha}
                type="password"
                placeholder="Confirmar nova senha"
                autoComplete="new-password"
                className={FIELD_CLASS}
              />
              <Button type="submit" loading={linkingPwd}>Criar senha</Button>
            </Card>
          )}
```

> `FIELD_CLASS` já é definido no topo do arquivo (usado nos inputs do perfil). Se o `</form>` estiver aninhado de forma que o card não caiba no mesmo pai visual, colocar o bloco imediatamente após o fechamento do card do formulário, no mesmo container de largura.

- [ ] **Step 4: Verificar lint + build**

Run: `cd frontend && npx eslint src/pages/Perfil/index.jsx`
Expected: sem erros.
Run: `cd frontend && npm run build`
Expected: build ok.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Perfil/index.jsx
git commit -m "feat(perfil): mostra erro 422 de data [BUG-02] + seção Criar senha p/ Google [AUTH-01]"
```

---

## Self-Review (cobertura do spec)

- **BUG-01** (cidade/estado nullable) → Task 1.
- **BUG-02** util de data → Task 2; schemas (create obrigatório, update opcional/nullable) → Task 3; Cadastro → Task 4; CompletarCadastro → Task 5; Perfil mostra 422 → Task 8 (Step 1).
- **SEC-06** (18+ inclui cuidador) → coberto pela regra `minAge=18` em Task 2/3 (aplica a ambos os papéis).
- **FEED-01** → Task 6.
- **AUTH-01** (`hasPasswordProvider`/`linkPassword`/mapAuthError) → Task 7; seção no Perfil → Task 8 (Steps 2–3).

Nomes consistentes entre tasks: `validateBirthDate`, `calculateAge`, `birthDateSchema`, `hasPasswordProvider`, `linkPassword`, `mapAuthError`. Sem placeholders de implementação.

**Notas:** `birthDate` obrigatório no backend (Task 3) cria estado transitório até Tasks 4–5 (frontend enviar o campo) — esperado. O input `type="date"` entrega `'YYYY-MM-DD'`, aceito por `validateBirthDate` e por `parseBirthDate` no controller.
