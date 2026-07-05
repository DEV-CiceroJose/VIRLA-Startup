# Fase 2 (bloco A) — UX de formulários (Perfil/Cadastro) + SEC-05 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar FE-01, FE-02, FE-03, FE-06, FE-07, FE-10, FE-11 e SEC-05 do roadmap Virla — polimento de UX no formulário de Perfil (UF como select, CEP com autopreenchimento ViaCEP, máscara monetária, especialidades como multi-select fixo, contador de caracteres na bio, % de perfil completo, erros inline por campo) e fechamento da única lacuna de tamanho/limite (`specialties`) encontrada na auditoria SEC-05.

**Architecture:** Backend ganha um campo novo (`zipCode`, self-only) e troca `specialties` de string livre para enum de lista fixa — ambos em `userSchemas.js`, espelhando os padrões já existentes (`cpfSchema`, `councils.js`). Frontend ganha 3 utilitários pequenos (`states.js`, `specialties.js`, `viacep.js`, mais 2 helpers em `formatters.js`) e 2 componentes de UI novos (`TagSelect`, `ProfileCompleteness`), depois integra tudo em `pages/Perfil/index.jsx`, que é migrado dos `<input>` crus atuais para o componente `Field` do design system (isso é o que entrega FE-11: asterisco de obrigatório e erro inline já são built-in do `Field`).

**Tech Stack:** Node.js + Express + Zod (backend), React 19 + Vite + Tailwind (frontend), `node --test` (backend), Vitest + Testing Library (frontend).

## Global Constraints

- Design aprovado em `docs/superpowers/specs/2026-07-04-fase2-form-ux-design.md` — qualquer desvio deste plano em relação ao spec precisa ser justificado ali antes de codar.
- `zipCode` entra **só** em `USER_SELF_SELECT` (`backend/src/lib/userSelects.js`), nunca em `USER_PUBLIC_SELECT` — não pode aparecer em respostas de feed/perfil público.
- `specialties` passa a ser `z.array(z.enum(SPECIALTY_VALUES)).max(12)` — remove totalmente o suporte a string livre/CSV no schema (o parsing CSV em `parseSpecialties` no controller pode continuar existindo, mas deixa de ser exercitado por specialties válidas vindas do schema).
- Cadastro (`pages/Cadastro/index.jsx`) **não muda** — endereço/especialidades continuam sendo preenchidos só depois, no Perfil.
- Nenhuma dependência nova via npm — `fetch` nativo do browser para ViaCEP (não usar `services/api.js`, que injeta o Bearer token do Firebase e não deve ser usado para chamar um serviço de terceiros não autenticado).
- Barra de verificação final igual às Fases 0/1: `node --test` (backend) 100% verde, `vitest run` (frontend) 100% verde, `npm run build` sem erro, delta de lint = 0.
- Todo texto de UI em português (pt-BR), seguindo o tom já usado no projeto (direto, sem gírias).

---

### Task 1: Backend — `SPECIALTY_VALUES` + schema `specialties` vira enum com limite (SEC-05 + base do FE-06)

**Files:**
- Create: `backend/src/utils/specialties.js`
- Create: `backend/tests/specialties.test.js`
- Modify: `backend/src/schemas/userSchemas.js`
- Modify: `backend/tests/userSchemas.test.js`

**Interfaces:**
- Produces: `SPECIALTIES` (objeto `{ VALUE: 'Label' }`), `SPECIALTY_VALUES` (array de 12 strings) exportados de `backend/src/utils/specialties.js`. Tasks futuras no frontend usam os mesmos 12 *values* (ver Task 4).

- [ ] **Step 1: Escrever o teste do util (falhando)**

Criar `backend/tests/specialties.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { SPECIALTIES, SPECIALTY_VALUES } from '../src/utils/specialties.js'

test('SPECIALTY_VALUES traz as 12 especialidades, sem duplicatas', () => {
  assert.equal(SPECIALTY_VALUES.length, 12)
  assert.equal(new Set(SPECIALTY_VALUES).size, 12)
})

test('SPECIALTIES tem um label não-vazio para cada value', () => {
  for (const value of SPECIALTY_VALUES) {
    assert.equal(typeof SPECIALTIES[value], 'string')
    assert.ok(SPECIALTIES[value].length > 0)
  }
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/specialties.test.js`
Expected: FAIL (`Cannot find module '../src/utils/specialties.js'`)

- [ ] **Step 3: Criar o util**

Criar `backend/src/utils/specialties.js`:

```js
/**
 * Especialidades de cuidado aceitas (lista fixa) — espelha
 * frontend/src/constants/specialties.js (mesmos values).
 */
export const SPECIALTIES = {
  IDOSOS: 'Idosos',
  ALZHEIMER_DEMENCIA: 'Alzheimer/Demência',
  POS_CIRURGICO: 'Pós-cirúrgico',
  FISIOTERAPIA: 'Fisioterapia',
  CUIDADOS_PALIATIVOS: 'Cuidados paliativos',
  MOBILIDADE_REDUZIDA: 'Mobilidade reduzida',
  DIABETES: 'Diabetes',
  AVC_DERRAME: 'AVC/Derrame',
  SAUDE_MENTAL: 'Saúde mental',
  CRIANCAS_NECESSIDADES_ESPECIAIS: 'Crianças com necessidades especiais',
  ACAMADOS: 'Acamados',
  HOME_CARE_24H: 'Home care 24h',
}

export const SPECIALTY_VALUES = Object.keys(SPECIALTIES)
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/specialties.test.js`
Expected: PASS (2 testes)

- [ ] **Step 5: Escrever os testes do schema (falhando)**

Adicionar ao final de `backend/tests/userSchemas.test.js`:

```js
test('specialties: aceita valores da lista fixa; rejeita valor fora da lista; rejeita mais de 12 itens', () => {
  const base = { ...baseCreate, name: 'Ana Souza' }
  const ok = createUserBodySchema.safeParse({ ...base, specialties: ['IDOSOS', 'DIABETES'] })
  assert.equal(ok.success, true, JSON.stringify(ok.error?.issues))

  assert.equal(createUserBodySchema.safeParse({ ...base, specialties: ['NAO_EXISTE'] }).success, false)

  const treze = Array(13).fill('IDOSOS')
  assert.equal(createUserBodySchema.safeParse({ ...base, specialties: treze }).success, false)

  assert.equal(createUserBodySchema.safeParse({ ...base }).success, true) // ausente ok
})

test('specialties: string livre (formato pré-FE-06) não é mais aceita', () => {
  const base = { ...baseCreate, name: 'Ana Souza' }
  assert.equal(createUserBodySchema.safeParse({ ...base, specialties: 'Idosos, Diabetes' }).success, false)
})
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/userSchemas.test.js`
Expected: FAIL nos dois testes novos (schema ainda aceita `z.union([z.string(), z.array(z.string())])`, sem `.max()`)

- [ ] **Step 7: Atualizar o schema**

Em `backend/src/schemas/userSchemas.js`, adicionar o import no topo (junto aos outros imports de `utils/`):

```js
import { SPECIALTY_VALUES } from '../utils/specialties.js'
```

Substituir a linha (aparece duas vezes, uma em `updateUserBodySchema` e outra em `createUserBodySchema`):

```js
    specialties: z.union([z.string(), z.array(z.string())]).optional().nullable(),
```

por:

```js
    specialties: z.array(z.enum(SPECIALTY_VALUES)).max(12).optional().nullable(),
```

