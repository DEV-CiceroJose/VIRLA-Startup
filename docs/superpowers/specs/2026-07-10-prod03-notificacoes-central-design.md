# PROD-03 — Central de notificações persistente — Design

> Sistema de notificações in-app com persistência: sino no header com badge de
> não-lidas, lista, marcar como lida/todas lidas, e entrega em tempo real.
> Cobre três famílias de evento: nova mensagem, solicitação assumida, e
> solicitação concluída/cancelada.

## Contexto: o que já existe

- **Chat**: mensagens vivem no **Firebase RTDB** (`chats/{chatId}/messages`),
  sincronizadas via `onChildAdded`. O envio é feito pelo cliente direto no RTDB;
  logo após, o cliente emite `notify_message` no **socket.io**, e o backend
  (`backend/src/events/messageEvents.js`) relaya um `receive_message_notify`
  para a sala `user:${receiverId}`. O `SocketContext` do frontend
  (`frontend/src/context/SocketContext.jsx`) escuta esse evento e dispara
  toast (`sonner`) + som (`playNotificationSound`) + notificação nativa do
  browser (`showBrowserNotification`). **Tudo efêmero — nada é persistido**,
  não há badge nem histórico.
- **Solicitações**: transições de status (`assumir`/`concluir`/`cancelar` em
  `backend/src/controllers/solicitacaoController.js`) **não emitem nenhum
  aviso** hoje.
- **Não existe** coleção nem repositório de notificações.
- Infra disponível: socket.io com salas `user:${id}` (server em
  `backend/server.js`), Firestore (perfis/solicitações via repositories),
  `sonner` (toast), Web Notifications, `userRepository.getUserById`.
- Header/nav: `frontend/src/components/Menu/index.jsx` — `<header>` fixo, com
  área de ações no desktop (Avaliar Sistema / Sair) e barra visível no mobile
  (logo + hambúrguer). O sino entra nessa área, visível **fora** do drawer.

## Decisões (tomadas com o usuário)

1. **Forma:** central de notificações **persistente** (não só toasts efêmeros).
2. **Eventos no MVP** (todos direcionados a **um** destinatário — sem fan-out):
   - **Nova mensagem** (para o destinatário do chat).
   - **Solicitação assumida** → notifica o **familiar** dono.
   - **Solicitação concluída/cancelada** → notifica o **cuidador** que assumiu.
   - **Fora:** "nova solicitação → cuidadores" (fan-out/spam) fica de fora.
3. **Armazenamento + tempo real:** Firestore para persistência (repository, como
   `solicitacao`) + "toque" via socket.io (`notification:new` na sala
   `user:${id}`). O **backend é a única fonte de criação**.
4. **Mensagens colapsadas:** uma linha por conversa `(userId, senderId)` que se
   atualiza (ex.: "Ana — 3 novas mensagens"), não uma linha por mensagem.

## Modelo de dados

Coleção Firestore `notifications`, um documento por notificação:

- `id`: string (id do doc)
- `userId`: string — **destinatário** (quem vê a notificação)
- `type`: `'MESSAGE' | 'SOLICITACAO_ASSUMIDA' | 'SOLICITACAO_CONCLUIDA' | 'SOLICITACAO_CANCELADA'`
- `read`: boolean (default `false`)
- `createdAt`, `updatedAt`: timestamp (via `nowTs()` do `_helpers`)
- Payload por tipo:
  - **MESSAGE**: `senderId`, `senderName`, `preview` (texto curto da última
    mensagem), `count` (nº de mensagens não vistas nesta conversa)
  - **SOLICITACAO_***: `solicitacaoId`, `solicitacaoTitulo`, `actorId`,
    `actorName` (quem assumiu/concluiu/cancelou)

**Colapso (MESSAGE):** ao chegar uma mensagem, procurar uma notificação
`(userId, type='MESSAGE', senderId)` **não-lida**. Se existir → incrementar
`count`, atualizar `preview` e `updatedAt`. Senão → criar com `count: 1`. Ao
marcar a conversa como lida, a notificação vira `read: true`; a próxima mensagem
cria uma linha nova (recomeça em `count: 1`).

**Status:** cada evento de solicitação sempre insere um documento novo (não
colapsa).

## Backend

### Enum/labels compartilhados

`backend/src/utils/notificationTypes.js`:
- `NOTIFICATION_TYPES = ['MESSAGE', 'SOLICITACAO_ASSUMIDA', 'SOLICITACAO_CONCLUIDA', 'SOLICITACAO_CANCELADA']`

