# Fase 1 — Validações de dados — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Endurecer as validações de perfil — registro profissional estruturado (conselho + número), nome, valor por hora e upload de foto.

**Architecture:** Validação no backend via Zod + utils puros (`councils.js`, `name.js`), com unicidade do registro no `userRepository`. O campo redundante `crm_crf` é substituído por `council` (enum). Frontend ganha um `<select>` de conselho e aperta o upload.

**Tech Stack:** Express 5 + Zod (backend, `node --test`), React + Vite + vitest (frontend), Firestore.

## Global Constraints

- **Backend ESM** (`"type":"module"`), imports com `.js`.
- **Backend tests:** `node --test`, unitários puros, sem mock de módulo. Repositórios não têm teste unitário (verificação via controller/manual).
- **Frontend tests:** `vitest` + `@testing-library/react`, mocks via `vi.mock`. **Suíte roda sequencial** (`fileParallelism: false` já configurado).
- **Mensagens ao usuário em pt-BR.**
- **Conselhos (enum):** `COREN, CRM, CRP, CREFITO, CREF, CRF`. Valores idênticos entre backend (`utils/councils.js`) e frontend (`constants/councils.js`).
- **Registro:** `council` + `registerNumber` são **par obrigatório** (os dois ou nenhum); opcional no geral; só relevante para CUIDADOR. Unicidade do par → 409.
- **Nome:** letras (com acento), espaço, ponto, hífen, apóstrofo; rejeita dígitos/símbolos/repetição/sequência; mín. 2 chars.
- **Valor por hora:** decimal, **R$ 10 ≤ v ≤ R$ 500**; ausência/`''`/null = não informado.
- **Upload:** JPG/PNG/WEBP (sem GIF); front máx **5 MB**; `profileImageSchema` base64 máx **7.500.000** + prefixo `data:image/(jpeg|png|webp)`.
- **`crm_crf` é removido** de schemas, controller, `userSelects` e do frontend (pré-lançamento, sem migração de dados).
- Commits pequenos, mensagens pt-BR.

---

### Task 1: util `councils.js` (formato por conselho)

**Files:**
- Create: `backend/src/utils/councils.js`
- Test: `backend/tests/councils.test.js`

**Interfaces:**
- Produces: `COUNCILS` (mapa), `COUNCIL_VALUES` (array de strings), `isValidCouncil(v): boolean`, `isValidRegister(council, number): boolean`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/tests/councils.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { COUNCIL_VALUES, isValidCouncil, isValidRegister } from '../src/utils/councils.js'

test('COUNCIL_VALUES traz os 6 conselhos', () => {
  assert.deepEqual(COUNCIL_VALUES, ['COREN', 'CRM', 'CRP', 'CREFITO', 'CREF', 'CRF'])
})

test('isValidCouncil', () => {
  assert.equal(isValidCouncil('COREN'), true)
  assert.equal(isValidCouncil('XPTO'), false)
  assert.equal(isValidCouncil(''), false)
})

test('isValidRegister: base (COREN/CRM/CREFITO/CREF/CRF)', () => {
  assert.equal(isValidRegister('COREN', '123456'), true)
  assert.equal(isValidRegister('CRM', '123456-SP'), true)
  assert.equal(isValidRegister('CRF', '12345/RJ'), true)
  assert.equal(isValidRegister('COREN', 'abc'), false)
  assert.equal(isValidRegister('COREN', ''), false)
  assert.equal(isValidRegister('COREN', '12'), false) // curto demais
})

test('isValidRegister: CRP usa região/número', () => {
  assert.equal(isValidRegister('CRP', '06/12345'), true)
  assert.equal(isValidRegister('CRP', '06-12345'), true)
  assert.equal(isValidRegister('CRP', '123456'), false) // sem região
})

