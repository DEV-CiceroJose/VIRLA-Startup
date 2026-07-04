# Design — Fase 1: Validações de dados

**Data:** 2026-07-03
**Branch:** `fase1-validacoes-dados` (sai de `fase0-validacoes-fixes`)
**Contexto:** segundo bloco de endurecimento de validações do roadmap. Foco em
integridade/segurança dos dados de perfil (registro profissional, nome, valor,
upload).
**Status:** aprovado no brainstorming; pendente de plano.

## Escopo

Bloco 🅐 do roadmap (o bloco 🅑 — UX de formulários — vira a Fase 2):

1. **Registro profissional estruturado** (FE-05 + parte de SEC-04): campo `council`
   (enum) + `registerNumber`, formato por conselho, unicidade do par.
2. **FE-08** — validação de Nome.
3. **FE-04** — Valor por Hora com mín/máx.
4. **FE-09** — endurecer upload de foto.

Itens já concluídos em fases anteriores (fora daqui): SEC-06 (18+), SEC-04 (CPF),
FE-12 (confirmar senha).

---

## 1. Registro profissional estruturado

### Modelo de dados
- Novo campo **`council`** — enum: `COREN`, `CRM`, `CRP`, `CREFITO`, `CREF`, `CRF`.
- Mantém **`registerNumber`** (o número).
- **Remove `crm_crf`** (campo redundante). Pré-lançamento → sem migração de dados;
  apenas alinhar o código (`userSchemas`, `userController`, `userSelects`,
  Cadastro, Perfil, User público).
- Perfil público passa a exibir `council + registerNumber` (ex.: "COREN 123456").

### Regra
- Só faz sentido para `CUIDADOR`.
- **Par obrigatório:** `council` e `registerNumber` andam juntos — enviar um sem o
  outro é 422 ("Informe o conselho e o número do registro."). Ambos ausentes = ok
  (opcional).
- Validado quando presente (formato + unicidade).

### Formato por conselho (pragmático)
Módulo `backend/src/utils/councils.js` com um mapa. Os padrões são **permissivos
o suficiente para não rejeitar registros válidos** (formatos reais variam por
estado) — validam estrutura básica, não exaustividade:

```js
const REGISTER_BASE = /^\d{4,10}([-/][A-Za-z0-9]{1,5})?$/ // dígitos + sufixo opcional (UF/categoria)
export const COUNCILS = {
  COREN:   { label: 'COREN — Enfermagem',      pattern: REGISTER_BASE },
  CRM:     { label: 'CRM — Medicina',          pattern: REGISTER_BASE },
  CRP:     { label: 'CRP — Psicologia',        pattern: /^\d{2}[-/]\d{3,7}$/ }, // região/número (ex.: 06/12345)
  CREFITO: { label: 'CREFITO — Fisio/TO',      pattern: REGISTER_BASE },
  CREF:    { label: 'CREF — Educação Física',  pattern: REGISTER_BASE },
  CRF:     { label: 'CRF — Farmácia',          pattern: REGISTER_BASE },
}
export const COUNCIL_VALUES = Object.keys(COUNCILS)
export function isValidCouncil(v) { return v in COUNCILS }
export function isValidRegister(council, number) {
  const c = COUNCILS[council]
  if (!c) return false
  return c.pattern.test(String(number ?? '').trim())
}
```

Frontend espelha os valores/labels em `frontend/src/constants/councils.js` (só a
lista para o `<select>` — os valores do enum devem bater com o backend).

### Backend
- `userSchemas`: `council: councilSchema.optional().nullable()` (enum via
  `isValidCouncil`); remover `crm_crf`. Validação do par + formato via
  **`.superRefine`** no objeto (create e update): se um dos dois vier, o outro é
  obrigatório e `isValidRegister(council, registerNumber)` deve passar.
- `userRepository`: `registerExists(council, registerNumber, exceptId = null)` —
  query `where('council','==',c).where('registerNumber','==',n)`, ignora `exceptId`.