### Repository (`backend/src/repositories/notificationRepository.js`)

Coleção `notifications`. Funções:
- `create(data)` — insere um doc (status). Aplica defaults (`read: false`,
  `createdAt/updatedAt`).
- `upsertMessage({ userId, senderId, senderName, preview })` — busca a
  notificação MESSAGE não-lida de `(userId, senderId)`; incrementa `count` e
  atualiza `preview`/`updatedAt`, ou cria com `count: 1`. Retorna o doc
  resultante. Ordenação/filtro composto resolvidos em memória para evitar
  índice composto (padrão do `solicitacaoRepository`).
- `listByUser(userId, limit = 50)` — notificações do usuário, mais recentes
  primeiro (por `updatedAt` desc).
- `countUnread(userId)` — nº de docs com `read: false`.
- `markRead(id, userId)` — marca um doc como lido; ignora se não for do usuário
  (retorna null/erro de domínio `NOT_FOUND` como no `solicitacaoRepository`).
- `markAllRead(userId)` — marca todas as não-lidas do usuário como lidas.
- `markConversationRead(userId, senderId)` — marca como lidas as MESSAGE
  não-lidas de `(userId, senderId)`.

### Service (`backend/src/services/notificationService.js`)

Ponto único de criação. Cada função grava via repository e, em seguida, emite
`notification:new` na sala `user:${userId}` (recebe o `io` do socket.io).
- `notifyMessage(io, { userId, senderId, senderName, preview })` → `upsertMessage` + emit.
- `notifySolicitacao(io, { userId, type, solicitacaoId, solicitacaoTitulo, actorId, actorName })` → `create` + emit.

O payload emitido é o próprio documento resultante (para o frontend
prepend/colapsar sem refetch).

### Wire-in

- **Mensagens:** em `backend/src/events/messageEvents.js`, o handler
  `notify_message` passa a chamar `notificationService.notifyMessage`
  (resolvendo `senderName` via `getUserById(socket.userId)` — autenticado,
  confiável) **além de** continuar emitindo `receive_message_notify` (mantém o
  toast/som/notificação nativa atuais intactos). O `io` já está disponível no
  handler.
- **Solicitações:** em `solicitacaoController.js`:
  - `assumirSolicitacao` → após sucesso, `notifySolicitacao` para
    `existing.familiarId` com `type: 'SOLICITACAO_ASSUMIDA'`, `actor` = cuidador
    (`req.userId`).
  - `concluirSolicitacao` → para `solicitacao.assignedCaregiverId` com
    `type: 'SOLICITACAO_CONCLUIDA'`, `actor` = familiar.
  - `cancelSolicitacao` → se houver `assignedCaregiverId`, para ele com
    `type: 'SOLICITACAO_CANCELADA'`, `actor` = familiar.
  - Acesso ao `io` nos controllers: hoje o `io` é criado em `server.js`
    (`const io = new SocketServer(...)`, ~linha 154) e passado direto aos
    handlers de socket, mas **não** está exposto às rotas HTTP. O plano deve
    adicionar `app.set('io', io)` logo após a criação do `io` em `server.js`;
    os controllers passam a ler `req.app.get('io')`. (O handler de socket
    `notify_message` já recebe `io` como parâmetro — não muda.)

### Rotas (`backend/src/routes/notificationRoutes.js`, autenticadas)

- `GET /notifications` → `{ notifications: [...], unreadCount }`
- `PATCH /notifications/:id/read` → marca uma como lida
- `POST /notifications/read-all` → marca todas como lidas
- `PATCH /notifications/conversation/:senderId/read` → marca a conversa como lida

Schema (`backend/src/schemas/notificationSchemas.js`): `notificationIdParam`
(reusa `objectIdSchema`), `senderIdParam`.

## Frontend

### Serviço/contexto (`frontend/src/context/NotificationContext.jsx`)

Provider montado junto do `SocketProvider` (precisa do socket + do usuário).
Estado: `{ notifications, unreadCount, loading }`. Ações: `markRead(id)`,
`markAllRead()`, `markConversationRead(senderId)`.
- Ao montar (com `userId`): `GET /notifications` popula estado.
- Escuta socket `notification:new`:
  - Se `type === 'MESSAGE'`: faz upsert local por `(senderId)` — se já existe
    linha não-lida daquele sender, substitui (novo `count`/`preview`); senão
    prepend. Recalcula `unreadCount`. **Não** dispara toast (o
    `receive_message_notify` já cobre o toast de mensagem — evita duplicação).
  - Se status: prepend + incrementa badge + dispara `toast.info` com ação de
    navegar.