test('isValidRegister: conselho inválido é false', () => {
  assert.equal(isValidRegister('XPTO', '123456'), false)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/councils.test.js`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Criar o util**

Criar `backend/src/utils/councils.js`:

```js
/**
 * Conselhos profissionais aceitos e validação (pragmática) do número de registro.
 * Formatos reais variam por estado — os padrões validam estrutura básica, sem
 * pretender exaustividade, para não rejeitar registros válidos.
 */

const REGISTER_BASE = /^\d{4,10}([-/][A-Za-z0-9]{1,5})?$/ // dígitos + sufixo opcional (UF/categoria)

export const COUNCILS = {
  COREN:   { label: 'COREN — Enfermagem',     pattern: REGISTER_BASE },
  CRM:     { label: 'CRM — Medicina',         pattern: REGISTER_BASE },
  CRP:     { label: 'CRP — Psicologia',       pattern: /^\d{2}[-/]\d{3,7}$/ }, // região/número (ex.: 06/12345)
  CREFITO: { label: 'CREFITO — Fisio/TO',     pattern: REGISTER_BASE },
  CREF:    { label: 'CREF — Educação Física', pattern: REGISTER_BASE },
  CRF:     { label: 'CRF — Farmácia',         pattern: REGISTER_BASE },
}

export const COUNCIL_VALUES = Object.keys(COUNCILS)

export function isValidCouncil(v) {
  return typeof v === 'string' && v in COUNCILS
}

export function isValidRegister(council, number) {
  const c = COUNCILS[council]
  if (!c) return false
  return c.pattern.test(String(number ?? '').trim())
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/councils.test.js`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/councils.js backend/tests/councils.test.js
git commit -m "feat(validation): util de conselhos profissionais + formato do registro [FE-05]"
```

---

### Task 2: util `name.js` (validação de nome)

**Files:**
- Create: `backend/src/utils/name.js`
- Test: `backend/tests/name.test.js`

**Interfaces:**
- Produces: `isValidName(value): boolean`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/tests/name.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidName } from '../src/utils/name.js'

test('aceita nomes válidos (compostos, acentos, hífen, apóstrofo)', () => {
  assert.equal(isValidName('Ana Souza'), true)
  assert.equal(isValidName('Maria de Fátima'), true)
  assert.equal(isValidName("D'Ávila"), true)
  assert.equal(isValidName('Ana-Clara'), true)
  assert.equal(isValidName('Jr.'), true)
})

test('rejeita dígitos, símbolos, sequências e repetição', () => {
  assert.equal(isValidName('123456'), false)
  assert.equal(isValidName('@@@@@@'), false)
  assert.equal(isValidName('AAAAAAAAAA'), false)
  assert.equal(isValidName('Ana123'), false)
  assert.equal(isValidName('A'), false)   // curto demais
  assert.equal(isValidName(''), false)
  assert.equal(isValidName('   '), false)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/name.test.js`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Criar o util**

Criar `backend/src/utils/name.js`:

```js
/** Validação de nome de pessoa: letras (com acento), espaço, ponto, hífen e apóstrofo. */
export function isValidName(value) {
  const name = String(value ?? '').trim()
  if (name.length < 2) return false
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) return false
  // rejeita repetição da mesma letra (AAAA), ignorando separadores
  const letters = name.replace(/[^\p{L}]/gu, '')
  if (letters.length >= 2 && /^(.)\1+$/u.test(letters)) return false
  return true
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/name.test.js`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/name.js backend/tests/name.test.js
git commit -m "feat(validation): util isValidName (rejeita dígitos/símbolos/repetição) [FE-08]"
```

---

### Task 3: schemas — nome, valor por hora e upload

**Files:**
- Modify: `backend/src/schemas/userSchemas.js`
- Test: `backend/tests/userSchemas.test.js`

**Interfaces:**
- Consumes: `isValidName` (Task 2).
- Produces: `name` validado por `isValidName` (create+update); `hourlyRateSchema` (10–500); `profileImageSchema` com limite 7.500.000 e prefixo restrito.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `backend/tests/userSchemas.test.js`:

```js
function adultoISO() {
  const d = new Date(); d.setFullYear(d.getFullYear() - 30)
  return d.toISOString().split('T')[0]
}
const baseCreate = { role: 'FAMILIAR', cpf: '390.533.447-05', birthDate: adultoISO() }

test('createUserBodySchema rejeita nome inválido', () => {
  assert.equal(createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana123' }).success, false)
  assert.equal(createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana Souza' }).success, true)
})

test('hourlyRate: fora de 10–500 falha; dentro passa; ausente ok', () => {
  const ok = createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana Souza', hourlyRate: 25 })
  assert.equal(ok.success, true, JSON.stringify(ok.error?.issues))
  assert.equal(createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana Souza', hourlyRate: 5 }).success, false)
  assert.equal(createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana Souza', hourlyRate: 900 }).success, false)
  assert.equal(createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana Souza', hourlyRate: 'abc' }).success, false)
  assert.equal(createUserBodySchema.safeParse({ ...baseCreate, name: 'Ana Souza' }).success, true) // ausente
})

test('profileImageSchema aceita ~5MB e rejeita prefixo não-imagem', () => {
  const big = 'data:image/png;base64,' + 'A'.repeat(6_000_000)
  assert.equal(profileImageSchema.safeParse(big).success, true)
  assert.equal(profileImageSchema.safeParse('data:text/html;base64,AAAA').success, false)
})
```

Garantir os imports no topo do arquivo de teste:
```js
import { createUserBodySchema, updateUserBodySchema, profileImageSchema } from '../src/schemas/userSchemas.js'
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/userSchemas.test.js`
Expected: FAIL nos novos casos.

- [ ] **Step 3: Editar `userSchemas.js`**

Adicionar import:
```js
import { isValidName } from '../utils/name.js'
```

Substituir `profileImageSchema` por:
```js
export const profileImageSchema = z
  .string()
  .max(7_500_000)
  .optional()
  .nullable()
  .refine(
    (v) => !v || /^data:image\/(jpeg|png|webp);/i.test(v) || /^https?:\/\//i.test(v),
    { message: 'Imagem inválida. Envie um JPG, PNG ou WEBP.' },
  )
```

Adicionar `hourlyRateSchema` (após `profileImageSchema`):
```js
export const hourlyRateSchema = z
  .union([z.number(), z.string()])
  .nullable()
  .optional()
  .refine((v) => {
    if (v == null || v === '') return true
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= 10 && n <= 500
  }, { message: 'Valor por hora deve estar entre R$ 10 e R$ 500.' })
```

Adicionar `nameSchema` reutilizável (após `emailSchema`):
```js
export const nameSchema = z
  .string()
  .min(1, 'Nome é obrigatório.')
  .max(120)
  .refine(isValidName, { message: 'Informe um nome válido (apenas letras).' })
```

No `createUserBodySchema`: trocar `name: z.string()...` por `name: nameSchema` e `hourlyRate: z.union(...).optional().nullable()` por `hourlyRate: hourlyRateSchema`.

No `updateUserBodySchema`: trocar `name: z.string().min(1).max(120).optional()` por `name: nameSchema.optional()` e `hourlyRate: z.union(...).optional().nullable()` por `hourlyRate: hourlyRateSchema`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/userSchemas.test.js` então `cd backend && npm test`
Expected: PASS (novos + pré-existentes; suíte completa verde).

- [ ] **Step 5: Commit**

```bash
git add backend/src/schemas/userSchemas.js backend/tests/userSchemas.test.js
git commit -m "feat(validation): nome, valor/hora (10-500) e upload apertados nos schemas [FE-08/FE-04/FE-09]"
```

---

### Task 4: schemas — conselho + registro (par), remove `crm_crf`

**Files:**
- Modify: `backend/src/schemas/userSchemas.js`
- Test: `backend/tests/userSchemas.test.js`

**Interfaces:**
- Consumes: `COUNCIL_VALUES`, `isValidRegister` (Task 1).
- Produces: `council` (enum) nos schemas; validação do par + formato via `.superRefine`; `crm_crf` removido.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `backend/tests/userSchemas.test.js`:

```js
test('registro: par válido ok; só um dos dois falha; ambos ausentes ok', () => {
  const base = { ...baseCreate, name: 'Ana Souza' }
  assert.equal(createUserBodySchema.safeParse({ ...base, council: 'COREN', registerNumber: '123456' }).success, true)
  assert.equal(createUserBodySchema.safeParse({ ...base, council: 'COREN' }).success, false) // sem número
  assert.equal(createUserBodySchema.safeParse({ ...base, registerNumber: '123456' }).success, false) // sem conselho
  assert.equal(createUserBodySchema.safeParse({ ...base }).success, true) // nenhum
})

test('registro: formato inválido para o conselho falha', () => {
  const base = { ...baseCreate, name: 'Ana Souza' }
  assert.equal(createUserBodySchema.safeParse({ ...base, council: 'COREN', registerNumber: 'abc' }).success, false)
  assert.equal(createUserBodySchema.safeParse({ ...base, council: 'XPTO', registerNumber: '123456' }).success, false)
})

test('crm_crf não é mais aceito no update (strict)', () => {
  assert.equal(updateUserBodySchema.safeParse({ crm_crf: '123' }).success, false)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/userSchemas.test.js`
Expected: FAIL nos novos casos.

- [ ] **Step 3: Editar `userSchemas.js`**

Adicionar import:
```js
import { COUNCIL_VALUES, isValidRegister } from '../utils/councils.js'
```

Adicionar schema de conselho e a função de refine do par (após `nameSchema`):
```js
export const councilSchema = z.enum(COUNCIL_VALUES, {
  errorMap: () => ({ message: 'Conselho profissional inválido.' }),
})

/** Regra do par conselho+registro (superRefine reutilizável em create/update). */
export function refineRegisterPair(data, ctx) {
  const hasCouncil = !!data.council
  const hasNumber = !!(data.registerNumber && String(data.registerNumber).trim())
  if (hasCouncil !== hasNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe o conselho e o número do registro.',
      path: ['registerNumber'],
    })
    return
  }
  if (hasCouncil && hasNumber && !isValidRegister(data.council, data.registerNumber)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Número de registro inválido para o conselho informado.',
      path: ['registerNumber'],
    })
  }
}
```

No `updateUserBodySchema`: **remover** a linha `crm_crf: z.string().max(80).optional().nullable(),`; **adicionar** `council: councilSchema.optional().nullable(),`; e encadear o refine **após** o `.strict()`:
```js
  })
  .strict()
  .superRefine(refineRegisterPair)
