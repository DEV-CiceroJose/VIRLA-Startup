# Virla — Documentação da Sessão de Desenvolvimento

> Resumo técnico completo de tudo que foi planejado, implementado e corrigido
> nesta sessão, na ordem em que aconteceu. Serve como changelog detalhado e
> como referência para quem for revisar/continuar o trabalho.

---

## Índice

1. [Roadmap original (6 sprints)](#1-roadmap-original-6-sprints)
2. [Sprint 2 — Avaliação do sistema](#2-sprint-2--avaliação-do-sistema)
3. [Sprint 3 — Solicitações (Familiar)](#3-sprint-3--solicitações-familiar)
4. [Sprint 4 — Solicitações (Cuidador)](#4-sprint-4--solicitações-cuidador)
5. [Sprint 5 — Refinamentos de UX](#5-sprint-5--refinamentos-de-ux)
6. [Sprint 6 — Flag do botão de pagamento](#6-sprint-6--flag-do-botão-de-pagamento)
7. [Correção: 404 nas rotas de Solicitação](#7-correção-404-nas-rotas-de-solicitação)
8. [Revisão geral pós-correção](#8-revisão-geral-pós-correção)
9. [Chat: análise Firebase Realtime DB vs Socket.io](#9-chat-análise-firebase-realtime-db-vs-socketio)
10. [Lista de melhorias por prioridade](#10-lista-de-melhorias-por-prioridade)
11. [Implementação dos itens 1, 2 e 5](#11-implementação-dos-itens-1-2-e-5)
12. [Correção: tela branca em /solicitacoes](#12-correção-tela-branca-em-solicitacoes)
13. [Pendências em aberto](#13-pendências-em-aberto)
14. [Mapa de arquivos alterados/criados](#14-mapa-de-arquivos-alteradoscriados)

---

## 1. Roadmap original (6 sprints)

Plano definido no início, priorizando problemas técnicos antes de remover o
botão de pagamento (deixado por último, como pedido):

1. Correção do Chat em Produção
2. Sistema de Avaliação dos Usuários
3. Reestruturação do Fluxo Familiar → Solicitações
4. Reestruturação da Área do Cuidador
5. Ajustes de UX e Refinamentos
6. Controle do Botão de Pagamento

O **Sprint 1** acabou não sendo necessário como planejado originalmente:
descobriu-se que o projeto já havia migrado o chat para Firebase Realtime
Database num "Sprint 0" anterior (ver [seção 9](#9-chat-análise-firebase-realtime-db-vs-socketio)).

---

## 2. Sprint 2 — Avaliação do sistema

**Objetivo:** botão para o usuário avaliar a plataforma.

- Botão **"Avaliar Sistema"** (ícone de estrela) adicionado à navbar
  desktop e ao menu mobile, abrindo formulário externo em nova aba.
- Aviso discreto no menu mobile: *"Sua opinião nos ajuda a melhorar o
  Virla 💜"*.
- Link configurado como constante isolada para fácil substituição:
  ```js
  // frontend/src/components/Menu/index.jsx
  const FEEDBACK_FORM_URL = 'https://forms.gle/SEU-LINK-AQUI'
  ```

**Arquivo alterado:** `frontend/src/components/Menu/index.jsx`

---

## 3. Sprint 3 — Solicitações (Familiar)

**Objetivo:** transformar "Solicitação" na entidade central do sistema,
substituindo a navegação direta por perfis.

### Backend
- **Prisma schema** (`backend/prisma/schema.prisma`): novo model `Solicitacao`
  + enums `SolicitacaoStatus` (`ABERTA → VISUALIZADA → EM_ANDAMENTO →
  CONCLUIDA/CANCELADA`) e `SolicitacaoUrgencia` (`BAIXA/MEDIA/ALTA`).
  Campos `viewedByIds` e `assignedCaregiverId` já previstos para o Sprint 4.
- **`solicitacaoSchemas.js`** — validação Zod do corpo da requisição.
- **`solicitacaoController.js`** — `createSolicitacao`, `listMySolicitacoes`,
  `getSolicitacao`, `cancelSolicitacao` (+ funções do Sprint 4 já deixadas
  prontas).
- **`solicitacaoRoutes.js`** — rotas protegidas por `checkToken` +
  `requireRole('FAMILIAR')`, registradas em `server.js`.

### Frontend
- Nova página `pages/Solicitacoes/index.jsx`: lista das próprias
  solicitações + formulário de criação (título, descrição, tipo de
  cuidado, cidade/UF, urgência) + cancelamento com confirmação.
- Rota `/solicitacoes` protegida, registrada em `AppShell.jsx`.
- Aba **"Solicitações"** no menu, visível só para `FAMILIAR`.

---

## 4. Sprint 4 — Solicitações (Cuidador)

**Objetivo:** cuidador passa a navegar exclusivamente por solicitações, sem
acesso direto a perfis de familiares.

### Backend
- `GET /users/:id/feed` restrito a `requireRole('FAMILIAR')` — cuidador não
  pagina mais perfis de familiar.
- `getUserById` (`authController.js`): cuidador tentando abrir perfil de
  familiar diretamente recebe **403** — "Acesse este familiar através de
  uma Solicitação."
- Novas funções no controller: `listAvailableSolicitacoes` (`GET
  /solicitacoes/disponiveis`) e `markSolicitacaoViewed` (`PUT
  /solicitacoes/:id/visualizar`).

### Frontend
- Nova página `pages/SolicitacoesCuidador/index.jsx`: abas **"Disponíveis"**
  e **"Visualizadas"**. Abrir uma solicitação marca como visualizada e
  revela o nome da família **só depois disso** (nunca antes).
- Botão **"Conversar com a família"** abre o chat — é o único lugar onde o
  cuidador descobre quem é a família.
- `/feed` ganhou um guard (`FeedRoute`): cuidador é redirecionado
  automaticamente para `/solicitacoes-disponiveis`.
- Menu por papel: **Familiar** → Início · Feed · Perfil · Solicitações;
  **Cuidador** → Início · Solicitações · Perfil (sem Feed).

---

## 5. Sprint 5 — Refinamentos de UX

Revisão de navegação, nomenclatura e estados de carregamento/vazios.

**Bug real encontrado e corrigido:** sessões logadas **antes** da introdução
do `meuRole` no `localStorage` perdiam Feed/Perfil/Solicitações do menu (caía
tudo em "Início"). Corrigido com um fallback no `Menu.jsx` que busca o papel
via `GET /users/:id` uma vez e cacheia, caso `meuRole` não exista.

Outros ajustes: padronização do texto "Nova solicitação" em todos os botões;
confirmação de que a ordem das rotas em `solicitacaoRoutes.js` não tem
conflito entre `/minhas`, `/disponiveis` e `/:id`.

---

## 6. Sprint 6 — Flag do botão de pagamento

**Objetivo:** permitir gerar uma build sem nenhum vestígio de
cobrança/pagamento, sem alterar a lógica de pagamento em si.

### Frontend
- `frontend/src/utils/featureFlags.js`:
  ```js
  export const PAYMENT_ENABLED = import.meta.env.VITE_ENABLE_PAYMENT !== 'false'
  ```
- `pages/Chat/index.jsx`: `canGenerateCharge` e `canPay` agora exigem
  `PAYMENT_ENABLED` — esconde botão "Gerar Cobrança", botão "Pagar" e o
  banner de cobrança pendente; também deixa de buscar a cobrança pendente na
  API quando desligado.
- `AppShell.jsx`: `PagamentoRoute`/`PagamentoSucessoRoute` redirecionam para
  `/home` se `PAYMENT_ENABLED === false`, mesmo com acesso direto via URL.

### Backend (defesa em profundidade)
- `middlewares/paymentFlag.js`: `ENABLE_PAYMENT` (padrão `true`); se
  `false`, bloqueia com **403** a criação de cobranças/billing.
- Aplicado em `POST /payments/charge-requests` e `POST /payments/billing`.
  Leituras, escrow e o **webhook do AbacatePay continuam funcionando** —
  não trava pagamentos já em andamento.

### Variáveis de ambiente
```env
# Frontend (.env)
VITE_ENABLE_PAYMENT=true   # ou false

# Backend (.env) — opcional
ENABLE_PAYMENT=true        # ou false
```

---

## 7. Correção: 404 nas rotas de Solicitação

**Causa raiz:** um `VirlaFinal.zip` enviado posteriormente tinha o
**frontend** das Solicitações (inclusive uma versão mais evoluída, com
edição e contador de interessados), mas o **backend nunca recebeu o módulo
de Solicitação** — faltavam o model no Prisma, o controller, o schema Zod e
as rotas. Toda chamada `/solicitacoes/...` batia num backend sem esse
endpoint.

**Diagnóstico:** comparação sistemática de todas as chamadas
`api.<método>(...)` do frontend contra todas as rotas registradas no
backend.

**Correção:**
- Recriado o módulo de Solicitação completo (schema, controller, rotas),
  adaptado ao `lib/prisma.js`/`lib/logger.js` desse backend específico.
- Contrato ajustado para bater 100% com o frontend evoluído:

| Frontend chama | Situação |
|---|---|
| `POST /solicitacoes` | ✅ |
| `GET /solicitacoes/minhas` | ✅ + `_count.interessados` |
| `PUT /solicitacoes/:id` (editar) | ✅ criado (só dono, só se `ABERTA`/`VISUALIZADA`) |
| `PATCH /solicitacoes/:id/cancelar` | ✅ corrigido de `PUT` para `PATCH` |
| `GET /solicitacoes/disponiveis` | ✅ |
| `PUT /solicitacoes/:id/visualizar` | ✅ |

> ⚠️ Depois de aplicar: `npx prisma generate && npx prisma db push`.

---

## 8. Revisão geral pós-correção

Cross-check completo de **todas as 24 chamadas** `api.<método>` do frontend
contra as rotas reais do backend (incluindo `paymentRoutes.js`, que usa a
variável `PaymentRoutes` em vez de `router`). Resultado: todas batem.

**Mais 2 problemas reais corrigidos:**
1. **`Menu.jsx` sem o fallback de `role`** — esse zip específico nunca tinha
   recebido a correção do Sprint 5; reaplicada.
2. **`.env.example` do backend incompleto** — `LOG_DIR` e `METRICS_TOKEN`
   eram usados no código mas não documentados; adicionados com comentários.

---

## 9. Chat: análise Firebase Realtime DB vs Socket.io

**Pedido:** avaliar se vale migrar o chat de Socket.io para Firebase
Realtime Database, já que o Socket.io estava "dando muito problema".

**Descoberta:** essa migração **já tinha sido feita** (documentada em
`docs/sprints/Sprint0-Firebase-Chat.md`, com regras em
`backend/firebase.rules.json`). A arquitetura resultante é híbrida — e essa
é a decisão correta, não uma migração incompleta:

| O quê | Onde mora |
|---|---|
| Conteúdo das mensagens, histórico, conversas | **Firebase Realtime Database** |
| "Digitando…", presença online/offline, toque de notificação | **Socket.io** (sinais leves e descartáveis) |
| Usuários, pagamentos, escrow, solicitações | MongoDB/Prisma |

### Bug crítico encontrado e corrigido
`backend/src/lib/firebase.js` fazia **`process.exit(1)`** se faltasse
qualquer variável `FIREBASE_*`. Esse módulo carrega na inicialização do
servidor (via `messageController`, sempre montado) — então **uma única
variável do Firebase ausente ou mal formatada derrubava o backend inteiro**
(login, pagamentos, solicitações, tudo), não só o chat.

**Correção:** reescrito para degradar graciosamente:
- Se `FIREBASE_CONFIGURED === false` (ou init falhar), `rtdb`/`firebaseAdmin`
  passam a ser um `Proxy` que lança erro claro só quando *usado* — captado
  pelos controllers de mensagem, que respondem `503`.
- O resto da API (login, pagamentos, solicitações) continua funcionando
  normalmente.
- `GET /health` ganhou um campo `chat: "ok" | "degraded"` que **não afeta**
  o status geral — visibilidade rápida sem derrubar o health check.

### Observações registradas (não implementadas, baixo risco)
- Pequeno gap nas Security Rules do RTDB: um usuário autenticado consegue
  criar `members` de uma conversa nova com IDs arbitrários antes da
  primeira mensagem.
- Risco teórico de duplicação de mensagem no fallback Firebase → REST do
  `Chat/index.jsx`, em caso raro de timeout pós-sucesso.

### Documentação gerada
`docs/testes/Regressao-Chat-Producao.md` — checklist de 8 blocos de teste em
produção (texto em tempo real, áudio, sinais via Socket.io, reconexão,
múltiplos dispositivos, resiliência do fix do Firebase, Security Rules,
CORS/multi-navegador) + tabela de "se algo falhar, olhe aqui".

---

## 10. Lista de melhorias por prioridade

### 🔴 Crítico
1. Sem rate limit em `/solicitacoes` (criação) e rotas sensíveis.
2. Sem `helmet` — faltam headers de segurança HTTP básicos.
3. Chat sem criptografia em repouso no Firebase RTDB (decisão consciente
   pendente, dado tratar-se de dados de cuidado de idosos).
4. Gap nas Security Rules do Firebase (member injection).

### 🟡 Médio
5. Fluxo de Solicitação incompleto: `assignedCaregiverId`/`EM_ANDAMENTO`/
   `CONCLUIDA` existiam no schema mas nenhuma rota os setava.
6. Sem paginação em `listMySolicitacoes`/`listAvailableSolicitacoes`.
7. Cobertura de testes desbalanceada (bons testes unitários, zero teste de
   integração de rotas/controllers).
8. Sem CI/CD.
9. Risco teórico de duplicação de mensagem (fallback Firebase → REST).

### 🟢 Verde
10. Padronizar nomenclatura de botões/CTAs.
11. Monitoramento de erros em produção (Sentry).
12. Testes E2E (Playwright/Cypress).
13. README arquitetural único consolidando os docs de sprint.
14. Revisão de acessibilidade (`aria-label`, leitor de tela).

---

## 11. Implementação dos itens 1, 2 e 5

### Item 1 — Rate limiting
Reaproveitado o middleware `rateLimit` já existente (sem dependência nova):
- `POST /solicitacoes`: 10/min por IP.
- `PUT /solicitacoes/:id`, `PATCH .../cancelar`, `PATCH .../concluir`,
  `PUT .../visualizar`, `PATCH .../assumir`: 20/min.
- `POST /payments/charge-requests`, `POST /payments/billing`: 10/min.

### Item 2 — `helmet`
- Instalado via `npm install helmet` (testado o import).
- Aplicado em `server.js`, **antes do CORS**:
  ```js
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // libera /uploads cross-origin
    contentSecurityPolicy: false, // API pura, sem HTML próprio
  }))
  ```

### Item 5 — Fluxo completo de Solicitação
**Backend:**
- `PATCH /solicitacoes/:id/assumir` (CUIDADOR) → status `EM_ANDAMENTO` +
  `assignedCaregiverId`.
- `PATCH /solicitacoes/:id/concluir` (FAMILIAR, dono) → status `CONCLUIDA`.
- `GET /solicitacoes/disponiveis` passou a incluir também as solicitações
  que o próprio cuidador já assumiu (`EM_ANDAMENTO` + `assignedCaregiverId`
  = ele), senão "desapareciam" da tela dele.

**Frontend:**
- `SolicitacoesCuidador`: 3ª aba **"Em andamento"** + botão **"Assumir
  solicitação"** na aba Visualizadas.
- `Solicitacoes` (Familiar): quando `EM_ANDAMENTO`, aparecem **"Conversar
  com o cuidador"** e **"Marcar como concluída"**.

> ⚠️ Depois de aplicar: `npm install` (helmet) e `npx prisma generate`.

---

## 12. Correção: tela branca em `/solicitacoes`

**Erro no console:**
```
Uncaught Error: input is a void element tag and must neither have
`children` nor use `dangerouslySetInnerHTML`.
```

**Causa:** o formulário de criar/editar solicitação usava o componente
`Field` assim:
```jsx
<Field label="Título *">
  <input ... />   {/* ❌ filho de um elemento que já renderiza <input> */}
</Field>
```
Mas `Field.jsx` já renderiza seu próprio `<input>` por padrão e injeta
`children` dentro dele — e `<input>` é um *void element* em HTML, não pode
ter filhos. Esse padrão já vinha em um zip enviado depois, não foi
introduzido nesta sessão.

**Correção:** reescrito para usar a API real do `Field` (props diretas:
`value`, `onChange`, `as="textarea"`/`as="select"`), igual ao que já
funciona em `Cadastro/index.jsx` e `Login/index.jsx`. O bloco de tags de
"Tipo de cuidado" (que não é um input de verdade) saiu do `Field` e passou a
ser um `<label>` + botões avulso. Removido também o import não usado
`FIELD_CLASS`.

**Verificação:** todas as outras páginas (`Cadastro`, `Login`) foram
conferidas e usam `Field` corretamente — era um caso isolado.

---

## 13. Pendências em aberto

- **Crítico #3** — decisão sobre criptografia em repouso do conteúdo do
  chat no Firebase RTDB.
- **Crítico #4** — endurecer Security Rules contra criação arbitrária de
  `members` em conversa nova.
- **Médio #6, #7, #8, #9** — paginação, testes de integração, CI/CD,
  idempotência no fallback de mensagem.
- **Verde #10–#14** — nomenclatura, monitoramento, E2E, README
  arquitetural, acessibilidade.
- Confirmar nas variáveis de ambiente reais (Render ou outro host) que
  todas as `FIREBASE_*` estão presentes e corretamente formatadas (a
  causa mais provável dos problemas antigos do chat).
- Rodar o checklist completo de `docs/testes/Regressao-Chat-Producao.md`
  em produção.

---

## 14. Mapa de arquivos alterados/criados

### Backend
```
backend/
├── prisma/schema.prisma                          # + model Solicitacao, enums
├── server.js                                      # + helmet, + solicitacaoRoutes
├── package.json                                   # + helmet, + scripts prisma:generate/push
├── firebase.rules.json                            # (pré-existente, revisado)
└── src/
    ├── lib/
    │   └── firebase.js                            # reescrito: degradação graciosa
    ├── controllers/
    │   ├── authController.js                      # getUserById: bloqueia cuidador→familiar
    │   ├── observabilityController.js             # /health: + campo "chat"
    │   └── solicitacaoController.js                # NOVO
    ├── middlewares/
    │   └── paymentFlag.js                          # NOVO
    ├── routes/
    │   ├── userRoutes.js                           # feed restrito a FAMILIAR
    │   ├── paymentRoutes.js                        # + flag, + rate limit
    │   └── solicitacaoRoutes.js                    # NOVO
    └── schemas/
        └── solicitacaoSchemas.js                   # NOVO
```

### Frontend
```
frontend/
├── .env.example                                   # + VITE_ENABLE_PAYMENT
└── src/
    ├── AppShell.jsx                                # + rotas /solicitacoes*, guards
    ├── utils/
    │   └── featureFlags.js                          # NOVO
    ├── components/Menu/
    │   └── index.jsx                                # menu por papel + fallback de role
    └── pages/
        ├── Chat/index.jsx                           # respeita PAYMENT_ENABLED
        ├── Home/index.jsx                           # link de fallback por papel
        ├── Solicitacoes/index.jsx                   # NOVO (+ fix do Field)
        └── SolicitacoesCuidador/index.jsx           # NOVO (+ 3ª aba "Em andamento")
```

### Documentação
```
docs/
├── sprints/Sprint0-Firebase-Chat.md                # (pré-existente, referenciado)
└── testes/
    └── Regressao-Chat-Producao.md                  # NOVO
```
