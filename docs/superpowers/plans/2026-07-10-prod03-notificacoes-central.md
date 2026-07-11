# PROD-03 — Central de notificações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Central de notificações in-app persistente (sino no header com badge de não-lidas, lista, marcar lida/todas) cobrindo nova mensagem, solicitação assumida e solicitação concluída/cancelada, com entrega em tempo real via socket.io.

**Architecture:** Persistência numa coleção Firestore `notifications` (via `notificationRepository`, padrão de `solicitacaoRepository`). O backend é a **única fonte de criação**: um `notificationService` grava e emite `notification:new` na sala `user:${id}` já existente. Criação disparada do handler de socket `notify_message` (mensagens) e dos controllers de solicitação (assumir/concluir/cancelar). No frontend, um `NotificationProvider` carrega a lista, ouve o socket e expõe estado + ações; um `NotificationBell` no `Menu` renderiza o sino/badge/painel.

**Tech Stack:** Backend Node ESM + Firestore + socket.io, testes `node:test`. Frontend React + Vite + Tailwind + socket.io-client + `sonner`, testes Vitest + @testing-library/react.

## Global Constraints

- Responder e escrever tudo em **pt-BR** (labels, mensagens, comentários).
- Sem dependência npm nova.
- `type` ∈ `['MESSAGE', 'SOLICITACAO_ASSUMIDA', 'SOLICITACAO_CONCLUIDA', 'SOLICITACAO_CANCELADA']` — mesmos valores no backend e no frontend.
- Backend é a única fonte de criação de notificação; entrega em tempo real via evento socket `notification:new` na sala `user:${id}`.
- **Mensagens colapsam** por `(userId, senderId)` enquanto não-lidas (uma linha que incrementa `count`); eventos de status sempre inserem uma linha nova.
- **Toast único de mensagem:** o toast de nova mensagem continua vindo do `receive_message_notify` existente; `notification:new` de `MESSAGE` só atualiza o sino (sem toast). `notification:new` de status **dispara** toast.
- A criação de notificação **nunca** pode quebrar a ação principal (envio de mensagem / assumir / concluir / cancelar): sempre em `try/catch` que loga e segue.
- Consultas Firestore por **um único campo** (`userId`) + filtro/ordenção em memória — sem índice composto (padrão de `solicitacaoRepository`).
- Verificação: backend `node --test` verde, frontend `npx vitest run` verde, `npm run build` OK, `npm run lint` delta 0, sem dep npm nova.
- Commits pt-BR terminando com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File Structure

**Criar (backend):**
- `backend/src/utils/notificationTypes.js` — `NOTIFICATION_TYPES` (fonte de verdade).
- `backend/tests/notificationTypes.test.js`
- `backend/src/repositories/notificationRepository.js` — coleção `notifications`.
- `backend/src/services/notificationService.js` — cria + emite socket.
- `backend/src/schemas/notificationSchemas.js` — params das rotas.
- `backend/tests/notificationSchemas.test.js`
- `backend/src/controllers/notificationController.js`
- `backend/src/routes/notificationRoutes.js`

**Modificar (backend):**
- `backend/server.js` — `app.use(notificationRoutes)` + `app.set('io', io)`.
- `backend/src/events/messageEvents.js` — `notify_message` cria notificação de mensagem.
- `backend/src/controllers/solicitacaoController.js` — assumir/concluir/cancelar criam notificação.

**Criar (frontend):**
- `frontend/src/utils/notificationsReducer.js` — ops puras de lista.
- `frontend/src/utils/notificationsReducer.test.js`
- `frontend/src/utils/notificationsView.js` — `notificationText`/`notificationHref`.
- `frontend/src/utils/notificationsView.test.js`
- `frontend/src/context/NotificationContext.jsx` — provider + `useNotifications`.
- `frontend/src/components/NotificationBell/index.jsx`
- `frontend/src/components/NotificationBell/NotificationBell.test.jsx`

**Modificar (frontend):**
- `frontend/src/AppShell.jsx` — montar `<NotificationProvider>`.
- `frontend/src/components/Menu/index.jsx` — montar `<NotificationBell>` (desktop + mobile).
- `frontend/src/pages/Chat/index.jsx` — marcar a conversa como lida ao abrir.

---

## Task 1: Enum de tipos de notificação (backend)

**Files:**
- Create: `backend/src/utils/notificationTypes.js`
- Test: `backend/tests/notificationTypes.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `NOTIFICATION_TYPES: string[]`. Consumido pelo repository/service (Tasks 2-3) e espelhado no frontend (Task 6).

- [ ] **Step 1: Escrever o teste que falha**

Create `backend/tests/notificationTypes.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { NOTIFICATION_TYPES } from '../src/utils/notificationTypes.js'

