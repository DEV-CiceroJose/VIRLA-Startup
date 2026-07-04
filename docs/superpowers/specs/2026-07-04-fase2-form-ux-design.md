# Fase 2 (bloco A) — UX de formulários (Perfil/Cadastro) + SEC-05 — Design

> Escopo: FE-01, FE-02, FE-03, FE-06, FE-07, FE-10, FE-11, SEC-05 do
> `docs/ROADMAP-melhorias-fabio.md`. CHAT-03 (que cresceu para incluir CHAT-01
> completo + "sair de conversa") foi decomposto para um spec separado —
> ver `docs/superpowers/specs/2026-07-04-chat-features-design.md` (a escrever).

## Contexto

Depois da Fase 1 (validações de dados, PR #3), o próximo bloco natural do
roadmap é o "bloco B" identificado no brainstorm da Fase 1: polimento de UX
nos formulários de Cadastro/Perfil, mais o item de segurança SEC-05
(auditoria de limites `.max()`).

Diagnóstico do estado atual:
- `pages/Cadastro/index.jsx` já usa o componente `Field` do design system,
  com `required` (asterisco já funciona) e validação via `toast`.
- `pages/Perfil/index.jsx` usa `<input>`/`<label>` **cru** (não usa `Field`),
  sem exibição de erro por campo — só um `Alert` genérico no topo da página.
- `city`/`state` só existem hoje no formulário de **Perfil** (Cadastro não
  coleta endereço). FE-01/FE-02 mexem só no Perfil.
- `specialties` é aceito no schema como `z.union([z.string(), z.array(z.string())])`
  **sem limite de tamanho** — é a única lacuna real encontrada na auditoria
  SEC-05 (todos os outros campos `z.string()` do projeto já têm `.max()`).
- Não existe lista de estados (UF) nem integração com ViaCEP no projeto.

## Decisões

1. **FE-02 (CEP):** só adiciona `zipCode` → autopreenche `city`/`state`
   (campos que já existem). Não adiciona bairro/rua.
2. **Onde FE-01/FE-02 aparecem:** só no Perfil. Cadastro continua sem campos
   de endereço.
3. **FE-06 (especialidades):** lista fixa (multi-select por chips), não tags
   livres. Lista aprovada (12 itens): Idosos, Alzheimer/Demência,
   Pós-cirúrgico, Fisioterapia, Cuidados paliativos, Mobilidade reduzida,
   Diabetes, AVC/Derrame, Saúde mental, Crianças com necessidades especiais,
   Acamados, Home care 24h.
4. **FE-10 (% de perfil completo):** só na página Perfil (sem banner em
   outras telas).
5. **SEC-05:** fechado transformando `specialties` num `z.array(z.enum(...))`
   com `.max(12)` — a única lacuna de tamanho/limite encontrada na auditoria.

## Backend / schema

- `backend/src/utils/specialties.js` (novo): exporta `SPECIALTY_VALUES`
  (array de 12 strings), espelhando o padrão de `utils/councils.js`.
- `backend/src/schemas/userSchemas.js`:
  - `specialties`: troca `z.union([z.string(), z.array(z.string())]).optional().nullable()`
    por `z.array(z.enum(SPECIALTY_VALUES)).max(12).optional().nullable()`,
    em `createUserBodySchema` e `updateUserBodySchema`.
  - `zipCode` (novo campo, opcional): `z.string().max(9).optional().nullable()`
    com `.transform()` normalizando pra 8 dígitos (remove `-`), espelhando
    `cpfSchema`. Formato aceito: `\d{5}-?\d{3}`.
- **Privacidade:** `zipCode` entra só em `USER_SELF_SELECT`
  (`backend/src/lib/userSelects.js`), não em `USER_PUBLIC_SELECT`. CEP é
  mais granular que `city`/`state` (que já são públicos) — não expande a
  superfície de dados visíveis a terceiros no feed/perfil público. O CEP
  serve só pra autopreencher `city`/`state` no próprio Perfil.
- Sem outras mudanças de schema — `hourlyRate` já valida 10–500; só o
  frontend ganha máscara visual.
- **Migração de dados:** usuários existentes no Firestore podem ter
  `specialties` como strings livres (pré-enum). O schema de **update**
  passa a rejeitar entradas fora da lista fixa. Isso não quebra o registro
  existente (a leitura do perfil não passa pelo schema de update), mas se o
  usuário salvar o perfil sem antes re-selecionar as tags, os valores antigos
  fora da lista somem silenciosamente da edição. Mitigação: no
  `mapUserToForm` do Perfil, specialties armazenadas que não estejam em
  `SPECIALTY_VALUES` são descartadas do estado editável (não pré-marcadas),
  e isso fica documentado — não é tratado como bug, é o comportamento
  esperado da migração pra lista fixa.

## Frontend

**Novos arquivos:**
- `frontend/src/constants/states.js` — 27 UF (`{ value: 'PE', label: 'Pernambuco' }`, etc.), para o `<select>` do FE-01.
- `frontend/src/constants/specialties.js` — os mesmos 12 valores do backend (`SPECIALTIES`), no padrão de `constants/councils.js`.
- `frontend/src/services/viacep.js` — `lookupCep(cep)`: faz `fetch` em
  `https://viacep.com.br/ws/{cep}/json/`; retorna `{ city, state }` em
  sucesso, ou `null` se `{erro: true}`, resposta inválida, ou falha de rede
  (nunca lança — quem chama decide se avisa o usuário ou ignora
  silenciosamente).
- `frontend/src/components/ui/TagSelect.jsx` — multi-select de chips a
  partir de uma lista fixa de opções. Props: `options` (`{value, label}[]`),
  `value` (`string[]`), `onChange`, `max` (opcional, default sem limite).
  Clique alterna seleção; respeita `max` desabilitando novas seleções ao
  atingir o limite.

**`frontend/src/utils/formatters.js` (adiciona):**
- `maskCep(value)` — máscara `00000-000`, mesmo padrão de `maskCpf`.
- `maskCurrencyInput(digits)` / `parseCurrencyInput(display)` — par de
  helpers pra input controlado de moeda (usuário digita dígitos, exibe
  "R$ 25,00"; `parseCurrencyInput` devolve o número pro estado/payload).

**`pages/Perfil/index.jsx` (principal alvo de mudança):**
- Migra os blocos de `<input>`/`<label>` cru para o componente `Field`
  (nome, e-mail desabilitado, data de nascimento, bio, valor/hora, registro,
  abordagem, descrição, cidade). Isso entrega **FE-11**: asterisco de
  obrigatório é built-in do `Field`, e os erros de validação passam a
  aparecer no campo específico (`error` prop) em vez de só no `Alert`
  genérico do topo — ex.: o erro de par conselho/registro agora ancora em
  "Registro profissional".
- **FE-01:** `state` vira `Field as="select"` com `states.js` (era `<input maxLength={2}>` livre).
- **FE-02:** novo `Field` "CEP" acima de cidade/estado; ao completar 8
  dígitos, chama `lookupCep` e preenche `city`/`state` (usuário ainda pode
  editar depois).
- **FE-03:** `hourlyRate` passa a usar `maskCurrencyInput`/`parseCurrencyInput`.
- **FE-06:** textarea `specialtiesStr` (split por vírgula) é substituída por
  `TagSelect` ligado direto a `specialties` (array), removendo a lógica de
  split/join do `handleUpdate`.
- **FE-07:** `Field` da bio ganha `hint` dinâmico `"{length}/2000"`, vira
  vermelho (`error`) acima de 1900 caracteres (sem bloquear digitação).
- **FE-10:** novo componente `frontend/src/components/ProfileCompleteness.jsx`
  — barra de progresso + lista "faltam: X, Y" acima do formulário. Checklist:
  - CUIDADOR (7 itens): `profileImage`, `bio`, `hourlyRate`, endereço
    (`zipCode` ou `city`+`state`), par `council`+`registerNumber`,
    `specialties` (≥1 item), `description`.
  - FAMILIAR (3 itens): `profileImage`, `bio`, endereço (`city`+`state`).
  - Percentual = itens preenchidos / total do papel.

**Cadastro:** sem mudanças — já usa `Field`/`required`/toast; não coleta
endereço nem especialidades (isso é preenchido depois, no Perfil).

## Testes

- **Backend (`node --test`):**
  - `backend/src/utils/specialties.js` — lista exportada corretamente.
  - `backend/tests/userSchemas.test.js` — casos novos: `zipCode` válido/inválido
    (com/sem hífen); `specialties` aceita valores da lista, rejeita valor
    fora da lista, rejeita array com mais de 12 itens.
- **Frontend (`vitest`):**
  - `formatters.test.js` (novo ou extend): `maskCep`, `maskCurrencyInput`,
    `parseCurrencyInput`.
  - `viacep.test.js` (novo): mock de `fetch` — sucesso, `{erro:true}`, falha
    de rede → todos retornam sem lançar.
  - `TagSelect.test.jsx` (novo): alterna seleção, respeita `max`.
  - `ProfileCompleteness.test.jsx` (novo): percentual correto pros dois papéis.
  - `Perfil` — não há teste hoje para esta página; criar
    `Perfil.test.jsx` cobrindo o fluxo básico de carregar → editar → salvar
    após a migração pro `Field`, garantindo que o round-trip não quebrou.
- **Regressão completa antes do PR:** `node --test` (backend) + `vitest`
  (frontend) + `npm run build`, mesmo padrão de barra das Fases 0/1 (sem
  regressão de contagem de testes, delta de lint = 0).

## Fora de escopo (fica pro spec de chat)

CHAT-03 original (reusar `ConfirmDialog`) descobriu, na investigação, que
"excluir mensagem" e "sair de conversa" não existem no código — a única ação
do trio que existe (cancelar solicitação) já usa `ConfirmDialog`. Construir
essas duas features (a primeira absorve o CHAT-01 da Fase 4 do roadmap,
incluindo lógica de janela de tempo no Firestore; a segunda é uma feature
nova de arquivar/ocultar conversa por usuário) é escopo de backend de chat
em tempo real, um subsistema independente deste bloco de formulários — vai
para um spec e plano próprios.