```

No `createUserBodySchema`: **remover** a linha `crm_crf: ...`; **adicionar** `council: councilSchema.optional().nullable(),`; e como `createUserBodySchema` é `z.object({...})` sem `.strict()`, encadear no fim:
```js
}).superRefine(refineRegisterPair)
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/userSchemas.test.js` então `cd backend && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/schemas/userSchemas.js backend/tests/userSchemas.test.js
git commit -m "feat(validation): conselho+registro como par validado; remove crm_crf [FE-05/SEC-04]"
```

---

### Task 5: repositório + controller — unicidade do registro e `council`

**Files:**
- Modify: `backend/src/repositories/userRepository.js`
- Modify: `backend/src/controllers/userController.js`
- Modify: `backend/src/lib/userSelects.js`

**Interfaces:**
- Consumes: schemas com `council` (Task 4).
- Produces: `registerExists(council, registerNumber, exceptId)`; `createUsers`/`updateUsers` gravam `council`, checam unicidade (409) e não usam mais `crm_crf`.

> Repositório/controller sem teste unitário (convenção do projeto) — verificação via `npm test` (não deve regredir) + manual.

- [ ] **Step 1: `registerExists` no repositório**

Em `backend/src/repositories/userRepository.js`, após `cpfExists`, adicionar:
```js
/** true se já existe outro usuário com o mesmo par (conselho, registro). */
export async function registerExists(council, registerNumber, exceptId = null) {
  if (!council || !registerNumber) return false
  const snap = await col()
    .where('council', '==', council)
    .where('registerNumber', '==', registerNumber)
    .limit(2)
    .get()
  return snap.docs.some((d) => d.id !== exceptId)
}
```

- [ ] **Step 2: `userSelects.js`**

Trocar `crm_crf: true,` por `council: true,` em `USER_PUBLIC_SELECT` (mantém `registerNumber: true`).

- [ ] **Step 3: `createUsers`**

Em `backend/src/controllers/userController.js`:
- No import do repo, adicionar `registerExists`.
- No destructuring do body (linha ~63), trocar `crm_crf` por `council`.
- Após o check de `cpfExists` (linha ~83), adicionar:
```js
    if (council && registerNumber && (await registerExists(council, registerNumber, uid))) {
      return res.status(409).json({ msg: 'Este registro profissional já está cadastrado.' })
    }