test('NOTIFICATION_TYPES tem os 4 tipos esperados, únicos e na ordem', () => {
  assert.deepEqual(NOTIFICATION_TYPES, [
    'MESSAGE',
    'SOLICITACAO_ASSUMIDA',
    'SOLICITACAO_CONCLUIDA',
    'SOLICITACAO_CANCELADA',
  ])
  assert.equal(new Set(NOTIFICATION_TYPES).size, NOTIFICATION_TYPES.length)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/notificationTypes.test.js`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

Create `backend/src/utils/notificationTypes.js`:

```js
/**
 * Tipos de notificação da central (PROD-03). Espelha os valores usados no
 * frontend (frontend/src/utils/notificationsView.js).
 */
export const NOTIFICATION_TYPES = [
  'MESSAGE',
  'SOLICITACAO_ASSUMIDA',
  'SOLICITACAO_CONCLUIDA',
  'SOLICITACAO_CANCELADA',
]
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/notificationTypes.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/notificationTypes.js backend/tests/notificationTypes.test.js
git commit -m "feat(notificacao): enum de tipos de notificação no backend

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: notificationRepository (Firestore)

**Files:**
- Create: `backend/src/repositories/notificationRepository.js`

**Interfaces:**
- Consumes: `db` (`../lib/firestore.js`), `mapDoc`/`mapQuery`/`nowTs` (`./_helpers.js`).
- Produces (funções nomeadas, todas `async` exceto a classe):
  - `create(data) → Promise<notification>` — insere um doc (status ou mensagem).
  - `upsertMessage({ userId, senderId, senderName, preview }) → Promise<notification>` — colapsa por `(userId, senderId)` não-lida.
  - `listByUser(userId, limit = 50) → Promise<notification[]>` — recentes primeiro (`updatedAt` desc).
  - `countUnread(userId) → Promise<number>`.
  - `markRead(id, userId) → Promise<notification>` — lança `NotificationError('NOT_FOUND')` se não for do usuário.
  - `markAllRead(userId) → Promise<void>`.
  - `markConversationRead(userId, senderId) → Promise<void>`.
  - `class NotificationError extends Error` com `code`.
  - Shape do `notification`: `{ id, userId, type, read, solicitacaoId, solicitacaoTitulo, actorId, actorName, senderId, senderName, preview, count, createdAt, updatedAt }` (campos não usados pelo tipo ficam `null`).

> Sem teste unitário novo: Firestore sem emulador na suíte (padrão de `solicitacaoRepository`). Verificação = a suíte backend segue verde após esta task (importabilidade/sintaxe) + revisão do diff.

- [ ] **Step 1: Implementar o repository**

Create `backend/src/repositories/notificationRepository.js`:

```js
import { db } from '../lib/firestore.js'
import { mapDoc, mapQuery, nowTs } from './_helpers.js'

/**
 * notificationRepository — coleção `notifications` no Firestore (PROD-03).
 * Todas as consultas filtram por um único campo (`userId`) e ordenam/filtram
 * em memória, evitando índices compostos (padrão do solicitacaoRepository;
 * volume baixo no MVP).
 */

const col = () => db.collection('notifications')

const byUpdatedAtDesc = (a, b) =>
  (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0)

/** Erro de domínio p/ o controller mapear o status HTTP. `code` ∈ { 'NOT_FOUND' }. */
export class NotificationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'NotificationError'
    this.code = code
  }
}

export async function create(data) {
  const ref = col().doc()
  const now = nowTs()
  await ref.set({
    userId: data.userId,
    type: data.type,
    read: false,
    solicitacaoId: data.solicitacaoId ?? null,
    solicitacaoTitulo: data.solicitacaoTitulo ?? null,
    actorId: data.actorId ?? null,
    actorName: data.actorName ?? null,
    senderId: data.senderId ?? null,
    senderName: data.senderName ?? null,
    preview: data.preview ?? null,
    count: data.count ?? null,
    createdAt: now,
    updatedAt: now,
  })
  return mapDoc(await ref.get())
}

/**
 * Colapsa mensagens: se já existe uma notificação MESSAGE não-lida de
 * (userId, senderId), incrementa `count` e atualiza preview/updatedAt; senão
 * cria uma nova com count 1.
 */
export async function upsertMessage({ userId, senderId, senderName, preview }) {
  const snap = await col().where('userId', '==', userId).get()
  const existing = snap.docs.find((d) => {
    const n = d.data()
    return n.type === 'MESSAGE' && n.senderId === senderId && n.read === false
  })
  if (existing) {
    const prev = existing.data()
    await existing.ref.update({
      count: (prev.count ?? 0) + 1,
      preview: preview ?? prev.preview ?? null,
      senderName: senderName ?? prev.senderName ?? null,
      updatedAt: nowTs(),
    })
    return mapDoc(await existing.ref.get())
  }
  return create({ userId, type: 'MESSAGE', senderId, senderName, preview, count: 1 })
}

/** Notificações do usuário, mais recentes primeiro, limitadas. */
export async function listByUser(userId, limit = 50) {
  const snap = await col().where('userId', '==', userId).get()
  return mapQuery(snap).sort(byUpdatedAtDesc).slice(0, limit)
}

/** Nº de notificações não-lidas do usuário. */
export async function countUnread(userId) {
  const snap = await col().where('userId', '==', userId).get()
  return snap.docs.reduce((acc, d) => acc + (d.data().read === false ? 1 : 0), 0)
}

/** Marca uma notificação como lida (somente se for do próprio usuário). */
export async function markRead(id, userId) {
  const ref = col().doc(id)
  const doc = await ref.get()
  if (!doc.exists || doc.data().userId !== userId) {
    throw new NotificationError('NOT_FOUND', 'Notificação não encontrada.')
  }
  await ref.update({ read: true, updatedAt: nowTs() })
  return mapDoc(await ref.get())
}

/** Marca todas as não-lidas do usuário como lidas. */
export async function markAllRead(userId) {
  const snap = await col().where('userId', '==', userId).get()
  const now = nowTs()
  const batch = db.batch()
  snap.docs.forEach((d) => {
    if (d.data().read === false) batch.update(d.ref, { read: true, updatedAt: now })
  })
  await batch.commit()
}

/** Marca como lidas as notificações MESSAGE não-lidas de uma conversa. */
export async function markConversationRead(userId, senderId) {
  const snap = await col().where('userId', '==', userId).get()
  const now = nowTs()
  const batch = db.batch()
  snap.docs.forEach((d) => {
    const n = d.data()
    if (n.type === 'MESSAGE' && n.senderId === senderId && n.read === false) {
      batch.update(d.ref, { read: true, updatedAt: now })
    }
  })
  await batch.commit()
}
```

- [ ] **Step 2: Verificar importabilidade (suíte segue verde)**

Run: `cd backend && node --test`
Expected: PASS — nenhum teste quebrou (o novo módulo importa sem erro).

- [ ] **Step 3: Commit**

```bash
git add backend/src/repositories/notificationRepository.js
git commit -m "feat(notificacao): repository Firestore com colapso de mensagens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: notificationService + schemas das rotas

**Files:**
- Create: `backend/src/services/notificationService.js`
- Create: `backend/src/schemas/notificationSchemas.js`
- Test: `backend/tests/notificationSchemas.test.js`

**Interfaces:**
- Consumes: `notificationRepository` (Task 2), `objectIdSchema` (`../schemas/paymentSchemas.js`).
- Produces:
  - `notifyMessage(io, { userId, senderId, senderName, preview }) → Promise<notification|null>` — upsert + emit; no-op se `userId` ausente ou `userId === senderId`.
  - `notifySolicitacao(io, { userId, type, solicitacaoId, solicitacaoTitulo, actorId, actorName }) → Promise<notification|null>` — create + emit.
  - `notificationIdParamSchema` (`{ id }`), `senderIdParamSchema` (`{ senderId }`).

- [ ] **Step 1: Escrever o teste dos schemas (falha)**

Create `backend/tests/notificationSchemas.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { notificationIdParamSchema, senderIdParamSchema } from '../src/schemas/notificationSchemas.js'

test('notificationIdParamSchema aceita id válido do Firestore', () => {
  assert.equal(notificationIdParamSchema.safeParse({ id: 'abc123ABC_def-456xy' }).success, true)
})

test('notificationIdParamSchema rejeita id malformado', () => {
  assert.equal(notificationIdParamSchema.safeParse({ id: 'x' }).success, false)
})

test('senderIdParamSchema aceita senderId válido', () => {
  assert.equal(senderIdParamSchema.safeParse({ senderId: 'abc123ABC_def-456xy' }).success, true)
})

test('senderIdParamSchema rejeita senderId malformado', () => {
  assert.equal(senderIdParamSchema.safeParse({ senderId: '!!' }).success, false)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/notificationSchemas.test.js`
Expected: FAIL — módulo de schema inexistente.

- [ ] **Step 3: Implementar os schemas**

Create `backend/src/schemas/notificationSchemas.js`:

```js
import { z } from 'zod'
import { objectIdSchema } from './paymentSchemas.js'

export const notificationIdParamSchema = z.object({ id: objectIdSchema })
export const senderIdParamSchema = z.object({ senderId: objectIdSchema })
```

- [ ] **Step 4: Implementar o service**

Create `backend/src/services/notificationService.js`:

```js
import * as notificationRepo from '../repositories/notificationRepository.js'

/** Emite o evento de tempo real para a sala pessoal do destinatário. */
function emit(io, userId, notification) {
  if (io && notification) io.to(`user:${userId}`).emit('notification:new', notification)
}

/**
 * Notificação de nova mensagem (colapsada por remetente). No-op se não houver
 * destinatário ou se o remetente for o próprio destinatário.
 */
export async function notifyMessage(io, { userId, senderId, senderName, preview }) {
  if (!userId || !senderId || userId === senderId) return null
  const notification = await notificationRepo.upsertMessage({ userId, senderId, senderName, preview })
  emit(io, userId, notification)
  return notification
}

/** Notificação de evento de solicitação (assumida/concluída/cancelada). */
export async function notifySolicitacao(io, { userId, type, solicitacaoId, solicitacaoTitulo, actorId, actorName }) {
  if (!userId) return null
  const notification = await notificationRepo.create({
    userId, type, solicitacaoId, solicitacaoTitulo, actorId, actorName,
  })
  emit(io, userId, notification)
  return notification
}
```

- [ ] **Step 5: Rodar os testes de schema e a suíte**

Run: `cd backend && node --test tests/notificationSchemas.test.js`
Expected: PASS.

Run: `cd backend && node --test`
Expected: PASS — suíte inteira verde (service importa sem erro).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/notificationService.js backend/src/schemas/notificationSchemas.js backend/tests/notificationSchemas.test.js
git commit -m "feat(notificacao): service de criação/emissão + schemas das rotas

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Controller + rotas + montagem no server

**Files:**
- Create: `backend/src/controllers/notificationController.js`
- Create: `backend/src/routes/notificationRoutes.js`
- Modify: `backend/server.js` (`app.use(notificationRoutes)` na lista de rotas ~linha 120; `app.set('io', io)` após a criação do `io` ~linha 195)

**Interfaces:**
- Consumes: `notificationRepository` (Task 2), `notificationSchemas` (Task 3), `checkToken`, `validateZod`.
- Produces (endpoints, todos autenticados por `checkToken`):
  - `GET /notifications` → `{ notifications, unreadCount }`
  - `PATCH /notifications/:id/read` → `{ notification }`
  - `POST /notifications/read-all` → `{ unreadCount: 0 }`
  - `PATCH /notifications/conversation/:senderId/read` → `{ ok: true }`
  - E o `io` acessível aos controllers via `req.app.get('io')` (para a Task 5).

> Sem teste unitário novo dos handlers (Firestore). Verificação = suíte verde + revisão do diff.

- [ ] **Step 1: Implementar o controller**

Create `backend/src/controllers/notificationController.js`:

```js
import * as notificationRepo from '../repositories/notificationRepository.js'
import { logger } from '../lib/logger.js'

/** GET /notifications — lista as notificações do usuário + contagem de não-lidas. */
export const listNotifications = async (req, res) => {
  try {
    const userId = req.userId
    const [notifications, unreadCount] = await Promise.all([
      notificationRepo.listByUser(userId),
      notificationRepo.countUnread(userId),
    ])
    return res.status(200).json({ notifications, unreadCount })
  } catch (err) {
    logger.error('notification:list_failed', { error: err.message, stack: err.stack, userId: req.userId })
    return res.status(500).json({ msg: 'Erro ao buscar notificações.' })
  }
}

/** PATCH /notifications/:id/read — marca uma notificação como lida. */
export const markNotificationRead = async (req, res) => {
  try {
    const updated = await notificationRepo.markRead(req.params.id, req.userId)
    return res.status(200).json({ notification: updated })
  } catch (err) {
    if (err instanceof notificationRepo.NotificationError) {
      return res.status(404).json({ msg: err.message })
    }
    logger.error('notification:mark_read_failed', { error: err.message, stack: err.stack, userId: req.userId })
    return res.status(500).json({ msg: 'Erro ao marcar notificação como lida.' })
  }
}

/** POST /notifications/read-all — marca todas as não-lidas como lidas. */
export const markAllNotificationsRead = async (req, res) => {
  try {
    await notificationRepo.markAllRead(req.userId)
    return res.status(200).json({ unreadCount: 0 })
  } catch (err) {
    logger.error('notification:mark_all_failed', { error: err.message, stack: err.stack, userId: req.userId })
    return res.status(500).json({ msg: 'Erro ao marcar notificações como lidas.' })
  }
}

/** PATCH /notifications/conversation/:senderId/read — zera as mensagens de uma conversa. */
export const markConversationNotificationsRead = async (req, res) => {
  try {
    await notificationRepo.markConversationRead(req.userId, req.params.senderId)
    return res.status(200).json({ ok: true })
  } catch (err) {
    logger.error('notification:mark_conversation_failed', { error: err.message, stack: err.stack, userId: req.userId })
    return res.status(500).json({ msg: 'Erro ao marcar conversa como lida.' })
  }
}
```

- [ ] **Step 2: Implementar as rotas**

Create `backend/src/routes/notificationRoutes.js`:

```js
import express from 'express'
import checkToken from '../middlewares/checkToken.js'
import { validateZod } from '../middlewares/validateZod.js'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  markConversationNotificationsRead,
} from '../controllers/notificationController.js'
import { notificationIdParamSchema, senderIdParamSchema } from '../schemas/notificationSchemas.js'

const router = express.Router()

router.get('/notifications', checkToken, listNotifications)
router.patch(
  '/notifications/:id/read',
  checkToken,
  validateZod(notificationIdParamSchema, 'params'),
  markNotificationRead,
)
router.post('/notifications/read-all', checkToken, markAllNotificationsRead)
router.patch(
  '/notifications/conversation/:senderId/read',
  checkToken,
  validateZod(senderIdParamSchema, 'params'),
  markConversationNotificationsRead,
)

export default router
```

- [ ] **Step 3: Montar no server.js**

Em `backend/server.js`, adicionar o import junto dos outros de rotas (topo do arquivo, perto de `import solicitacaoRoutes ...`):

```js
import notificationRoutes from './src/routes/notificationRoutes.js'
```

Adicionar à lista de rotas (logo após `app.use(solicitacaoRoutes)`):

```js
app.use(solicitacaoRoutes)
app.use(notificationRoutes)
```

E logo após a criação do `io` (`const io = new SocketServer(server, { ... })`, antes de `io.use(socketAuthMiddleware)`), expor o `io` aos controllers HTTP:

```js
// Expõe o io para os controllers HTTP emitirem notificações (req.app.get('io')).
app.set('io', io)
```

- [ ] **Step 4: Verificar (suíte verde)**

Run: `cd backend && node --test`
Expected: PASS — nada quebrou; `server.js` importa as rotas novas sem erro.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/notificationController.js backend/src/routes/notificationRoutes.js backend/server.js
git commit -m "feat(notificacao): rotas + controller da central e io exposto aos controllers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Wire-in (mensagens + solicitações criam notificações)

**Files:**
- Modify: `backend/src/events/messageEvents.js` (handler `notify_message`)
- Modify: `backend/src/controllers/solicitacaoController.js` (`assumirSolicitacao`, `concluirSolicitacao`, `cancelSolicitacao`)

**Interfaces:**
- Consumes: `notificationService` (Task 3), `getUserById` (`../repositories/userRepository.js`), `req.app.get('io')` (Task 4).
- Produces: nada para tasks posteriores.

> Sem teste unitário novo (socket/Firestore). Verificação = suíte verde + revisão do diff. Toda criação em `try/catch` que loga e não quebra a ação principal.

- [ ] **Step 1: Mensagens — `notify_message` cria a notificação**

Em `backend/src/events/messageEvents.js`, adicionar os imports no topo:

```js
import * as notificationService from '../services/notificationService.js'
import { getUserById } from '../repositories/userRepository.js'
import { logger } from '../lib/logger.js'
```

Substituir o handler `socket.on('notify_message', ...)` por (mantém o `receive_message_notify` intacto e acrescenta a persistência):

```js
  socket.on('notify_message', async ({ receiverId, preview, messageId }) => {
    if (!receiverId) return
    io.to(`user:${receiverId}`).emit('receive_message_notify', {
      senderId: userId,
      preview,
      messageId,
    })
    // Persiste a notificação de mensagem (colapsada) sem bloquear o "toque":
    // se falhar, a mensagem (RTDB) e o toast já aconteceram mesmo assim.
    try {
      const sender = await getUserById(userId)
      await notificationService.notifyMessage(io, {
        userId: receiverId,
        senderId: userId,
        senderName: sender?.name ?? null,
        preview,
      })
    } catch (err) {
      logger.error('notification:message_failed', { error: err.message, senderId: userId, receiverId })
    }
  })
```

- [ ] **Step 2: Solicitações — importar o service**

Em `backend/src/controllers/solicitacaoController.js`, adicionar o import (junto dos outros no topo):

```js
import * as notificationService from '../services/notificationService.js'
```

(`getUserById` e `logger` já estão importados neste arquivo.)

- [ ] **Step 3: `assumirSolicitacao` notifica o familiar**

Em `assumirSolicitacao`, após `const updated = await solicitacaoRepo.assumir(id, req.userId)` e antes do `return`, inserir:

```js
    const updated = await solicitacaoRepo.assumir(id, req.userId)
    try {
      const actor = await getUserById(req.userId)
      await notificationService.notifySolicitacao(req.app.get('io'), {
        userId: updated.familiarId,
        type: 'SOLICITACAO_ASSUMIDA',
        solicitacaoId: updated.id,
        solicitacaoTitulo: updated.titulo,
        actorId: req.userId,
        actorName: actor?.name ?? null,
      })
    } catch (err) {
      logger.error('notification:assumir_failed', { error: err.message, userId: req.userId })
    }
    return res.status(200).json({ solicitacao: updated })
```

- [ ] **Step 4: `concluirSolicitacao` notifica o cuidador**

Em `concluirSolicitacao`, após `const updated = await solicitacaoRepo.update(id, { status: 'CONCLUIDA' })` e antes do `return`, inserir (o `solicitacao` já foi buscado acima neste handler e tem `assignedCaregiverId`/`titulo`):

```js
    const updated = await solicitacaoRepo.update(id, { status: 'CONCLUIDA' })
    try {
      const actor = await getUserById(req.userId)
      await notificationService.notifySolicitacao(req.app.get('io'), {
        userId: solicitacao.assignedCaregiverId,
        type: 'SOLICITACAO_CONCLUIDA',
        solicitacaoId: solicitacao.id,
        solicitacaoTitulo: solicitacao.titulo,
        actorId: req.userId,
        actorName: actor?.name ?? null,
      })
    } catch (err) {
      logger.error('notification:concluir_failed', { error: err.message, userId: req.userId })
    }
    return res.status(200).json({ solicitacao: updated })
```

- [ ] **Step 5: `cancelSolicitacao` notifica o cuidador (se houver)**

Em `cancelSolicitacao`, após `const updated = await solicitacaoRepo.update(id, { status: 'CANCELADA' })` e antes do `return`, inserir (só notifica se já havia cuidador designado):

```js
    const updated = await solicitacaoRepo.update(id, { status: 'CANCELADA' })
    if (solicitacao.assignedCaregiverId) {
      try {
        const actor = await getUserById(req.userId)
        await notificationService.notifySolicitacao(req.app.get('io'), {
          userId: solicitacao.assignedCaregiverId,
          type: 'SOLICITACAO_CANCELADA',
          solicitacaoId: solicitacao.id,
          solicitacaoTitulo: solicitacao.titulo,
          actorId: req.userId,
          actorName: actor?.name ?? null,
        })
      } catch (err) {
        logger.error('notification:cancelar_failed', { error: err.message, userId: req.userId })
      }
    }
    return res.status(200).json({ solicitacao: updated })
```

- [ ] **Step 6: Verificar (suíte verde)**

Run: `cd backend && node --test`
Expected: PASS — nada quebrou.

- [ ] **Step 7: Commit**

```bash
git add backend/src/events/messageEvents.js backend/src/controllers/solicitacaoController.js
git commit -m "feat(notificacao): mensagens e eventos de solicitação criam notificações

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Lógica pura do frontend (reducer + view)

**Files:**
- Create: `frontend/src/utils/notificationsReducer.js`
- Test: `frontend/src/utils/notificationsReducer.test.js`
- Create: `frontend/src/utils/notificationsView.js`
- Test: `frontend/src/utils/notificationsView.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - Reducer: `upsertNotification(list, incoming) → list`, `countUnread(list) → number`, `markReadInList(list, id) → list`, `markAllReadInList(list) → list`, `markConversationReadInList(list, senderId) → list`.
  - View: `notificationText(n) → string`, `notificationHref(n) → string`.
- Consumido pelo `NotificationContext` (Task 7) e `NotificationBell` (Task 8).

- [ ] **Step 1: Escrever os testes do reducer (falham)**

Create `frontend/src/utils/notificationsReducer.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  upsertNotification,
  countUnread,
  markReadInList,
  markAllReadInList,
  markConversationReadInList,
} from './notificationsReducer'

const msg = (over = {}) => ({ id: 'm1', type: 'MESSAGE', senderId: 's1', read: false, count: 1, ...over })
const status = (over = {}) => ({ id: 'a1', type: 'SOLICITACAO_ASSUMIDA', read: false, ...over })

describe('upsertNotification', () => {
  it('colapsa mensagem do mesmo remetente não-lida, movendo para o topo', () => {
    const list = [msg({ id: 'm1', count: 1 }), status({ id: 'a1' })]
    const next = upsertNotification(list, msg({ id: 'm2', count: 2 }))
    expect(next).toHaveLength(2)
    expect(next[0]).toMatchObject({ id: 'm2', senderId: 's1', count: 2 })
    expect(next.some((n) => n.id === 'm1')).toBe(false)
  })

  it('prepend quando é mensagem de outro remetente', () => {
    const list = [msg({ id: 'm1', senderId: 's1' })]
    const next = upsertNotification(list, msg({ id: 'm2', senderId: 's2' }))
    expect(next).toHaveLength(2)
    expect(next[0].id).toBe('m2')
  })

  it('não colapsa numa mensagem já lida (cria linha nova no topo)', () => {
    const list = [msg({ id: 'm1', senderId: 's1', read: true })]
    const next = upsertNotification(list, msg({ id: 'm2', senderId: 's1' }))
    expect(next).toHaveLength(2)
    expect(next[0].id).toBe('m2')
  })

  it('sempre prepend para eventos de status', () => {
    const list = [status({ id: 'a1' })]
    const next = upsertNotification(list, status({ id: 'a2', type: 'SOLICITACAO_CONCLUIDA' }))
    expect(next).toHaveLength(2)
    expect(next[0].id).toBe('a2')
  })
})

describe('contagem e marcações', () => {
  it('countUnread conta só as não-lidas', () => {
    expect(countUnread([msg({ read: false }), status({ read: true })])).toBe(1)
  })

  it('markReadInList marca só o id alvo', () => {
    const out = markReadInList([msg({ id: 'm1' }), status({ id: 'a1' })], 'm1')
    expect(out.find((n) => n.id === 'm1').read).toBe(true)
    expect(out.find((n) => n.id === 'a1').read).toBe(false)
  })

  it('markAllReadInList marca todas', () => {
    const out = markAllReadInList([msg({ read: false }), status({ read: false })])
    expect(out.every((n) => n.read)).toBe(true)
  })

  it('markConversationReadInList marca só as MESSAGE do remetente', () => {
    const list = [msg({ id: 'm1', senderId: 's1' }), msg({ id: 'm2', senderId: 's2' }), status({ id: 'a1' })]
    const out = markConversationReadInList(list, 's1')
    expect(out.find((n) => n.id === 'm1').read).toBe(true)
    expect(out.find((n) => n.id === 'm2').read).toBe(false)
    expect(out.find((n) => n.id === 'a1').read).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/utils/notificationsReducer.test.js`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar o reducer**

Create `frontend/src/utils/notificationsReducer.js`:

```js
/**
 * Operações puras sobre a lista de notificações da central (PROD-03).
 * Isoladas do provider para permitir teste sem socket/rede.
 */

/** Insere uma notificação recebida, colapsando MESSAGE não-lida por remetente. */
export function upsertNotification(list, incoming) {
  if (incoming.type === 'MESSAGE') {
    const idx = list.findIndex(
      (n) => n.type === 'MESSAGE' && n.senderId === incoming.senderId && !n.read,
    )
    if (idx !== -1) {
      const next = list.slice()
      next.splice(idx, 1)
      return [incoming, ...next]
    }
  }
  return [incoming, ...list]
}

/** Nº de notificações não-lidas. */
export function countUnread(list) {
  return list.filter((n) => !n.read).length
}

/** Marca a notificação de `id` como lida. */
export function markReadInList(list, id) {
  return list.map((n) => (n.id === id ? { ...n, read: true } : n))
}

/** Marca todas como lidas. */
export function markAllReadInList(list) {
  return list.map((n) => ({ ...n, read: true }))
}

/** Marca como lidas as MESSAGE de um remetente. */
export function markConversationReadInList(list, senderId) {
  return list.map((n) =>
    n.type === 'MESSAGE' && n.senderId === senderId ? { ...n, read: true } : n,
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/utils/notificationsReducer.test.js`
Expected: PASS.

- [ ] **Step 5: Escrever os testes do view (falham)**

Create `frontend/src/utils/notificationsView.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { notificationText, notificationHref } from './notificationsView'

describe('notificationText', () => {
  it('mensagem singular vs plural pelo count', () => {
    expect(notificationText({ type: 'MESSAGE', senderName: 'Ana', count: 1 })).toMatch(/Ana.*nova mensagem/)
    expect(notificationText({ type: 'MESSAGE', senderName: 'Ana', count: 3 })).toMatch(/Ana.*3 novas mensagens/)
  })

  it('eventos de solicitação incluem ator e título', () => {
    expect(notificationText({ type: 'SOLICITACAO_ASSUMIDA', actorName: 'João', solicitacaoTitulo: 'Cuidado' }))
      .toMatch(/João assumiu.*Cuidado/)
    expect(notificationText({ type: 'SOLICITACAO_CONCLUIDA', actorName: 'Maria', solicitacaoTitulo: 'Cuidado' }))
      .toMatch(/Maria concluiu.*Cuidado/)
    expect(notificationText({ type: 'SOLICITACAO_CANCELADA', actorName: 'Maria', solicitacaoTitulo: 'Cuidado' }))
      .toMatch(/Maria cancelou.*Cuidado/)
  })
})

describe('notificationHref', () => {
  it('mensagem aponta pro chat do remetente', () => {
    expect(notificationHref({ type: 'MESSAGE', senderId: 's1' })).toBe('/chat/s1')
  })
  it('assumida vai pra Solicitações do familiar', () => {
    expect(notificationHref({ type: 'SOLICITACAO_ASSUMIDA' })).toBe('/solicitacoes')
  })
  it('concluída/cancelada vão pras Solicitações do cuidador', () => {
    expect(notificationHref({ type: 'SOLICITACAO_CONCLUIDA' })).toBe('/solicitacoes-disponiveis')
    expect(notificationHref({ type: 'SOLICITACAO_CANCELADA' })).toBe('/solicitacoes-disponiveis')
  })
})
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/utils/notificationsView.test.js`
Expected: FAIL.

- [ ] **Step 7: Implementar o view**

Create `frontend/src/utils/notificationsView.js`:

```js
/**
 * Apresentação das notificações (PROD-03): texto exibido e destino ao clicar.
 * `type` espelha backend/src/utils/notificationTypes.js.
 */

/** Texto legível de uma notificação. */
export function notificationText(n) {
  switch (n.type) {
    case 'MESSAGE': {
      const quem = n.senderName ?? 'Alguém'
      const msg = (n.count ?? 1) > 1 ? `${n.count} novas mensagens` : 'nova mensagem'
      return `${quem} — ${msg}`
    }
    case 'SOLICITACAO_ASSUMIDA':
      return `${n.actorName ?? 'Um cuidador'} assumiu "${n.solicitacaoTitulo ?? 'sua solicitação'}"`
    case 'SOLICITACAO_CONCLUIDA':
      return `${n.actorName ?? 'A família'} concluiu "${n.solicitacaoTitulo ?? 'a solicitação'}"`
    case 'SOLICITACAO_CANCELADA':
      return `${n.actorName ?? 'A família'} cancelou "${n.solicitacaoTitulo ?? 'a solicitação'}"`
    default:
      return 'Nova notificação'
  }
}

/** Rota de destino ao clicar na notificação. */
export function notificationHref(n) {
  switch (n.type) {
    case 'MESSAGE':
      return `/chat/${n.senderId}`
    case 'SOLICITACAO_ASSUMIDA':
      return '/solicitacoes'
    case 'SOLICITACAO_CONCLUIDA':
    case 'SOLICITACAO_CANCELADA':
      return '/solicitacoes-disponiveis'
    default:
      return '/home'
  }
}
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/utils/notificationsReducer.test.js src/utils/notificationsView.test.js`
Expected: PASS — ambos os arquivos verdes.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/utils/notificationsReducer.js frontend/src/utils/notificationsReducer.test.js frontend/src/utils/notificationsView.js frontend/src/utils/notificationsView.test.js
git commit -m "feat(notificacao): lógica pura do frontend (reducer + apresentação)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: NotificationContext + montagem no AppShell

**Files:**
- Create: `frontend/src/context/NotificationContext.jsx`
- Modify: `frontend/src/AppShell.jsx` (envolver com `<NotificationProvider>`)

**Interfaces:**
- Consumes: `useAuth` (`./AuthContext`), `useSocketContext` (`./SocketContext`), `api` (`../services/api`), reducer + view (Task 6), `toast` (`sonner`).
- Produces: `NotificationProvider`, `useNotifications() → { notifications, unreadCount, loading, markRead, markAllRead, markConversationRead }`. Consumido por `NotificationBell` (Task 8) e Chat (Task 9).

> Sem teste unitário novo do provider (mocking de socket é pesado e o SocketContext atual também não é testado; a lógica de estado vive no reducer já testado). Verificação = build + suíte verde + manual.

- [ ] **Step 1: Implementar o provider**

Create `frontend/src/context/NotificationContext.jsx`:

```jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import api from '../services/api'
import { useAuth } from './AuthContext'
import { useSocketContext } from './SocketContext'
import {
  upsertNotification,
  countUnread,
  markReadInList,
  markAllReadInList,
  markConversationReadInList,
} from '../utils/notificationsReducer'
import { notificationText } from '../utils/notificationsView'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { profile } = useAuth()
  const { socket } = useSocketContext()
  const userId = profile?.id
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  // Carga inicial ao ter um usuário.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    api
      .get('/notifications')
      .then((res) => { if (!cancelled) setNotifications(res.data.notifications ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  // Tempo real: novas notificações. Mensagem NÃO dispara toast (o
  // receive_message_notify já cobre); status dispara toast.
  useEffect(() => {
    if (!userId) return
    const onNew = (notification) => {
      setNotifications((list) => upsertNotification(list, notification))
      if (notification.type !== 'MESSAGE') {
        toast.info('Nova notificação', { description: notificationText(notification) })
      }
    }
    socket.on('notification:new', onNew)
    return () => socket.off('notification:new', onNew)
  }, [userId, socket])

  const markRead = useCallback(async (id) => {
    setNotifications((list) => markReadInList(list, id))
    try { await api.patch(`/notifications/${id}/read`) } catch { /* estado otimista */ }
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications((list) => markAllReadInList(list))
    try { await api.post('/notifications/read-all') } catch { /* estado otimista */ }
  }, [])

  const markConversationRead = useCallback(async (senderId) => {
    setNotifications((list) => markConversationReadInList(list, senderId))
    try { await api.patch(`/notifications/conversation/${senderId}/read`) } catch { /* estado otimista */ }
  }, [])

  const unreadCount = countUnread(notifications)

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, markRead, markAllRead, markConversationRead }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>')
  return ctx
}
```

- [ ] **Step 2: Montar no AppShell**

Em `frontend/src/AppShell.jsx`, adicionar o import (junto do import de `SocketProvider`):

```jsx
import { NotificationProvider } from './context/NotificationContext'
```

Envolver o conteúdo dentro do `<SocketProvider>` com `<NotificationProvider>`:

```jsx
  return (
    <SocketProvider>
      <NotificationProvider>
        <Toaster position="top-right" richColors />
        <PresenceManager />
        {showMenu && <Menu />}

        <Suspense fallback={<PageFallback />}>
          <RouteErrorBoundary resetKey={location.pathname}>
          <Routes>
            {/* ...rotas inalteradas... */}
          </Routes>
          </RouteErrorBoundary>
        </Suspense>
      </NotificationProvider>
    </SocketProvider>
  )
```

(Não alterar as rotas; apenas aninhar o provider entre `<SocketProvider>` e o conteúdo.)

- [ ] **Step 3: Verificar build + suíte**

Run: `cd frontend && npx vitest run`
Expected: PASS — suíte segue verde (nenhum teste depende do provider ainda).

Run: `cd frontend && npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/context/NotificationContext.jsx frontend/src/AppShell.jsx
git commit -m "feat(notificacao): NotificationProvider (carga, socket, ações)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: NotificationBell + montagem no Menu

**Files:**
- Create: `frontend/src/components/NotificationBell/index.jsx`
- Test: `frontend/src/components/NotificationBell/NotificationBell.test.jsx`
- Modify: `frontend/src/components/Menu/index.jsx` (montar o sino no desktop e no mobile)

**Interfaces:**
- Consumes: `useNotifications` (Task 7), `notificationText`/`notificationHref` (Task 6), `useNavigate`.
- Produces: componente default `NotificationBell`.

- [ ] **Step 1: Escrever o teste do componente (falha)**

Create `frontend/src/components/NotificationBell/NotificationBell.test.jsx`:

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

const ctx = {
  notifications: [],
  unreadCount: 0,
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}
vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ctx,
}))

import NotificationBell from './index'

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  )
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ctx.notifications = []
    ctx.unreadCount = 0
  })

  it('mostra o badge com a contagem de não-lidas', () => {
    ctx.unreadCount = 3
    renderBell()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('não mostra badge quando não há não-lidas', () => {
    ctx.unreadCount = 0
    renderBell()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('ao abrir, lista as notificações e "marcar todas" chama a ação', async () => {
    const user = userEvent.setup({ delay: null })
    ctx.unreadCount = 1
    ctx.notifications = [
      { id: 'a1', type: 'SOLICITACAO_ASSUMIDA', actorName: 'João', solicitacaoTitulo: 'Cuidado', read: false },
    ]
    renderBell()
    await user.click(screen.getByRole('button', { name: /notifica/i }))
    expect(screen.getByText(/João assumiu.*Cuidado/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /marcar todas como lidas/i }))
    expect(ctx.markAllRead).toHaveBeenCalledTimes(1)
  })

  it('clicar numa notificação marca lida e navega', async () => {
    const user = userEvent.setup({ delay: null })
    ctx.unreadCount = 1
    ctx.notifications = [
      { id: 'm1', type: 'MESSAGE', senderId: 's1', senderName: 'Ana', count: 2, read: false },
    ]
    renderBell()
    await user.click(screen.getByRole('button', { name: /notifica/i }))
    await user.click(screen.getByText(/Ana.*2 novas mensagens/))
    expect(ctx.markRead).toHaveBeenCalledWith('m1')
    expect(navigateMock).toHaveBeenCalledWith('/chat/s1')
  })

  it('mostra estado vazio quando não há notificações', async () => {
    const user = userEvent.setup({ delay: null })
    renderBell()
    await user.click(screen.getByRole('button', { name: /notifica/i }))
    expect(screen.getByText(/nenhuma notificação/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/components/NotificationBell/NotificationBell.test.jsx`
Expected: FAIL — componente inexistente.

- [ ] **Step 3: Implementar o componente**

Create `frontend/src/components/NotificationBell/index.jsx`:

```jsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Notifications from '@mui/icons-material/Notifications'
import Chat from '@mui/icons-material/Chat'
import AssignmentTurnedIn from '@mui/icons-material/AssignmentTurnedIn'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Cancel from '@mui/icons-material/Cancel'
import { useNotifications } from '../../context/NotificationContext'
import { notificationText, notificationHref } from '../../utils/notificationsView'

const ICON_BY_TYPE = {
  MESSAGE: Chat,
  SOLICITACAO_ASSUMIDA: AssignmentTurnedIn,
  SOLICITACAO_CONCLUIDA: CheckCircle,
  SOLICITACAO_CANCELADA: Cancel,
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const close = useCallback(() => setOpen(false), [])

  // Fecha ao clicar fora / Esc.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (!rootRef.current?.contains(e.target)) close()
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  function handleClick(n) {
    markRead(n.id)
    close()
    navigate(notificationHref(n))
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
        aria-expanded={open}
        className="relative p-2 rounded-lg text-virla-roxo hover:bg-virla-roxo/10 transition-colors duration-150
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/40"
      >
        <Notifications sx={{ fontSize: 22 }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full
                       bg-red-500 text-white text-[11px] font-bold flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificações"
          className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-2xl bg-white shadow-virla-lg
                     border border-virla-roxomid/40 z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-virla-roxomid/30">
            <span className="font-display font-bold text-virla-roxo text-sm">Notificações</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-virla-muted hover:text-virla-roxo"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-virla-muted">
              Nenhuma notificação por aqui ainda.
            </p>
          ) : (
            <ul className="divide-y divide-virla-roxomid/20">
              {notifications.map((n) => {
                const Icon = ICON_BY_TYPE[n.type] ?? Notifications
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
                        hover:bg-virla-roxo/5 ${n.read ? 'opacity-60' : ''}`}
                    >
                      <Icon sx={{ fontSize: 18 }} className="text-virla-roxo/70 mt-0.5 shrink-0" aria-hidden />
                      <span className="text-sm text-virla-texto">{notificationText(n)}</span>
                      {!n.read && (
                        <span className="ml-auto mt-1.5 w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/components/NotificationBell/NotificationBell.test.jsx`
Expected: PASS — 5 testes verdes.

- [ ] **Step 5: Montar no Menu (desktop + mobile)**

Em `frontend/src/components/Menu/index.jsx`, adicionar o import no topo:

```jsx
import NotificationBell from '../NotificationBell'
```

No bloco de ações do **desktop** (`<div className="hidden md:flex items-center gap-2">`), inserir o sino como primeiro item, antes do link "Avaliar Sistema":

```jsx
          <div className="hidden md:flex items-center gap-2">
            <NotificationBell />
            <a
              href={FEEDBACK_FORM_URL}
```

No **mobile**, o sino deve ficar visível na barra (fora do drawer), imediatamente antes do botão hambúrguer. Envolver o hambúrguer existente com um wrapper que inclua o sino:

```jsx
          {/* ── Ações mobile: sino sempre visível + hambúrguer ────────────── */}
          <div className="flex md:hidden items-center gap-1">
            <NotificationBell />
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={open}
              aria-controls="mobile-menu-drawer"
              className="p-2 rounded-lg text-virla-roxo
                         hover:bg-virla-roxo/10 transition-colors duration-150
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/40"
            >
              {open ? <Close sx={{ fontSize: 24 }} /> : <MenuIcon sx={{ fontSize: 24 }} />}
            </button>
          </div>
```

(Isto substitui o `<button ref={hamburgerRef} ... className="md:hidden ...">` existente: o `md:hidden` sai do botão e vai para o wrapper `flex md:hidden`.)

- [ ] **Step 6: Rodar a suíte inteira do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS — suíte verde (incl. o novo teste do sino).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/NotificationBell/index.jsx frontend/src/components/NotificationBell/NotificationBell.test.jsx frontend/src/components/Menu/index.jsx
git commit -m "feat(notificacao): NotificationBell no header (desktop + mobile)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Integração com o Chat + verificação final

**Files:**
- Modify: `frontend/src/pages/Chat/index.jsx` (marcar a conversa como lida ao abrir)

**Interfaces:**
- Consumes: `useNotifications` (Task 7).
- Produces: nada (task final).

> Sem teste novo obrigatório (o efeito é um side-effect fino; o caminho de marcação já é coberto pelos testes do reducer e do bell). Verificação = suíte + build + lint.

- [ ] **Step 1: Adicionar o import**

Em `frontend/src/pages/Chat/index.jsx`, adicionar o import (junto dos outros de contexto/serviço no topo do arquivo):

```jsx
import { useNotifications } from '../../context/NotificationContext'
```

- [ ] **Step 2: Consumir o hook e marcar a conversa lida ao abrir**

Dentro do componente `Chat`, junto das outras chamadas de hook (perto de `const { userId: peerId } = useParams()`), adicionar:

```jsx
  const { markConversationRead } = useNotifications()
```

O componente já tem um efeito que marca as mensagens como lidas quando `peerId` muda:

```jsx
    if (peerId) {
      api.patch(`/messages/read/${peerId}`).catch(err => console.error("Erro ao marcar lidas", err))
    }
```

Acrescentar, logo após essa linha (dentro do mesmo `if (peerId)`), a marcação da notificação:

```jsx
    if (peerId) {
      api.patch(`/messages/read/${peerId}`).catch(err => console.error("Erro ao marcar lidas", err))
      markConversationRead(peerId)
    }
```

Incluir `markConversationRead` no array de dependências desse `useEffect` (adicionar ao array existente que hoje contém `[peerId]` → `[peerId, markConversationRead]`).

- [ ] **Step 3: Verificação final completa**

Run: `cd backend && node --test`
Expected: PASS — backend verde.

Run: `cd frontend && npx vitest run`
Expected: PASS — frontend verde.

Run: `cd frontend && npm run build`
Expected: build OK.

Run: `cd frontend && npm run lint`
Expected: 0 novos erros/warnings (delta 0 vs. baseline).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Chat/index.jsx
git commit -m "feat(notificacao): Chat zera a notificação da conversa ao abrir

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final (após todas as tasks)

- [ ] `cd backend && node --test` → verde
- [ ] `cd frontend && npx vitest run` → verde
- [ ] `cd frontend && npm run build` → OK
- [ ] `cd frontend && npm run lint` → delta 0
- [ ] Nenhuma dependência npm nova
- [ ] Smoke manual (opcional, requer app rodando): cuidador assume uma solicitação → familiar recebe badge + toast; familiar conclui → cuidador recebe; nova mensagem → sino incrementa sem toast duplo; abrir o chat zera a notificação daquela conversa.