(atenção à indentação: a ocorrência em `updateUserBodySchema` está indentada com 4 espaços dentro do `.object({...})`, a de `createUserBodySchema` com 2 espaços — mantenha a indentação de cada uma).

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/userSchemas.test.js`
Expected: PASS (todos os testes, incluindo os 2 novos)

- [ ] **Step 9: Rodar a suíte completa do backend**

Run: `cd backend && node --test`
Expected: PASS (todos os testes, sem regressão)

- [ ] **Step 10: Commit**

```bash
git add backend/src/utils/specialties.js backend/tests/specialties.test.js backend/src/schemas/userSchemas.js backend/tests/userSchemas.test.js
git commit -m "feat(validation): specialties vira enum de lista fixa com limite de 12 [SEC-05/FE-06]"
```

---

### Task 2: Backend — campo `zipCode` (schema + select + controller) [FE-02]

**Files:**
- Modify: `backend/src/schemas/userSchemas.js`
- Modify: `backend/tests/userSchemas.test.js`
- Modify: `backend/src/lib/userSelects.js`
- Modify: `backend/src/controllers/userController.js`

**Interfaces:**
- Produces: `zipCodeSchema` (exportado de `userSchemas.js`, mesmo padrão de `profileImageSchema`); campo `zipCode` em `createUserBodySchema`/`updateUserBodySchema`, normalizado para 8 dígitos (sem hífen) ou `null`/`undefined`.

- [ ] **Step 1: Escrever os testes do schema (falhando)**

Adicionar ao final de `backend/tests/userSchemas.test.js`:

```js
test('zipCode: aceita com/sem hífen e normaliza pra 8 dígitos; rejeita formato inválido; ausente ok', () => {
  const base = { ...baseCreate, name: 'Ana Souza' }

  const comHifen = createUserBodySchema.safeParse({ ...base, zipCode: '50030-230' })
  assert.equal(comHifen.success, true, JSON.stringify(comHifen.error?.issues))
  assert.equal(comHifen.data.zipCode, '50030230')

  const semHifen = createUserBodySchema.safeParse({ ...base, zipCode: '50030230' })
  assert.equal(semHifen.success, true)
  assert.equal(semHifen.data.zipCode, '50030230')

  assert.equal(createUserBodySchema.safeParse({ ...base, zipCode: '123' }).success, false)
  assert.equal(createUserBodySchema.safeParse({ ...base }).success, true)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/userSchemas.test.js`
Expected: FAIL (`Unrecognized key(s) in object: 'zipCode'` — `createUserBodySchema` não é `.strict()`, então na verdade o Zod ignora chaves desconhecidas por padrão; o teste falha porque `comHifen.data.zipCode` é `undefined`, não `'50030230'`)

- [ ] **Step 3: Adicionar `zipCodeSchema` e o campo nos dois schemas**

Em `backend/src/schemas/userSchemas.js`, adicionar depois de `profileImageSchema`:

```js
export const zipCodeSchema = z
  .string()
  .max(9)
  .optional()
  .nullable()
  .transform((v) => (v ? v.replace(/\D/g, '') : v))
  .refine((v) => !v || /^\d{8}$/.test(v), { message: 'CEP deve ter 8 dígitos (ex.: 00000-000).' })
```

Adicionar `zipCode: zipCodeSchema,` em `updateUserBodySchema` (dentro do `.object({...})`, junto de `city`/`state`) e em `createUserBodySchema` (mesma vizinhança).

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/userSchemas.test.js`
Expected: PASS

- [ ] **Step 5: Restringir `zipCode` a `USER_SELF_SELECT`**

Em `backend/src/lib/userSelects.js`, adicionar `zipCode: true,` **só** dentro de `USER_SELF_SELECT` (depois de `cpf: true,`), não em `USER_PUBLIC_SELECT`:

```js
export const USER_SELF_SELECT = {
  ...USER_PUBLIC_SELECT,
  email: true,
  cpf: true,
  zipCode: true,
}
```

- [ ] **Step 6: Passar `zipCode` pelo controller (create)**

Em `backend/src/controllers/userController.js`, na função `createUsers`, adicionar `zipCode` à desestruturação de `req.body` (linha com `name, birthDate: birthDateRaw, role, bio, cpf, ...`):

```js
  const {
    name, birthDate: birthDateRaw, role, bio, cpf,
    profileImage, council, hourlyRate: hourlyRateRaw, registerNumber,
    approach, specialties, description, city, state, zipCode,
  } = req.body
```

E adicionar `zipCode: emptyToNull(zipCode),` no objeto passado a `createUserWithId` (junto de `city: emptyToNull(city),`):

```js
      specialties: parseSpecialties(specialties),
      approach: emptyToNull(approach),
      description: emptyToNull(description),
      city: emptyToNull(city),
      state: emptyToNull(state),
      zipCode: emptyToNull(zipCode),
    })
```

- [ ] **Step 7: Passar `zipCode` pelo controller (update)**

Na função `updateUsers`, no objeto `data`, adicionar (junto de `city`/`state`):

```js
    ...(req.body.city !== undefined && { city: req.body.city || null }),
    ...(req.body.state !== undefined && { state: req.body.state || null }),
    ...(req.body.zipCode !== undefined && { zipCode: req.body.zipCode || null }),
  }
```

- [ ] **Step 8: Rodar a suíte completa do backend**

Run: `cd backend && node --test`
Expected: PASS (sem regressão — não há teste de controller dedicado neste projeto; a cobertura vem do schema)

- [ ] **Step 9: Commit**

```bash
git add backend/src/schemas/userSchemas.js backend/tests/userSchemas.test.js backend/src/lib/userSelects.js backend/src/controllers/userController.js
git commit -m "feat(perfil): campo zipCode (CEP), self-only, normalizado pro schema [FE-02]"
```

---

### Task 3: Frontend — `constants/states.js` (27 UFs) [FE-01]

**Files:**
- Create: `frontend/src/constants/states.js`
- Create: `frontend/src/constants/states.test.js`

**Interfaces:**
- Produces: `STATES` — array de `{ value: string, label: string }`, 27 itens. Consumida pela Task 11 (select de UF no Perfil).

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `frontend/src/constants/states.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { STATES } from './states'

describe('STATES', () => {
  it('tem as 27 UFs, sem duplicatas', () => {
    expect(STATES).toHaveLength(27)
    const values = STATES.map((s) => s.value)
    expect(new Set(values).size).toBe(27)
  })

  it('todo value tem exatamente 2 letras maiúsculas', () => {
    for (const s of STATES) {
      expect(s.value).toMatch(/^[A-Z]{2}$/)
    }
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/constants/states.test.js`
Expected: FAIL (`Failed to resolve import "./states"`)

- [ ] **Step 3: Criar o arquivo**

Criar `frontend/src/constants/states.js`:

```js
// 27 UFs (26 estados + Distrito Federal) — select de estado (FE-01).
export const STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
]
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/constants/states.test.js`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/constants/states.js frontend/src/constants/states.test.js
git commit -m "feat(perfil): lista de UFs pro select de estado [FE-01]"
```

---

### Task 4: Frontend — `constants/specialties.js` (espelha o backend) [FE-06]

**Files:**
- Create: `frontend/src/constants/specialties.js`
- Create: `frontend/src/constants/specialties.test.js`

**Interfaces:**
- Produces: `SPECIALTIES` — array de `{ value: string, label: string }`, 12 itens; `SPECIALTY_VALUES` — array dos 12 `value`. Mesmos `value` do backend (Task 1). Consumida pelas Tasks 8 (TagSelect), 9 (ProfileCompleteness) e 13 (integração no Perfil).

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `frontend/src/constants/specialties.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { SPECIALTIES, SPECIALTY_VALUES } from './specialties'

describe('SPECIALTIES', () => {
  it('tem 12 itens únicos', () => {
    expect(SPECIALTIES).toHaveLength(12)
    expect(new Set(SPECIALTY_VALUES).size).toBe(12)
  })

  it('SPECIALTY_VALUES é a lista de values de SPECIALTIES, na mesma ordem', () => {
    expect(SPECIALTY_VALUES).toEqual(SPECIALTIES.map((s) => s.value))
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/constants/specialties.test.js`
Expected: FAIL (`Failed to resolve import "./specialties"`)

- [ ] **Step 3: Criar o arquivo**

Criar `frontend/src/constants/specialties.js`:

```js
// Espelha backend/src/utils/specialties.js — mesmos values.
export const SPECIALTIES = [
  { value: 'IDOSOS', label: 'Idosos' },
  { value: 'ALZHEIMER_DEMENCIA', label: 'Alzheimer/Demência' },
  { value: 'POS_CIRURGICO', label: 'Pós-cirúrgico' },
  { value: 'FISIOTERAPIA', label: 'Fisioterapia' },
  { value: 'CUIDADOS_PALIATIVOS', label: 'Cuidados paliativos' },
  { value: 'MOBILIDADE_REDUZIDA', label: 'Mobilidade reduzida' },
  { value: 'DIABETES', label: 'Diabetes' },
  { value: 'AVC_DERRAME', label: 'AVC/Derrame' },
  { value: 'SAUDE_MENTAL', label: 'Saúde mental' },
  { value: 'CRIANCAS_NECESSIDADES_ESPECIAIS', label: 'Crianças com necessidades especiais' },
  { value: 'ACAMADOS', label: 'Acamados' },
  { value: 'HOME_CARE_24H', label: 'Home care 24h' },
]

export const SPECIALTY_VALUES = SPECIALTIES.map((s) => s.value)
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/constants/specialties.test.js`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/constants/specialties.js frontend/src/constants/specialties.test.js
git commit -m "feat(perfil): lista fixa de especialidades, espelha o backend [FE-06]"
```

---

### Task 5: Frontend — `formatters.maskCep` [FE-02]

**Files:**
- Modify: `frontend/src/utils/formatters.js`
- Create: `frontend/src/utils/formatters.test.js` (o arquivo não existe ainda — `formatHourly` nunca teve teste dedicado; este arquivo passa a cobrir tudo em `formatters.js`, incluindo um teste de regressão pra `formatHourly`)

**Interfaces:**
- Produces: `maskCep(value: string) => string` — máscara `00000-000`.

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `frontend/src/utils/formatters.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { formatHourly, maskCep } from './formatters'

describe('formatHourly (regressão)', () => {
  it('formata número como BRL/h', () => {
    expect(formatHourly(25)).toMatch(/R\$\s?25,00\/h/)
  })

  it('retorna null pra valor inválido', () => {
    expect(formatHourly(null)).toBe(null)
    expect(formatHourly('abc')).toBe(null)
  })
})

describe('maskCep (FE-02)', () => {
  it('formata 8 dígitos como 00000-000', () => {
    expect(maskCep('50030230')).toBe('50030-230')
  })

  it('formata parcialmente enquanto o usuário digita', () => {
    expect(maskCep('500')).toBe('500')
    expect(maskCep('50030')).toBe('50030')
    expect(maskCep('500302')).toBe('50030-2')
  })

  it('ignora caracteres não-numéricos e trunca em 8 dígitos', () => {
    expect(maskCep('50.030-230999')).toBe('50030-230')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/utils/formatters.test.js`
Expected: FAIL (`maskCep is not a function` / `undefined`)

- [ ] **Step 3: Implementar `maskCep`**

Em `frontend/src/utils/formatters.js`, adicionar ao final:

```js
/** Máscara visual de CEP: 00000-000 (mesmo estilo de maskCpf). */
export function maskCep(value) {
  const d = String(value ?? '').replace(/\D/g, '').slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/utils/formatters.test.js`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/formatters.js frontend/src/utils/formatters.test.js
git commit -m "feat(perfil): máscara de CEP (formatters.maskCep) [FE-02]"
```

---

### Task 6: Frontend — `formatters.maskCurrencyInput` / `parseCurrencyInput` [FE-03]

**Files:**
- Modify: `frontend/src/utils/formatters.js`
- Modify: `frontend/src/utils/formatters.test.js`

**Interfaces:**
- Produces: `maskCurrencyInput(rawDigits: string) => string` (ex.: `"2500"` → `"R$ 25,00"`); `parseCurrencyInput(masked: string) => string` (ex.: `"R$ 25,00"` → `"25.00"`). Consumida pela Task 12 (hourlyRate no Perfil).

- [ ] **Step 1: Escrever os testes (falhando)**

Adicionar ao final de `frontend/src/utils/formatters.test.js`:

```js
describe('maskCurrencyInput / parseCurrencyInput (FE-03)', () => {
  it('maskCurrencyInput trata os dígitos digitados como centavos', () => {
    expect(maskCurrencyInput('2500')).toMatch(/R\$\s?25,00/)
    expect(maskCurrencyInput('150')).toMatch(/R\$\s?1,50/)
    expect(maskCurrencyInput('')).toBe('')
  })

  it('maskCurrencyInput ignora caracteres não-numéricos', () => {
    expect(maskCurrencyInput('R$ 25,00')).toMatch(/R\$\s?25,00/)
  })

  it('parseCurrencyInput extrai o valor numérico em reais (string com 2 casas)', () => {
    expect(parseCurrencyInput('R$ 25,00')).toBe('25.00')
    expect(parseCurrencyInput('R$ 150,00')).toBe('150.00')
    expect(parseCurrencyInput('')).toBe('')
  })

  it('maskCurrencyInput e parseCurrencyInput são inversos pro caso comum', () => {
    const masked = maskCurrencyInput('2500')
    expect(parseCurrencyInput(masked)).toBe('25.00')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/utils/formatters.test.js`
Expected: FAIL (`maskCurrencyInput is not a function`)

- [ ] **Step 3: Implementar as duas funções**

Em `frontend/src/utils/formatters.js`, adicionar ao final:

```js
/**
 * Máscara de moeda BRL para input controlado: trata os dígitos digitados
 * como centavos (ex.: "2500" → "R$ 25,00"). Usar com parseCurrencyInput
 * pra extrair o valor numérico antes de enviar ao backend.
 */
export function maskCurrencyInput(rawValue) {
  const digits = String(rawValue ?? '').replace(/\D/g, '')
  if (!digits) return ''
  const reais = parseInt(digits, 10) / 100
  return reais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Extrai o valor numérico (em reais, string com 2 casas) de um valor mascarado em BRL. */
export function parseCurrencyInput(masked) {
  const digits = String(masked ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return (parseInt(digits, 10) / 100).toFixed(2)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/utils/formatters.test.js`
Expected: PASS (9 testes no arquivo todo)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/formatters.js frontend/src/utils/formatters.test.js
git commit -m "feat(perfil): máscara monetária pro valor por hora [FE-03]"
```

---

### Task 7: Frontend — `services/viacep.js` [FE-02]

**Files:**
- Create: `frontend/src/services/viacep.js`
- Create: `frontend/src/services/viacep.test.js`

**Interfaces:**
- Produces: `lookupCep(cep: string) => Promise<{ city: string, state: string } | null>`. Nunca lança (sempre resolve). Consumida pela Task 11 (autopreenchimento no Perfil).

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `frontend/src/services/viacep.test.js`:

```js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { lookupCep } from './viacep'

describe('lookupCep', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('devolve city/state em sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ localidade: 'Recife', uf: 'PE' }),
    }))
    expect(await lookupCep('50030-230')).toEqual({ city: 'Recife', state: 'PE' })
  })

  it('devolve null quando o ViaCEP responde erro:true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ erro: true }),
    }))
    expect(await lookupCep('00000000')).toBe(null)
  })

  it('devolve null em falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await lookupCep('50030230')).toBe(null)
  })

  it('devolve null se a resposta HTTP não for ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await lookupCep('50030230')).toBe(null)
  })

  it('devolve null sem chamar fetch se o CEP não tem 8 dígitos', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await lookupCep('123')).toBe(null)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/services/viacep.test.js`
Expected: FAIL (`Failed to resolve import "./viacep"`)

- [ ] **Step 3: Implementar o serviço**

Criar `frontend/src/services/viacep.js`:

```js
/**
 * Consulta o ViaCEP (https://viacep.com.br) e devolve { city, state } ou
 * null se o CEP for inválido/não encontrado ou a rede falhar. Nunca lança —
 * quem chama decide se avisa o usuário ou ignora silenciosamente.
 *
 * Usa fetch nativo (não services/api.js): é uma API pública de terceiros,
 * sem autenticação — não deve levar o Bearer token do Firebase.
 */
export async function lookupCep(cep) {
  const digits = String(cep ?? '').replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.erro) return null
    return { city: data.localidade ?? '', state: data.uf ?? '' }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/services/viacep.test.js`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/viacep.js frontend/src/services/viacep.test.js
git commit -m "feat(perfil): serviço de consulta ViaCEP [FE-02]"
```

---

### Task 8: Frontend — componente `TagSelect` [FE-06]

**Files:**
- Create: `frontend/src/components/ui/TagSelect.jsx`
- Create: `frontend/src/components/ui/TagSelect.test.jsx`
- Modify: `frontend/src/components/ui/index.js`

**Interfaces:**
- Consumes: nada de tasks anteriores (componente autocontido).
- Produces: `TagSelect({ options, value, onChange, max, label })` — `options: {value, label}[]`, `value: string[]`, `onChange: (string[]) => void`, `max?: number`. Exportado de `frontend/src/components/ui/index.js`. Consumido pela Task 13.

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `frontend/src/components/ui/TagSelect.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TagSelect from './TagSelect'

const OPTIONS = [
  { value: 'A', label: 'Opção A' },
  { value: 'B', label: 'Opção B' },
  { value: 'C', label: 'Opção C' },
]

describe('TagSelect', () => {
  it('adiciona um valor ao clicar numa opção não selecionada', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagSelect options={OPTIONS} value={[]} onChange={onChange} label="Especialidades" />)
    await user.click(screen.getByRole('button', { name: 'Opção A' }))
    expect(onChange).toHaveBeenCalledWith(['A'])
  })

  it('remove um valor já selecionado ao clicar de novo', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagSelect options={OPTIONS} value={['A', 'B']} onChange={onChange} label="Especialidades" />)
    await user.click(screen.getByRole('button', { name: 'Opção A' }))
    expect(onChange).toHaveBeenCalledWith(['B'])
  })

  it('marca aria-pressed=true nas opções selecionadas', () => {
    render(<TagSelect options={OPTIONS} value={['B']} onChange={vi.fn()} label="Especialidades" />)
    expect(screen.getByRole('button', { name: 'Opção B' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Opção A' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('desabilita opções não selecionadas ao atingir o max', () => {
    render(<TagSelect options={OPTIONS} value={['A', 'B']} onChange={vi.fn()} max={2} label="Especialidades" />)
    expect(screen.getByRole('button', { name: 'Opção C' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Opção A' })).not.toBeDisabled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/components/ui/TagSelect.test.jsx`
Expected: FAIL (`Failed to resolve import "./TagSelect"`)

- [ ] **Step 3: Implementar o componente**

Criar `frontend/src/components/ui/TagSelect.jsx`:

```jsx
/**
 * Multi-select de chips a partir de uma lista fixa de opções.
 * Clique alterna seleção; ao atingir `max`, as opções não selecionadas
 * ficam desabilitadas.
 */
export default function TagSelect({ options, value = [], onChange, max, label }) {
  function toggle(optValue) {
    const selected = value.includes(optValue)
    if (selected) {
      onChange(value.filter((v) => v !== optValue))
      return
    }
    if (max != null && value.length >= max) return
    onChange([...value, optValue])
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <span className="block text-xs font-semibold text-virla-muted uppercase tracking-wide">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((opt) => {
          const selected = value.includes(opt.value)
          const disabled = !selected && max != null && value.length >= max
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => toggle(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                selected
                  ? 'bg-virla-roxo text-white border-virla-roxo'
                  : 'bg-white text-virla-texto/70 border-virla-roxo/25 hover:bg-virla-roxo/5'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/components/ui/TagSelect.test.jsx`
Expected: PASS (4 testes)

- [ ] **Step 5: Exportar no barrel do design system**

Em `frontend/src/components/ui/index.js`, adicionar:

```js
export { default as TagSelect } from './TagSelect'
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/TagSelect.jsx frontend/src/components/ui/TagSelect.test.jsx frontend/src/components/ui/index.js
git commit -m "feat(ui): componente TagSelect (multi-select de chips) [FE-06]"
```

---

### Task 9: Frontend — componente `ProfileCompleteness` [FE-10]

**Files:**
- Create: `frontend/src/components/ProfileCompleteness/index.jsx`
- Create: `frontend/src/components/ProfileCompleteness/ProfileCompleteness.test.jsx`

**Interfaces:**
- Consumes: nada (recebe `userData`/`role` como props, formato simples de objeto).
- Produces: `computeCompleteness(userData, role) => { percent: number, missing: string[] }` (nomeado, exportado); `ProfileCompleteness({ userData, role })` (default export) — não renderiza nada (`null`) quando `percent === 100`. Consumido pela Task 15.

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `frontend/src/components/ProfileCompleteness/ProfileCompleteness.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProfileCompleteness, { computeCompleteness } from './index'

const CUIDADOR_COMPLETO = {
  profileImage: 'data:image/png;base64,x',
  bio: 'Sobre mim',
  hourlyRate: '25.00',
  zipCode: '50030230',
  city: '',
  state: '',
  council: 'COREN',
  registerNumber: '123456',
  specialties: ['IDOSOS'],
  description: 'Experiência de 5 anos...',
}

const CUIDADOR_VAZIO = {
  profileImage: '', bio: '', hourlyRate: '', zipCode: '', city: '', state: '',
  council: '', registerNumber: '', specialties: [], description: '',
}

describe('computeCompleteness', () => {
  it('CUIDADOR: 100% quando os 7 itens estão preenchidos', () => {
    const { percent, missing } = computeCompleteness(CUIDADOR_COMPLETO, 'CUIDADOR')
    expect(percent).toBe(100)
    expect(missing).toEqual([])
  })

  it('CUIDADOR: 0% e lista os 7 itens faltantes quando tudo está vazio', () => {
    const { percent, missing } = computeCompleteness(CUIDADOR_VAZIO, 'CUIDADOR')
    expect(percent).toBe(0)
    expect(missing).toHaveLength(7)
  })

  it('CUIDADOR: aceita cidade+estado no lugar do CEP pro item de endereço', () => {
    const userData = { ...CUIDADOR_COMPLETO, zipCode: '', city: 'Recife', state: 'PE' }
    expect(computeCompleteness(userData, 'CUIDADOR').percent).toBe(100)
  })

  it('FAMILIAR: usa checklist reduzido (3 itens: foto, bio, endereço)', () => {
    const userData = { profileImage: 'x', bio: 'y', city: 'Recife', state: 'PE' }
    const { percent, missing } = computeCompleteness(userData, 'FAMILIAR')
    expect(percent).toBe(100)
    expect(missing).toEqual([])
  })
})

describe('ProfileCompleteness', () => {
  it('não renderiza nada quando o perfil está 100% completo', () => {
    const userData = { profileImage: 'x', bio: 'y', city: 'Recife', state: 'PE' }
    const { container } = render(<ProfileCompleteness userData={userData} role="FAMILIAR" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra a barra e a lista de faltantes quando incompleto', () => {
    render(<ProfileCompleteness userData={CUIDADOR_VAZIO} role="CUIDADOR" />)
    expect(screen.getByText(/perfil 0% completo/i)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/components/ProfileCompleteness/ProfileCompleteness.test.jsx`
Expected: FAIL (`Failed to resolve import "./index"`)

- [ ] **Step 3: Implementar o componente**

Criar `frontend/src/components/ProfileCompleteness/index.jsx`:

```jsx
const CUIDADOR_CHECKS = [
  { label: 'Foto de perfil', test: (u) => Boolean(u.profileImage) },
  { label: 'Bio', test: (u) => Boolean(u.bio?.trim()) },
  { label: 'Valor por hora', test: (u) => u.hourlyRate !== '' && u.hourlyRate != null },
  {
    label: 'CEP ou cidade/estado',
    test: (u) => Boolean(u.zipCode?.trim()) || Boolean(u.city?.trim() && u.state?.trim()),
  },
  { label: 'Conselho e registro profissional', test: (u) => Boolean(u.council && u.registerNumber?.trim()) },
  { label: 'Especialidades', test: (u) => Array.isArray(u.specialties) && u.specialties.length > 0 },
  { label: 'Descrição', test: (u) => Boolean(u.description?.trim()) },
]

const FAMILIAR_CHECKS = [
  { label: 'Foto de perfil', test: (u) => Boolean(u.profileImage) },
  { label: 'Bio', test: (u) => Boolean(u.bio?.trim()) },
  {
    label: 'CEP ou cidade/estado',
    test: (u) => Boolean(u.zipCode?.trim()) || Boolean(u.city?.trim() && u.state?.trim()),
  },
]

/** Percentual de conclusão do perfil + lista dos itens que faltam (labels). */
export function computeCompleteness(userData, role) {
  const checks = role === 'FAMILIAR' ? FAMILIAR_CHECKS : CUIDADOR_CHECKS
  const missing = checks.filter((c) => !c.test(userData))
  const percent = Math.round(((checks.length - missing.length) / checks.length) * 100)
  return { percent, missing: missing.map((c) => c.label) }
}

export default function ProfileCompleteness({ userData, role }) {
  const { percent, missing } = computeCompleteness(userData, role)
  if (percent === 100) return null

  return (
    <div className="bg-white/80 rounded-2xl border border-virla-roxo/10 p-4 space-y-2">
      <div className="flex items-center justify-between text-sm font-semibold text-virla-texto">
        <span>Perfil {percent}% completo</span>
      </div>
      <div className="w-full h-2 rounded-full bg-virla-roxo/10 overflow-hidden">
        <div
          className="h-full bg-virla-roxo rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {missing.length > 0 && (
        <p className="text-xs text-virla-muted">Faltam: {missing.join(', ')}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/components/ProfileCompleteness/ProfileCompleteness.test.jsx`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProfileCompleteness
git commit -m "feat(perfil): componente de % de perfil completo [FE-10]"
```

---

### Task 10: Frontend — Perfil migra pro `Field` do design system + erro inline (FE-11)

**Files:**
- Create: `frontend/src/pages/Perfil/Perfil.test.jsx`
- Modify: `frontend/src/pages/Perfil/index.jsx`

**Interfaces:**
- Consumes: `Field` (`frontend/src/components/ui/index.js`, já existente — ver `frontend/src/components/ui/Field.jsx`).
- Produces: mesma página, mesmo `handleUpdate`/`mapUserToForm` (comportamento idêntico), só a apresentação muda: todo campo tem `<label htmlFor>` associado (via `Field`), e o erro de par conselho/registro passa a aparecer embaixo do campo "Registro profissional" (`fieldErrors.registerNumber`) em vez de só no `Alert` genérico do topo.

Este é o único task desta lista que segue TDD "às avessas" no sentido de que o teste descreve o comportamento **novo** (labels acessíveis via `Field`) e falha contra o código **atual** (inputs crus sem `htmlFor`) — exatamente o ciclo red/green esperado.

- [ ] **Step 1: Escrever o teste (falhando contra o código atual)**

Criar `frontend/src/pages/Perfil/Perfil.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('../../services/auth', () => ({
  hasPasswordProvider: vi.fn(() => true),
  linkPassword: vi.fn(),
  mapAuthError: vi.fn(() => ''),
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }))
vi.mock('../../components/ProfileImageUpload', () => ({ default: () => null }))

import Perfil from './index'
import api from '../../services/api'

const CUIDADOR = {
  id: 'u1',
  name: 'Ana Souza',
  email: 'ana@provedor.com',
  role: 'CUIDADOR',
  birthDate: '1994-05-10',
  bio: 'Sobre mim',
  profileImage: '',
  hourlyRate: 25,
  council: '',
  registerNumber: '',
  approach: '',
  specialties: [],
  description: '',
  zipCode: '',
  city: '',
  state: '',
}

function renderPerfil() {
  return render(
    <MemoryRouter>
      <Perfil />
    </MemoryRouter>,
  )
}

describe('Página de Perfil', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('meuId', 'u1')
  })

  it('carrega e mostra os campos com labels associadas (Field do design system)', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    renderPerfil()
    expect(await screen.findByLabelText('Nome completo')).toHaveValue('Ana Souza')
    expect(screen.getByLabelText('Bio / Apresentação')).toHaveValue('Sobre mim')
    expect(screen.getByLabelText('Cidade')).toBeInTheDocument()
    expect(screen.getByLabelText('Estado (UF)')).toBeInTheDocument()
    expect(screen.getByLabelText('Conselho profissional')).toBeInTheDocument()
    expect(screen.getByLabelText('Registro profissional (COREN, CRP, etc.)')).toBeInTheDocument()
  })

  it('mostra o erro de par conselho/registro no campo, não no banner genérico', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    const user = userEvent.setup()
    renderPerfil()
    await screen.findByLabelText('Nome completo')
    await user.selectOptions(screen.getByLabelText('Conselho profissional'), 'COREN')
    await user.click(screen.getByRole('button', { name: /salvar altera/i }))

    expect(await screen.findByText('Informe o conselho e o número do registro.')).toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('salva o perfil com sucesso', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    api.put.mockResolvedValue({ data: { user: { ...CUIDADOR, name: 'Ana Nova' } } })
    const user = userEvent.setup()
    renderPerfil()
    const nameInput = await screen.findByLabelText('Nome completo')
    await user.clear(nameInput)
    await user.type(nameInput, 'Ana Nova')
    await user.click(screen.getByRole('button', { name: /salvar altera/i }))

    expect(await screen.findByText('Perfil atualizado com sucesso!')).toBeInTheDocument()
    expect(api.put).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/Perfil/Perfil.test.jsx`
Expected: FAIL — `getByLabelText('Nome completo')` não encontra nada (os `<label>` atuais não têm `htmlFor`/`id` associando ao `<input>`)

- [ ] **Step 3: Migrar os imports**

Em `frontend/src/pages/Perfil/index.jsx`, no topo do arquivo, trocar:

```js
import { Button, Card, Alert, ConfirmDialog, Badge as DSBadge } from '../../components/ui'
```

por:

```js
import { Field, Button, Card, Alert, ConfirmDialog, Badge as DSBadge } from '../../components/ui'
```

Remover as constantes `FIELD_CLASS` e `DISABLED_CLASS` (não são mais usadas — `Field` já traz seu próprio estilo):

```js
const FIELD_CLASS =
  'w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-virla-texto text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-virla-roxo/30 focus:border-virla-roxo transition-all duration-200'

const DISABLED_CLASS =
  'w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-virla-texto/40 text-sm cursor-not-allowed'
```

- [ ] **Step 4: Adicionar estado `fieldErrors`**

Junto das outras `useState` do componente (depois de `const [message, setMessage] = useState({ type: '', text: '' })`), adicionar:

```js
  const [fieldErrors, setFieldErrors] = useState({})
```

- [ ] **Step 5: Atualizar `handleUpdate` pra usar `fieldErrors` no lugar do banner genérico nesses dois casos**

Substituir o início de `handleUpdate` (do `e.preventDefault()` até o fim do bloco `if (!isFamiliar) {...}`):

```js
  async function handleUpdate(e) {
    e.preventDefault()
    setMessage({ type: '', text: '' })
    const isFamiliar = userData.role === 'FAMILIAR'
    if (!isFamiliar) {
      const hasCouncil = Boolean(userData.council)
      const hasRegisterNumber = Boolean(userData.registerNumber.trim())
      if (hasCouncil !== hasRegisterNumber) {
        setMessage({
          type: 'error',
          text: 'Preencha o conselho e o número de registro juntos, ou deixe os dois em branco.',
        })
        return
      }
      if (hasCouncil && hasRegisterNumber && !isValidRegister(userData.council, userData.registerNumber.trim())) {
        setMessage({
          type: 'error',
          text: 'Número de registro inválido para o conselho informado.',
        })
        return
      }
    }
```

por:

```js
  async function handleUpdate(e) {
    e.preventDefault()
    setMessage({ type: '', text: '' })
    setFieldErrors({})
    const isFamiliar = userData.role === 'FAMILIAR'
    if (!isFamiliar) {
      const hasCouncil = Boolean(userData.council)
      const hasRegisterNumber = Boolean(userData.registerNumber.trim())
      if (hasCouncil !== hasRegisterNumber) {
        setFieldErrors({ registerNumber: 'Informe o conselho e o número do registro.' })
        return
      }
      if (hasCouncil && hasRegisterNumber && !isValidRegister(userData.council, userData.registerNumber.trim())) {
        setFieldErrors({ registerNumber: 'Número de registro inválido para o conselho informado.' })
        return
      }
    }
```

(o `Alert` genérico continua existindo pra erros de API/carregamento/exclusão, que não mudam neste task.)

- [ ] **Step 6: Migrar o bloco "Informações Pessoais"**

Substituir todo o bloco a partir de `<div>` (nome) até o fechamento do bloco da bio (da linha com `Nome completo` até o `</div>` que fecha a bio, isto é, do primeiro `<div>` depois de `<SectionTitle icon={Person}>Informações Pessoais</SectionTitle>` até o `<div className="pt-2 border-t ...">` que abre a seção seguinte):

```jsx
            <Field
              label="Nome completo"
              icon={Person}
              type="text"
              value={userData.name}
              onChange={(e) => setUserData({ ...userData, name: e.target.value })}
            />

            <Field
              label="E-mail (não editável)"
              type="text"
              value={userData.email}
              disabled
            />

            <Field
              label="Data de Nascimento"
              icon={CalendarMonth}
              type="date"
              value={userData.birthDate ? userData.birthDate.split('T')[0] : ''}
              onChange={(e) => setUserData({ ...userData, birthDate: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
            />
            {age !== null && (
              <p className="!mt-1.5 flex items-center gap-1.5 text-xs text-virla-roxo/70 font-medium">
                <Cake sx={{ fontSize: 14 }} />
                {age} anos
              </p>
            )}

            <Field
              as="textarea"
              label="Bio / Apresentação"
              icon={Description}
              rows={4}
              value={userData.bio ?? ''}
              onChange={(e) => setUserData({ ...userData, bio: e.target.value })}
              placeholder="Resumo curto para o feed…"
            />
```

- [ ] **Step 7: Migrar o bloco profissional (valor/hora, conselho, registro, abordagem, especialidades, descrição)**

Substituir o bloco `{!isFamiliar && (<>...</>)}` que contém valor por hora, conselho, registro, abordagem, especialidades e descrição:

```jsx
            {!isFamiliar && (
              <>
                <Field
                  label="Valor por hora (R$)"
                  icon={Payments}
                  type="number"
                  min="0"
                  step="0.01"
                  value={userData.hourlyRate}
                  onChange={(e) => setUserData({ ...userData, hourlyRate: e.target.value })}
                  placeholder="Ex.: 150"
                />

                <Field
                  as="select"
                  label="Conselho profissional"
                  icon={Badge}
                  value={userData.council}
                  onChange={(e) => setUserData({ ...userData, council: e.target.value })}
                >
                  <option value="">Selecione…</option>
                  {COUNCILS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Field>

                <Field
                  label="Registro profissional (COREN, CRP, etc.)"
                  icon={Badge}
                  type="text"
                  value={userData.registerNumber}
                  onChange={(e) => setUserData({ ...userData, registerNumber: e.target.value })}
                  placeholder="Número do conselho"
                  error={fieldErrors.registerNumber}
                />

                <Field
                  label="Abordagem (ex.: TCC, home care)"
                  icon={Psychology}
                  type="text"
                  value={userData.approach}
                  onChange={(e) => setUserData({ ...userData, approach: e.target.value })}
                />

                <Field
                  as="textarea"
                  label="Especialidades (separadas por vírgula)"
                  icon={LocalOffer}
                  rows={2}
                  value={userData.specialtiesStr}
                  onChange={(e) => setUserData({ ...userData, specialtiesStr: e.target.value })}
                  placeholder="Idosos, pós-cirúrgico, Alzheimer…"
                />

                <Field
                  as="textarea"
                  label="Descrição longa (opcional)"
                  rows={4}
                  value={userData.description}
                  onChange={(e) => setUserData({ ...userData, description: e.target.value })}
                  placeholder="Currículo, experiência, formação…"
                />
              </>
            )}
```

- [ ] **Step 8: Migrar o bloco cidade/estado**

Substituir o segundo bloco `{!isFamiliar && (<div className="grid ...">...</div>)}` (cidade/estado):

```jsx
            {!isFamiliar && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Cidade"
                  value={userData.city}
                  onChange={(e) => setUserData({ ...userData, city: e.target.value })}
                />
                <Field
                  label="Estado (UF)"
                  value={userData.state}
                  onChange={(e) => setUserData({ ...userData, state: e.target.value })}
                  maxLength={2}
                  placeholder="PE"
                />
              </div>
            )}
```

(este bloco ainda vai mudar de novo na Task 11 — aqui é só a migração pro `Field`, mantendo texto livre pro estado.)

- [ ] **Step 9: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/Perfil/Perfil.test.jsx`
Expected: PASS (3 testes)

- [ ] **Step 10: Rodar a suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS (sem regressão nas demais páginas)

- [ ] **Step 11: Commit**

```bash
git add frontend/src/pages/Perfil/index.jsx frontend/src/pages/Perfil/Perfil.test.jsx
git commit -m "feat(perfil): migra formulário pro Field do design system + erro inline [FE-11]"
```

---

### Task 11: Frontend — Perfil: UF como select + CEP com autopreenchimento ViaCEP [FE-01/FE-02]

**Files:**
- Modify: `frontend/src/pages/Perfil/index.jsx`
- Modify: `frontend/src/pages/Perfil/Perfil.test.jsx`

**Interfaces:**
- Consumes: `STATES` (Task 3), `lookupCep` (Task 7), `maskCep` (Task 5).

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar mock do serviço de CEP no topo de `Perfil.test.jsx` (junto dos outros `vi.mock`):

```js
vi.mock('../../services/viacep', () => ({ lookupCep: vi.fn() }))
```

E adicionar o import correspondente perto de `import api from '../../services/api'`:

```js
import { lookupCep } from '../../services/viacep'
```

Adicionar o teste (depois do teste "salva o perfil com sucesso"):

```jsx
  it('autopreenche cidade/estado ao digitar um CEP válido', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    lookupCep.mockResolvedValue({ city: 'Recife', state: 'PE' })
    const user = userEvent.setup()
    renderPerfil()
    const cepInput = await screen.findByLabelText('CEP')
    await user.type(cepInput, '50030230')

    expect(await screen.findByDisplayValue('Recife')).toBeInTheDocument()
    expect(screen.getByLabelText('Estado (UF)')).toHaveValue('PE')
    expect(lookupCep).toHaveBeenCalledWith('50030230')
  })

  it('estado (UF) é um select com as 27 opções', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    renderPerfil()
    const select = await screen.findByLabelText('Estado (UF)')
    expect(select.tagName).toBe('SELECT')
    expect(screen.getByRole('option', { name: 'Pernambuco' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/Perfil/Perfil.test.jsx`
Expected: FAIL (`getByLabelText('CEP')` não existe; "Estado (UF)" ainda é `<input>`, não `<select>`)

- [ ] **Step 3: Adicionar os imports**

Em `frontend/src/pages/Perfil/index.jsx`, adicionar aos imports de ícones (junto de `import Badge from ...`):

```js
import LocationOn from '@mui/icons-material/LocationOn'
```

Adicionar junto dos outros imports de constantes/serviços:

```js
import { STATES } from '../../constants/states'
import { lookupCep } from '../../services/viacep'
import { maskCep } from '../../utils/formatters'
```

- [ ] **Step 4: Adicionar `zipCode` ao estado do formulário**

Em `emptyUserForm()`, adicionar `zipCode: ''` (antes de `city: ''`):

```js
function emptyUserForm() {
  return {
    name: '',
    birthDate: '',
    bio: '',
    email: '',
    role: '',
    profileImage: '',
    hourlyRate: '',
    council: '',
    registerNumber: '',
    approach: '',
    specialtiesStr: '',
    description: '',
    zipCode: '',
    city: '',
    state: '',
  }
}
```

Em `mapUserToForm(user)`, adicionar `zipCode: user.zipCode ?? '',` (antes de `city: user.city ?? '',`):

```js
    specialtiesStr: Array.isArray(user.specialties) ? user.specialties.join(', ') : '',
    description: user.description ?? '',
    zipCode: user.zipCode ?? '',
    city: user.city ?? '',
    state: user.state ?? '',
  }
}
```

- [ ] **Step 5: Adicionar o handler de CEP**

Depois da função `handleUpdate` (antes de `handleCriarSenha`), adicionar:

```js
  async function handleZipCodeChange(e) {
    const masked = maskCep(e.target.value)
    setUserData((prev) => ({ ...prev, zipCode: masked }))
    const digits = masked.replace(/\D/g, '')
    if (digits.length === 8) {
      const result = await lookupCep(digits)
      if (result) {
        setUserData((prev) => ({
          ...prev,
          city: result.city || prev.city,
          state: result.state || prev.state,
        }))
      }
    }
  }
```

- [ ] **Step 6: Substituir o bloco cidade/estado por CEP + cidade + estado (select)**

Substituir o bloco criado na Task 10 Step 8:

```jsx
            {!isFamiliar && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Cidade"
                  value={userData.city}
                  onChange={(e) => setUserData({ ...userData, city: e.target.value })}
                />
                <Field
                  label="Estado (UF)"
                  value={userData.state}
                  onChange={(e) => setUserData({ ...userData, state: e.target.value })}
                  maxLength={2}
                  placeholder="PE"
                />
              </div>
            )}
```

por:

```jsx
            {!isFamiliar && (
              <>
                <Field
                  label="CEP"
                  icon={LocationOn}
                  type="text"
                  inputMode="numeric"
                  value={userData.zipCode}
                  onChange={handleZipCodeChange}
                  maxLength={9}
                  placeholder="00000-000"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Cidade"
                    value={userData.city}
                    onChange={(e) => setUserData({ ...userData, city: e.target.value })}
                  />
                  <Field
                    as="select"
                    label="Estado (UF)"
                    value={userData.state}
                    onChange={(e) => setUserData({ ...userData, state: e.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {STATES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Field>
                </div>
              </>
            )}
```

- [ ] **Step 7: Incluir `zipCode` no payload de `handleUpdate`**

No objeto `payload` (bloco `if (!isFamiliar) {...}` dentro de `handleUpdate`), adicionar `zipCode: userData.zipCode.trim() || null,` junto de `city`/`state`:

```js
        payload = {
          ...basePayload,
          zipCode: userData.zipCode.trim() || null,
          city: userData.city.trim() || null,
          state: userData.state.trim() || null,
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/Perfil/Perfil.test.jsx`
Expected: PASS (5 testes)

- [ ] **Step 9: Rodar a suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/Perfil/index.jsx frontend/src/pages/Perfil/Perfil.test.jsx
git commit -m "feat(perfil): UF como select + CEP com autopreenchimento ViaCEP [FE-01/FE-02]"
```

---

### Task 12: Frontend — Perfil: máscara monetária no valor por hora [FE-03]

**Files:**
- Modify: `frontend/src/pages/Perfil/index.jsx`
- Modify: `frontend/src/pages/Perfil/Perfil.test.jsx`

**Interfaces:**
- Consumes: `maskCurrencyInput`, `parseCurrencyInput` (Task 6).

- [ ] **Step 1: Escrever o teste (falhando)**

Nenhum import novo é necessário em `Perfil.test.jsx` — este teste só interage com a UI já renderizada. Adicionar o teste (depois do teste de UF/select):

```jsx
  it('mostra e envia o valor por hora com máscara de moeda', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    api.put.mockResolvedValue({ data: { user: CUIDADOR } })
    const user = userEvent.setup()
    renderPerfil()
    // toLocaleString('pt-BR', {style:'currency',...}) pode usar espaço normal
    // ou non-breaking space (U+00A0) dependendo do ICU do runtime — normaliza
    // antes de comparar pra não depender de qual dos dois o Node usa.
    const normalize = (v) => v.replace(/\u00A0/g, ' ')
    const hourlyInput = await screen.findByLabelText('Valor por hora (R$)')
    expect(normalize(hourlyInput.value)).toBe('R$ 25,00')

    await user.clear(hourlyInput)
    await user.type(hourlyInput, '3000')
    expect(normalize(hourlyInput.value)).toBe('R$ 30,00')

    await user.click(screen.getByRole('button', { name: /salvar altera/i }))
    await screen.findByText('Perfil atualizado com sucesso!')
    const [, payload] = api.put.mock.calls[0]
    expect(payload.hourlyRate).toBe(30)
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/Perfil/Perfil.test.jsx`
Expected: FAIL (`hourlyInput` hoje é `type="number"` sem máscara — valor inicial é `"25"`, não `"R$ 25,00"`)

- [ ] **Step 3: Importar os helpers de moeda**

Em `frontend/src/pages/Perfil/index.jsx`, na linha de import de `formatters.js` criada na Task 11:

```js
import { maskCep, maskCurrencyInput, parseCurrencyInput } from '../../utils/formatters'
```

- [ ] **Step 4: Atualizar `mapUserToForm` pra guardar o valor já mascarado**

Substituir a linha de `hourlyRate` em `mapUserToForm`:

```js
    hourlyRate: user.hourlyRate != null && user.hourlyRate !== '' ? String(user.hourlyRate) : '',
```

por:

```js
    hourlyRate:
      user.hourlyRate != null && user.hourlyRate !== ''
        ? maskCurrencyInput(String(Math.round(Number(user.hourlyRate) * 100)))
        : '',
```

- [ ] **Step 5: Atualizar o `Field` de valor por hora**

Substituir o `Field` de "Valor por hora (R$)" (criado na Task 10 Step 7):

```jsx
                <Field
                  label="Valor por hora (R$)"
                  icon={Payments}
                  type="number"
                  min="0"
                  step="0.01"
                  value={userData.hourlyRate}
                  onChange={(e) => setUserData({ ...userData, hourlyRate: e.target.value })}
                  placeholder="Ex.: 150"
                />
```

por:

```jsx
                <Field
                  label="Valor por hora (R$)"
                  icon={Payments}
                  type="text"
                  inputMode="numeric"
                  value={userData.hourlyRate}
                  onChange={(e) => setUserData({ ...userData, hourlyRate: maskCurrencyInput(e.target.value) })}
                  placeholder="R$ 0,00"
                />
```

- [ ] **Step 6: Atualizar o payload de `handleUpdate`**

Substituir a linha de `hourlyRate` no objeto `payload`:

```js
          hourlyRate:
            userData.hourlyRate === '' || userData.hourlyRate == null
              ? null
              : Number(String(userData.hourlyRate).replace(',', '.')),
```

por:

```js
          hourlyRate: userData.hourlyRate === '' ? null : Number(parseCurrencyInput(userData.hourlyRate)),
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/Perfil/Perfil.test.jsx`
Expected: PASS (6 testes)

- [ ] **Step 8: Rodar a suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/Perfil/index.jsx frontend/src/pages/Perfil/Perfil.test.jsx
git commit -m "feat(perfil): máscara monetária no valor por hora [FE-03]"
```

---

### Task 13: Frontend — Perfil: especialidades como `TagSelect` [FE-06]

**Files:**
- Modify: `frontend/src/pages/Perfil/index.jsx`
- Modify: `frontend/src/pages/Perfil/Perfil.test.jsx`

**Interfaces:**
- Consumes: `TagSelect` (Task 8), `SPECIALTIES`/`SPECIALTY_VALUES` (Task 4).

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar o teste em `Perfil.test.jsx` (depois do teste de valor por hora):

```jsx
  it('especialidades: mostra os chips e envia como array de values', async () => {
    api.get.mockResolvedValue({ data: { user: { ...CUIDADOR, specialties: ['IDOSOS'] } } })
    api.put.mockResolvedValue({ data: { user: CUIDADOR } })
    const user = userEvent.setup()
    renderPerfil()
    await screen.findByLabelText('Nome completo')

    expect(screen.getByRole('button', { name: 'Idosos' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Diabetes' }))

    await user.click(screen.getByRole('button', { name: /salvar altera/i }))
    await screen.findByText('Perfil atualizado com sucesso!')
    const [, payload] = api.put.mock.calls[0]
    expect(payload.specialties.sort()).toEqual(['DIABETES', 'IDOSOS'])
  })

  it('especialidades gravadas fora da lista fixa (dado legado) não aparecem pré-marcadas', async () => {
    api.get.mockResolvedValue({ data: { user: { ...CUIDADOR, specialties: ['Cuidado com idosos (texto livre antigo)'] } } })
    renderPerfil()
    await screen.findByLabelText('Nome completo')
    const buttons = screen.getAllByRole('button', { pressed: true })
    expect(buttons).toHaveLength(0)
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/Perfil/Perfil.test.jsx`
Expected: FAIL (não existe botão "Idosos" — o campo ainda é o textarea `specialtiesStr`)

- [ ] **Step 3: Importar `TagSelect` e a lista de especialidades**

Em `frontend/src/pages/Perfil/index.jsx`, atualizar o import do design system:

```js
import { Field, Button, Card, Alert, ConfirmDialog, Badge as DSBadge, TagSelect } from '../../components/ui'
```

Adicionar:

```js
import { SPECIALTIES, SPECIALTY_VALUES } from '../../constants/specialties'
```

- [ ] **Step 4: Trocar `specialtiesStr` por `specialties` (array) no estado do formulário**

Em `emptyUserForm()`, trocar `specialtiesStr: '',` por `specialties: [],`.

Em `mapUserToForm(user)`, trocar:

```js
    specialtiesStr: Array.isArray(user.specialties) ? user.specialties.join(', ') : '',
```

por:

```js
    // Especialidades gravadas antes da lista fixa (FE-06) que não batem com
    // nenhum value válido são descartadas do estado editável — o usuário
    // pode re-selecioná-las entre as opções atuais.
    specialties: Array.isArray(user.specialties)
      ? user.specialties.filter((s) => SPECIALTY_VALUES.includes(s))
      : [],
```

- [ ] **Step 5: Trocar o `Field` de especialidades pelo `TagSelect`**

Substituir o `Field` de "Especialidades (separadas por vírgula)" (criado na Task 10 Step 7):

```jsx
                <Field
                  as="textarea"
                  label="Especialidades (separadas por vírgula)"
                  icon={LocalOffer}
                  rows={2}
                  value={userData.specialtiesStr}
                  onChange={(e) => setUserData({ ...userData, specialtiesStr: e.target.value })}
                  placeholder="Idosos, pós-cirúrgico, Alzheimer…"
                />
```

por:

```jsx
                <TagSelect
                  label="Especialidades"
                  options={SPECIALTIES}
                  value={userData.specialties}
                  onChange={(specialties) => setUserData({ ...userData, specialties })}
                  max={12}
                />
```

(o import de `LocalOffer` fica sem uso — remover a linha `import LocalOffer from '@mui/icons-material/LocalOffer'` do topo do arquivo.)

- [ ] **Step 6: Atualizar o payload de `handleUpdate`**

Substituir o cálculo de `specialties` no `handleUpdate` — hoje ele faz o split manual antes de montar `payload`:

```js
      const specialties = userData.specialtiesStr
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
      payload = {
        ...basePayload,
```

por (remove o bloco `const specialties = ...` e usa `userData.specialties` direto):

```js
      payload = {
        ...basePayload,
```

E trocar `specialties,` (no objeto `payload`) por `specialties: userData.specialties,`.

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/Perfil/Perfil.test.jsx`
Expected: PASS (8 testes)

- [ ] **Step 8: Rodar a suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/Perfil/index.jsx frontend/src/pages/Perfil/Perfil.test.jsx
git commit -m "feat(perfil): especialidades como multi-select de lista fixa [FE-06]"
```

---

### Task 14: Frontend — Perfil: contador de caracteres na bio [FE-07]

**Files:**
- Modify: `frontend/src/pages/Perfil/index.jsx`
- Modify: `frontend/src/pages/Perfil/Perfil.test.jsx`

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar o teste em `Perfil.test.jsx`:

```jsx
  it('bio: mostra contador de caracteres e vira erro visual acima de 1900', async () => {
    api.get.mockResolvedValue({ data: { user: CUIDADOR } })
    const user = userEvent.setup()
    renderPerfil()
    const bioInput = await screen.findByLabelText('Bio / Apresentação')
    expect(screen.getByText('9/2000')).toBeInTheDocument() // 'Sobre mim' tem 9 caracteres

    await user.clear(bioInput)
    await user.type(bioInput, 'a'.repeat(1901))
    expect(screen.getByText('1901/2000')).toBeInTheDocument()
    expect(screen.getByText('1901/2000')).toHaveClass('text-red-600')
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/Perfil/Perfil.test.jsx`
Expected: FAIL (não existe texto de contador hoje)

- [ ] **Step 3: Adicionar o cálculo do contador no corpo do componente**

Em `frontend/src/pages/Perfil/index.jsx`, logo depois da linha `const age = calculateAge(userData.birthDate)` (dentro do corpo de `Perfil()`, antes do `return`), adicionar:

```js
  const bioLength = (userData.bio ?? '').length
  const bioOverLimit = bioLength > 1900
```

- [ ] **Step 4: Atualizar o `Field` da bio com `hint`/`error`**

Substituir o `Field` da bio (criado na Task 10 Step 6):

```jsx
            <Field
              as="textarea"
              label="Bio / Apresentação"
              icon={Description}
              rows={4}
              value={userData.bio ?? ''}
              onChange={(e) => setUserData({ ...userData, bio: e.target.value })}
              placeholder="Resumo curto para o feed…"
            />
```

por:

```jsx
            <Field
              as="textarea"
              label="Bio / Apresentação"
              icon={Description}
              rows={4}
              value={userData.bio ?? ''}
              onChange={(e) => setUserData({ ...userData, bio: e.target.value })}
              placeholder="Resumo curto para o feed…"
              hint={bioOverLimit ? undefined : `${bioLength}/2000`}
              error={bioOverLimit ? `${bioLength}/2000` : undefined}
            />
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/Perfil/Perfil.test.jsx`
Expected: PASS (9 testes)

- [ ] **Step 6: Rodar a suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Perfil/index.jsx frontend/src/pages/Perfil/Perfil.test.jsx
git commit -m "feat(perfil): contador de caracteres na bio [FE-07]"
```

---

### Task 15: Frontend — Perfil: integra `ProfileCompleteness` [FE-10]

**Files:**
- Modify: `frontend/src/pages/Perfil/index.jsx`
- Modify: `frontend/src/pages/Perfil/Perfil.test.jsx`

**Interfaces:**
- Consumes: `ProfileCompleteness` (Task 9).

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar o teste em `Perfil.test.jsx`:

```jsx
  it('mostra a barra de perfil incompleto quando faltam campos', async () => {
    api.get.mockResolvedValue({
      data: { user: { ...CUIDADOR, hourlyRate: null, description: '' } },
    })
    renderPerfil()
    await screen.findByLabelText('Nome completo')
    expect(screen.getByText(/perfil \d+% completo/i)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/Perfil/Perfil.test.jsx`
Expected: FAIL (texto "perfil X% completo" não existe na página ainda)

- [ ] **Step 3: Importar o componente**

Em `frontend/src/pages/Perfil/index.jsx`, adicionar junto dos outros imports de componentes:

```js
import ProfileCompleteness from '../../components/ProfileCompleteness'
```

- [ ] **Step 4: Renderizar acima do formulário**

Localizar o bloco do cabeçalho da página:

```jsx
        <div className="animate-fade-up">
          <h1 className="text-3xl font-display font-black text-virla-roxo">Meu Perfil</h1>
          <p className="text-virla-muted text-sm mt-1">Gerencie suas informações pessoais e profissionais</p>
        </div>

        {message.text && (
```

Adicionar `<ProfileCompleteness>` entre os dois blocos:

```jsx
        <div className="animate-fade-up">
          <h1 className="text-3xl font-display font-black text-virla-roxo">Meu Perfil</h1>
          <p className="text-virla-muted text-sm mt-1">Gerencie suas informações pessoais e profissionais</p>
        </div>

        <ProfileCompleteness userData={userData} role={userData.role} />

        {message.text && (
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/Perfil/Perfil.test.jsx`
Expected: PASS (10 testes)

- [ ] **Step 6: Rodar a suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Perfil/index.jsx frontend/src/pages/Perfil/Perfil.test.jsx
git commit -m "feat(perfil): mostra % de perfil completo no topo da página [FE-10]"
```

---

### Task 16: Verificação final da branch

**Files:** nenhum arquivo novo — só validação.

- [ ] **Step 1: Suíte completa do backend**

Run: `cd backend && node --test`
Expected: PASS, 100% (sem regressão na contagem de testes em relação à `main`)

- [ ] **Step 2: Suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS, 100%

- [ ] **Step 3: Build do frontend**

Run: `cd frontend && npm run build`
Expected: build sem erros

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: sem novos erros/warnings introduzidos por este bloco (comparar com o delta reportado no handoff da Fase 1, que era 0)

- [ ] **Step 5: Conferir manualmente no navegador (opcional, mas recomendado antes do PR)**

Rodar `npm run dev` no frontend e no backend, abrir `/perfil` logado como CUIDADOR, e conferir visualmente:
- Barra de % de perfil aparece e muda ao preencher campos.
- CEP autopreenche cidade/estado.
- Estado é um `<select>` com os 27 estados.
- Valor por hora mostra "R$ 0,00" e formata ao digitar.
- Especialidades aparecem como chips clicáveis.
- Bio mostra o contador `x/2000`.
- Erro de conselho/registro aparece embaixo do campo de registro, não só no banner do topo.

- [ ] **Step 6: Atualizar o roadmap**

Em `docs/ROADMAP-melhorias-fabio.md`, marcar como concluídos (ou remover da lista de pendências, seguindo o estilo já usado no documento) os itens: FE-01, FE-02, FE-03, FE-06, FE-07, FE-10, FE-11, SEC-05.

```bash
git add docs/ROADMAP-melhorias-fabio.md
git commit -m "docs(roadmap): marca FE-01/02/03/06/07/10/11 e SEC-05 como concluídos"
```

---

## Fora de escopo

CHAT-03 (que cresceu para incluir CHAT-01 completo — excluir mensagem com janela de tempo — e a feature nova de arquivar/sair de conversa) fica para um spec e plano próprios, por ser um subsistema independente (chat em tempo real via Firestore) — ver a seção "Fora de escopo" do spec.