```
- No objeto passado a `createUserWithId`, trocar a linha `crm_crf: role === 'CUIDADOR' ? emptyToNull(crm_crf) : null,` por:
```js
      council: role === 'CUIDADOR' ? (council || null) : null,
```
(mantém `registerNumber: emptyToNull(registerNumber)`).

- [ ] **Step 4: `updateUsers`**

- Trocar a linha `...(req.body.crm_crf !== undefined && { crm_crf: req.body.crm_crf || null }),` por:
```js
    ...(req.body.council !== undefined && { council: req.body.council || null }),
```
- Antes do `updateUser(...)`, adicionar a checagem de unicidade quando o par for enviado:
```js
    if (data.council && data.registerNumber && (await registerExists(data.council, data.registerNumber, req.params.id))) {
      return res.status(409).json({ msg: 'Este registro profissional já está cadastrado.' })
    }
```
(colocar junto ao bloco de checagens, seguindo o padrão do `emailExists` já existente).

- [ ] **Step 5: Verificar imports e suíte**

Run: `cd backend && grep -rn "crm_crf" src/ || echo "sem crm_crf no backend"` (esperado: sem ocorrências).
Run: `cd backend && node -e "import('./src/controllers/userController.js').then(()=>console.log('import OK')).catch(e=>{console.error(e.message);process.exit(1)})"` (ignora aviso de env do Firebase).
Run: `cd backend && npm test` (tudo verde).

- [ ] **Step 6: Commit**

```bash
git add backend/src/repositories/userRepository.js backend/src/controllers/userController.js backend/src/lib/userSelects.js
git commit -m "feat(validation): registerExists + council no controller/select; remove crm_crf [SEC-04]"
```

---

### Task 6: frontend — constantes de conselho

**Files:**
- Create: `frontend/src/constants/councils.js`

**Interfaces:**
- Produces: `COUNCILS` — array `[{ value, label }]` para o `<select>`. Valores idênticos ao backend.

- [ ] **Step 1: Criar o arquivo**

Criar `frontend/src/constants/councils.js`:
```js
// Conselhos profissionais (valores devem bater com backend/src/utils/councils.js).
export const COUNCILS = [
  { value: 'COREN', label: 'COREN — Enfermagem' },
  { value: 'CRM', label: 'CRM — Medicina' },
  { value: 'CRP', label: 'CRP — Psicologia' },
  { value: 'CREFITO', label: 'CREFITO — Fisio/TO' },
  { value: 'CREF', label: 'CREF — Educação Física' },
  { value: 'CRF', label: 'CRF — Farmácia' },
]
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/constants/councils.js
git commit -m "feat(frontend): lista de conselhos profissionais para o select [FE-05]"
```

---

### Task 7: frontend — Cadastro (select de conselho + nome)

**Files:**
- Modify: `frontend/src/pages/Cadastro/index.jsx`
- Modify: `frontend/src/pages/Cadastro/Cadastro.test.jsx`

**Interfaces:**
- Consumes: `COUNCILS` (Task 6); backend exige o par conselho+registro e valida nome.

> Ler o arquivo antes de editar. A página tem o campo `crm_crf` (ref `inputCrmCrf`) dentro do bloco `role === 'CUIDADOR'` e o monta no payload como `payload.crm_crf`.

- [ ] **Step 1: Substituir o campo de registro do Cuidador**

No `frontend/src/pages/Cadastro/index.jsx`:
- Adicionar estado: `const [council, setCouncil] = useState('')` e um ref para o número: `const inputRegister = useRef()`. Importar `COUNCILS` de `../../constants/councils`.
- Remover o ref `inputCrmCrf` e o `<Field>` de "CRM / CRF (opcional)".
- No bloco `role === 'CUIDADOR'`, renderizar um `<Field as="select">` de Conselho (opções de `COUNCILS`, com uma opção vazia "Conselho (opcional)") + um `<Field ref={inputRegister}>` para o número ("Número do registro").
- No submit, no lugar do bloco `if (role === 'CUIDADOR') { const crmCrf = ...; if (crmCrf) payload.crm_crf = crmCrf }`, montar:
```js
      if (role === 'CUIDADOR') {
        const registerNumber = inputRegister.current?.value?.trim()
        if (council && registerNumber) {
          payload.council = council
          payload.registerNumber = registerNumber
        } else if (council || registerNumber) {
          toast.warning('Informe o conselho e o número do registro (ou deixe ambos em branco).')
          setSubmitting(false)
          return
        }
      }
