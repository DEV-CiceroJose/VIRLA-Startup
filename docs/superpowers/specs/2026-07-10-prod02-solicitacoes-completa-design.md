# PROD-02 — Solicitação completa (localização, valor, horário, frequência, início) — Design

> Enriquece a solicitação de cuidado com os campos que o roadmap (PROD-02, Fase
> 4) pede. Bloco coeso (form + modelo + card), não precisa decompor.

## Contexto: o que já existe

- Solicitações vivem no **Firestore** (coleção `solicitacoes`, `solicitacaoRepository`).
- Modelo atual: `familiarId, titulo, descricao, tipoCuidado[], cidade, estado,
  urgencia, status, viewedByIds[], assignedCaregiverId, createdAt, updatedAt`.
- **O form** (`frontend/src/pages/Solicitacoes/index.jsx`, componente
  `SolicitacaoForm`, `FORM_EMPTY`) só coleta: **título, descrição, urgência,
  tipoCuidado**. `cidade`/`estado` existem no backend mas o form **não os
  coleta** — o card até tenta exibir `cidade - estado`, que fica sempre vazio.
- POST `/solicitacoes` (criar) e PUT `/solicitacoes/:id` (editar) usam **o mesmo**
  `createSolicitacaoBodySchema`. O controller (`createSolicitacao`/
  `updateSolicitacao`) destructura `{ titulo, descricao, tipoCuidado, cidade,
  estado, urgencia }` e repassa ao repository.
- Reuso disponível: `frontend/src/constants/states.js` (UF select),
  `maskCurrencyInput`/`parseCurrencyInput`/`formatHourly`
  (`utils/formatters.js`), o primitivo `Field`.

## Decisões (tomadas com o usuário)

1. **Valor** = valor/hora oferecido (R$), com a máscara monetária do Perfil.
   Opcional.
2. **Horário** = **turno** (select): Manhã / Tarde / Noite / Integral / A
   combinar. Opcional.
3. **Obrigatoriedade:** **localização (cidade + UF) e data de início são
   obrigatórios**; valor, turno e frequência são opcionais. Título/descrição
   continuam obrigatórios.
4. **"Início não no passado"** é validação **client** (não no schema backend),
   porque POST e PUT compartilham o schema — validar "sem passado" no backend
   travaria a edição de uma solicitação cuja data de início já passou.

## Modelo de dados

Campos novos na solicitação (Firestore, defaults `null`):
- `valorHora`: número (R$/hora) | null — opcional
- `turno`: `'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL' | 'A_COMBINAR'` | null — opcional
- `frequencia`: `'PONTUAL' | 'DIARIA' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL'` | null — opcional
- `dataInicio`: string ISO (data) — **obrigatório**

`cidade` e `estado` passam a ser **obrigatórios** (já existiam como opcionais).

## Backend

### Enums compartilhados

`backend/src/utils/solicitacaoOptions.js` (padrão de `councils`/`specialties`):
- `TURNO_VALUES = ['MANHA', 'TARDE', 'NOITE', 'INTEGRAL', 'A_COMBINAR']`
- `FREQUENCIA_VALUES = ['PONTUAL', 'DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL']`

### Schema (`createSolicitacaoBodySchema`, usado por POST e PUT)

- `cidade`: `z.string().min(1).max(80)` (obrigatório).
- `estado`: `z.string().length(2)` transformado pra maiúsculas (obrigatório). Não
  duplica a lista de UFs no backend — a garantia de UF válida vem do `<select>`
  de `STATES` no front; o backend só exige 2 letras.
- `dataInicio`: `z.string()` refine que é **data válida** (parseável) e presente.
  A regra "≥ hoje" **NÃO** entra aqui (fica no client).
- `valorHora`: `z.union([z.number(), z.string()]).optional().nullable()` refine:
  se presente, número entre **10 e 500** (mesma faixa do valor/hora do cuidador).
- `turno`: `z.enum(TURNO_VALUES).optional().nullable()`.
- `frequencia`: `z.enum(FREQUENCIA_VALUES).optional().nullable()`.
- Campos atuais (titulo/descricao/tipoCuidado/urgencia) inalterados.