- `userController` (`createUsers`/`updateUsers`): se `council`/`registerNumber`
  presentes e `await registerExists(...)` → **409** ("Este registro profissional
  já está cadastrado."). Gravar `council` no doc; parar de gravar `crm_crf`.
- `userSelects`: trocar `crm_crf: true` por `council: true` (mantém `registerNumber`).

### Frontend
- **Cadastro** (só CUIDADOR): substituir o `<Field>` de `crm_crf` por um
  `<select>` de Conselho + o campo de número; enviar `council` + `registerNumber`
  no payload (ou nenhum).
- **Perfil**: adicionar o `<select>` de Conselho ao lado do campo de número já
  existente; enviar os dois.
- **User (perfil público)**: exibir `council + registerNumber` no lugar de
  `crm_crf || registerNumber`.

---

## 2. FE-08 — Validação de Nome

Util `backend/src/utils/name.js`:

```js
export function isValidName(value) {
  const name = String(value ?? '').trim()
  if (name.length < 2) return false
  // letras (com acento), espaço, ponto, hífen e apóstrofo
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) return false
  // rejeita "AAAA"/"aaaa" (mesma letra repetida, ignorando separadores)
  const letters = name.replace(/[^\p{L}]/gu, '')
  if (/^(.)\1+$/u.test(letters)) return false
  return true
}
```

- **Schema:** `name` no `createUserBodySchema` e `updateUserBodySchema` ganha
  `.refine(isValidName, { message: 'Informe um nome válido (apenas letras).' })`.
- **Frontend (Cadastro):** checagem leve antes de submeter (mesma ideia do CPF) —
  o backend é a fonte de verdade.
- Aceita nomes compostos/acentos ("Maria de Fátima", "D'Ávila", "Ana-Clara");
  rejeita dígitos, símbolos, "123456", "AAAAAAAAAA".

---

## 3. FE-04 — Valor por Hora (mín–máx)

- **Backend:** `hourlyRateSchema` valida decimal entre **10 e 500**:
  ```js
  export const hourlyRateSchema = z.union([z.number(), z.string()]).refine((v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= 10 && n <= 500
  }, { message: 'Valor por hora deve estar entre R$ 10 e R$ 500.' })
  ```
  Usado como `hourlyRateSchema.optional().nullable()` no create e update. Strings
  vazias / null / ausência = "não informado" (o pré-processamento trata `''`
  como ausente para não disparar 422 indevido). O `parseHourlyRate` do controller
  continua fazendo a conversão para gravar.
- **Frontend:** input aceita só decimal (a máscara visual R$ é FE-03 → Fase 2).

---

## 4. FE-09 — Upload de foto

- **Frontend `ProfileImageUpload`:** `ACCEPT = 'image/jpeg,image/png,image/webp'`
  (remove GIF); rejeitar arquivo > **5 MB** (`5 * 1024 * 1024`) com mensagem clara;
  manter a checagem `type.startsWith('image/')` como reforço.
- **Backend `profileImageSchema`:** aumentar o limite do data URL base64 de
  `3_000_000` para `7_500_000` (≈ 5 MB de imagem em base64) e apertar o prefixo
  aceito para `data:image/(jpeg|png|webp)`.

---

## 5. Testes

- **Backend (`node:test`):**
  - `councils.js`: `isValidCouncil` (válido/ inválido); `isValidRegister` por
    conselho (COREN/CRM aceitam "123456", "123456-SP"; CRP aceita "06/12345";
    rejeitam lixo/vazio).
  - `userSchemas`: par (council sem número → 422; número sem council → 422; par
    válido → ok; ambos ausentes → ok); `name` (compostos/acentos ok; dígitos,
    símbolos, "AAAA", "123456" → 422); `hourlyRate` (10–500 ok; 5 e 900 → 422;
    "abc" → 422; ausente → ok); `profileImageSchema` (novo limite; prefixo).
  - `userRepository`: `registerExists` (documentar como os demais repos — sem
    teste unitário, verificação via controller/manual).
- **Frontend (`vitest`):** Cadastro/Perfil renderizam o `<select>` de conselho;
  `ProfileImageUpload` rejeita GIF e arquivo > 5 MB.

---

## Fora de escopo (Fase 2)

Bloco 🅑 — UX de formulários: FE-01 (UF select), FE-03 (máscara R$), FE-06 (tags
de especialidades), FE-07 (contador Bio), FE-11 (destaque de obrigatórios),
FE-10 (% de perfil completo), FE-02 (CEP autofill).