- `markRead`/`markAllRead`/`markConversationRead`: chamam a API e atualizam o
  estado otimisticamente (marca `read: true`, recalcula badge).

A lógica pura de redução (upsert/colapso, prepend, marcar lida, contagem) é
extraída em funções testáveis (ex.: `frontend/src/utils/notificationsReducer.js`
ou funções puras no próprio módulo), para permitir teste sem socket.

### Componente `NotificationBell` (`frontend/src/components/NotificationBell/`)

Montado no header (`Menu/index.jsx`), na área de ações do desktop e visível na
barra do mobile (fora do drawer). Ícone de sino (`@mui/icons-material`) + badge
com `unreadCount` (esconde se 0). Ao clicar, abre um painel dropdown:
- Lista as notificações (mais recentes primeiro), cada linha com ícone por tipo,
  texto (ex.: "Ana — 3 novas mensagens", "João assumiu 'Cuidado para vó'",
  "Maria concluiu 'Cuidado para vó'"), e tempo relativo.
- Clique numa linha → marca lida + navega (MESSAGE → `/chat/{senderId}`;
  SOLICITACAO_* → `/solicitacoes` para o familiar, `/solicitacoes-disponiveis`
  para o cuidador).
- Botão "Marcar todas como lidas".
- `EmptyState` quando não há notificações.
- Fecha ao clicar fora / Esc (mesmo padrão do drawer do `Menu`).

### Integração com o Chat

Ao abrir `/chat/:id` (`frontend/src/pages/Chat/index.jsx`), chamar
`markConversationRead(peerId)` para zerar a notificação MESSAGE daquela conversa
(mantém o badge honesto mesmo quando o chat é aberto direto, não pelo sino).

## Edge cases & riscos

- **Mensagem não passa pelo backend HTTP** (é escrita no RTDB pelo cliente): a
  persistência da notificação de mensagem acontece no **handler de socket**
  `notify_message`, não numa rota. Se o socket cair, a mensagem ainda é entregue
  (RTDB), mas a notificação persistida pode não ser criada — aceitável no MVP
  (o chat em si não depende dela).
- **`senderName`/`actorName` denormalizados** no doc: evita N lookups ao
  renderizar a lista. Nome vem de `getUserById` no momento da criação (fonte
  autenticada). Se o usuário mudar o nome depois, notificações antigas mantêm o
  nome antigo — aceitável.
- **Toast duplo de mensagem:** evitado deixando o toast de mensagem só no
  `receive_message_notify` existente; `notification:new` de MESSAGE só atualiza
  o sino.
- **Cancelamento sem cuidador:** `cancelSolicitacao` só notifica se houver
  `assignedCaregiverId` (solicitação ainda não assumida → ninguém para avisar).
- **Índices Firestore:** consultas por `userId` + ordenação/contagem resolvidas
  em memória (baixo volume no MVP), como já faz `solicitacaoRepository`.
- **Sem emulador Firestore na suíte:** repository/controller verificados por
  suíte verde + manual; o que é testável de forma pura (schema, labels de tipo,
  reducer do frontend) tem teste.

## Testes

- **Backend**: schema das rotas (`notificationSchemas.test.js`); util de tipos
  (`notificationTypes.test.js` — valores/unicidade). Repository/controller sem
  teste unitário novo (Firestore sem emulador) — verificação por suíte verde.
- **Frontend**: lógica pura do reducer (upsert/colapso de MESSAGE por sender,
  prepend de status, marcar lida, recontagem do badge); render do
  `NotificationBell` (badge mostra a contagem e esconde em 0, lista renderiza os
  tipos, empty state, "marcar todas" chama a ação).

## Verificação

Backend `node --test` verde, frontend `vitest` verde, `npm run build` OK, delta
de lint 0, sem dependência npm nova.

## Fora de escopo

- "Nova solicitação → cuidadores" (fan-out / matching por cidade/especialidade).
- E-mail / push notifications (só in-app).
- Preferências/configurações de notificação.
- Paginação/scroll infinito além do limite recente (50).
- Agrupamento de eventos de status (cada um é uma linha).