### Repository (`create` e `update`)

Gravam os 4 campos novos com default `null`:
`valorHora: data.valorHora ?? null`, `turno: data.turno ?? null`,
`frequencia: data.frequencia ?? null`, `dataInicio: data.dataInicio ?? null`.

### Controller (`createSolicitacao` e `updateSolicitacao`)

Destructuram e repassam os novos campos: `{ ..., valorHora, turno, frequencia,
dataInicio }`. `valorHora` normalizado pra número ou null.

## Frontend

### Constantes

`frontend/src/constants/solicitacaoOptions.js` (espelha o backend):
- `TURNOS = [{ value, label }]` — "Manhã", "Tarde", "Noite", "Integral", "A combinar".
- `FREQUENCIAS = [{ value, label }]` — "Pontual", "Diária", "Semanal", "Quinzenal", "Mensal".

Os `value` batem exatamente com os `*_VALUES` do backend.

### Form (`SolicitacaoForm` em `Solicitacoes/index.jsx`)

`FORM_EMPTY` ganha: `cidade`, `estado`, `dataInicio`, `valorHora`, `turno`,
`frequencia`. Novos controles (primitivo `Field`):
- **Cidade** — `Field` texto, obrigatório.
- **Estado (UF)** — `Field as="select"` populado de `STATES`, obrigatório.
- **Data de início** — `Field type="date"` com `min` = hoje, obrigatório.
- **Valor/hora (R$)** — `Field` texto com `maskCurrencyInput` (onChange) /
  `parseCurrencyInput` (no envio), opcional.
- **Turno** — `Field as="select"` com `TURNOS`, opcional.
- **Frequência** — `Field as="select"` com `FREQUENCIAS`, opcional.

Validação client antes do `api.post`/`put`: cidade, estado e dataInicio
presentes; dataInicio ≥ hoje (só na criação). Ao editar uma solicitação antiga,
o form pré-preenche o que houver; os obrigatórios precisam ser completados.

### Card (`SolicitacaoCard`)

Exibe os campos novos (visível ao familiar e no feed do cuidador) como
linhas/badges: 📍 cidade/UF · 📅 início (data formatada) · ⏰ turno ·
🔁 frequência · 💰 valor/hora (via `formatHourly`). Campo ausente (solicitação
antiga) não renderiza a linha.

## Testes

- **Backend** (`backend/tests/solicitacaoSchemas.test.js`, já existe): rejeita
  sem cidade/estado/dataInicio; rejeita `valorHora` fora de 10–500; rejeita
  `turno`/`frequencia` com enum inválido; aceita dataInicio no passado (a regra
  "sem passado" é client); happy path com todos os campos. Mais um teste trivial
  de valores/unicidade do util `solicitacaoOptions`.
- **Frontend**: paridade das constantes FE↔BE (values iguais aos do backend); o
  form inclui os novos campos no payload enviado e bloqueia sem os obrigatórios;
  o card exibe os campos novos.

## Edge cases & riscos

- **POST e PUT compartilham o schema** → "início ≥ hoje" fica no client, pra não
  travar a edição de solicitações com data já passada.
- **Solicitações antigas** (sem cidade/estado/dataInicio): continuam listando; o
  card omite a linha do campo ausente. Editar uma antiga força completar os
  obrigatórios agora.
- **valorHora**: mascarado na digitação, enviado como número (`parseCurrencyInput`)
  ou `null`; o backend valida a faixa.
- **Retrocompat de leitura**: os cards no feed do cuidador
  (`SolicitacoesCuidador`) também passam a exibir os campos novos quando presentes.

## Verificação

Backend `node --test` verde, frontend `vitest` verde, `npm run build` OK, delta
de lint 0, sem dependência npm nova.

## Fora de escopo

- Faixa de valor (min–max); horário específico (início–fim); geolocalização/mapa;
  CEP/ViaCEP na solicitação (mantém cidade+UF); notificações (é o PROD-03).