```
- Nome: adicionar antes do `setSubmitting(true)` uma checagem leve: se o nome tiver dígitos/símbolos óbvios, avisar. Mínimo: `if (!/^[\p{L} .'-]{2,}$/u.test(name)) { toast.warning('Informe um nome válido (apenas letras).'); return }` (o backend continua sendo a fonte de verdade).

- [ ] **Step 2: Ajustar o teste**

Em `Cadastro.test.jsx`, o teste de renderização não deve mais buscar "CRM / CRF". Se algum teste dependia do campo antigo, ajustar. Adicionar (ou ajustar) uma asserção de que, para CUIDADOR, o select de Conselho aparece (`screen.getByLabelText(/conselho/i)` ou similar). Manter os testes de fluxo passando (o happy-path é FAMILIAR e não envia registro).

- [ ] **Step 3: Verificar**

Run: `cd frontend && npx vitest run src/pages/Cadastro/Cadastro.test.jsx` (pass), `npx eslint src/pages/Cadastro/index.jsx` (clean), `npm run build` (ok).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Cadastro/
git commit -m "feat(cadastro): select de conselho + número; validação leve de nome [FE-05/FE-08]"
```

---

### Task 8: frontend — Perfil (select de conselho)

**Files:**
- Modify: `frontend/src/pages/Perfil/index.jsx`

**Interfaces:**
- Consumes: `COUNCILS` (Task 6).

> Ler o arquivo. Ele tem `userData.registerNumber` (estado, form e payload). Falta o `council`.

- [ ] **Step 1: Adicionar `council` ao estado, form e payload**

- Importar `COUNCILS` de `../../constants/councils`.
- No estado inicial e no `mapUserToForm`, adicionar `council: ''` / `council: user.council ?? ''`.
- No campo de registro (label "Registro profissional (COREN, CRP, etc.)"), adicionar acima do input um `<select>` de Conselho (opções de `COUNCILS` + opção vazia) ligado a `userData.council`, no mesmo padrão de estilo (`FIELD_CLASS`).
- No payload do update, incluir `council: userData.council || null` junto de `registerNumber`.
- Validação leve: se um dos dois (council/registerNumber) estiver preenchido e o outro não, avisar via `setMessage`/toast antes de enviar (o backend também valida).

- [ ] **Step 2: Verificar**

Run: `cd frontend && npx eslint src/pages/Perfil/index.jsx` (clean), `npm run build` (ok), `npx vitest run` (suíte verde).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Perfil/index.jsx
git commit -m "feat(perfil): select de conselho junto ao registro [FE-05]"
```

---

### Task 9: frontend — User (perfil público) exibe conselho

**Files:**
- Modify: `frontend/src/pages/User/index.jsx`

- [ ] **Step 1: Trocar a exibição do registro**

Substituir o bloco:
```jsx
{(user.crm_crf || user.registerNumber) && (
  <p className="text-sm text-virla-texto/70">
    <span className="font-semibold">CRM/CRF: </span>
    {user.crm_crf || user.registerNumber}
  </p>
)}
```
por:
```jsx
{user.council && user.registerNumber && (
  <p className="text-sm text-virla-texto/70">
    <span className="font-semibold">Registro: </span>
    {user.council} {user.registerNumber}
  </p>
)}
```

- [ ] **Step 2: Verificar**

Run: `cd frontend && npx eslint src/pages/User/index.jsx` (clean), `npm run build` (ok).
Run: `cd frontend && grep -rn "crm_crf" src/ || echo "sem crm_crf no frontend"` (esperado: sem ocorrências).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/User/index.jsx
git commit -m "feat(user): exibe conselho + número no perfil público [FE-05]"
```

---

### Task 10: frontend — endurecer upload (ProfileImageUpload)

**Files:**
- Modify: `frontend/src/components/ProfileImageUpload/index.jsx`
- Test: `frontend/src/components/ProfileImageUpload/ProfileImageUpload.test.jsx` (create)

**Interfaces:** nenhuma externa.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/components/ProfileImageUpload/ProfileImageUpload.test.jsx`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProfileImageUpload from './index'

function selectFile(input, { type, size, name = 'f' }) {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  fireEvent.change(input, { target: { files: [file] } })
}

describe('ProfileImageUpload', () => {
  it('rejeita GIF (fora da whitelist)', () => {
    render(<ProfileImageUpload value="" onChange={vi.fn()} />)
    const input = screen.getByLabelText('Selecionar foto de perfil')
    selectFile(input, { type: 'image/gif', size: 1000 })
    expect(screen.getByText(/JPG, PNG ou WEBP/i)).toBeInTheDocument()
  })

  it('rejeita arquivo maior que 5 MB', () => {
    render(<ProfileImageUpload value="" onChange={vi.fn()} />)
    const input = screen.getByLabelText('Selecionar foto de perfil')
    selectFile(input, { type: 'image/png', size: 6 * 1024 * 1024 })
    expect(screen.getByText(/5 MB/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/components/ProfileImageUpload/ProfileImageUpload.test.jsx`
Expected: FAIL (GIF ainda aceito; limite 2 MB).

- [ ] **Step 3: Editar o componente**

Em `frontend/src/components/ProfileImageUpload/index.jsx`:
- `const MAX_BYTES = 5 * 1024 * 1024`
- `const ACCEPT = 'image/jpeg,image/png,image/webp'`
- Trocar a checagem de tipo por uma whitelist explícita:
```js
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
    if (!ALLOWED.includes(file.type)) {
      setError('Formato inválido. Envie JPG, PNG ou WEBP.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Imagem muito grande. Máximo 5 MB.')
      return
    }
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/components/ProfileImageUpload/ProfileImageUpload.test.jsx` (pass), `npm run build` (ok).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProfileImageUpload/
git commit -m "feat(upload): whitelist JPG/PNG/WEBP + limite 5MB [FE-09]"
```

---

## Self-Review (cobertura do spec)

- **Registro estruturado (FE-05):** util (T1), schema conselho+par (T4), repo/controller/select (T5), frontend Cadastro (T7)/Perfil (T8)/User (T9), constantes (T6).
- **SEC-04 registro:** `registerExists` + 409 (T5).
- **FE-08 nome:** util (T2), schema (T3), frontend Cadastro (T7).
- **FE-04 valor/hora:** `hourlyRateSchema` (T3).
- **FE-09 upload:** schema (T3, prefixo+limite) + componente (T10).
- **`crm_crf` removido:** schemas (T4), controller/select (T5), frontend Cadastro (T7)/User (T9) — verificado por grep em T5/T9.

Nomes consistentes: `isValidCouncil`, `isValidRegister`, `COUNCIL_VALUES`, `isValidName`, `nameSchema`, `hourlyRateSchema`, `councilSchema`, `refineRegisterPair`, `registerExists`.

**Nota:** `registerExists` faz query com dois filtros de igualdade (`council` + `registerNumber`) — o Firestore resolve com índices de campo único (zig-zag), sem índice composto. As páginas `Cadastro`, `Perfil`, `User` são editadas por contrato (ler o arquivo antes); preservar o restante.
