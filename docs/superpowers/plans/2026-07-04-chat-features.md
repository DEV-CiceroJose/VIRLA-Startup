# Chat — Apagar mensagem (CHAT-01) + Sair/arquivar conversa — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o autor apague a própria mensagem dentro de 10 minutos (virando um tombstone "Esta mensagem foi apagada" para os dois usuários) e que qualquer usuário "saia/arquive" uma conversa (some só da sua lista de recentes, reaparece com mensagem nova).

**Architecture:** Ambas as ações passam por endpoints no backend que usam o admin SDK do Firebase (relógio do servidor autoritativo, regras do RTDB inalteradas), espelhando o padrão de `markAsRead`. As funções novas/alteradas do `chatRealtimeService` recebem um parâmetro `db` injetável (default `rtdb`) para serem testáveis com um RTDB falso em memória via `node --test`. No frontend, um novo listener `onChildChanged` no hook `useFirebaseChat` propaga o tombstone (e read-receipts) em tempo real; a página de Chat ganha a lixeira por mensagem + `ConfirmDialog` (apagar) e um botão de header + `ConfirmDialog` (sair). A lógica pura (janela de apagar, merge por id) vive em `frontend/src/utils/chatMessages.js`, testável sem Firebase.

**Tech Stack:** Node.js + Express + Firebase Realtime Database (admin SDK), `node --test` (backend); React 19 + Vite + Firebase Web SDK, Vitest + Testing Library (frontend).

## Global Constraints

- O chat vive no **Firebase Realtime Database (RTDB)**, não no Firestore. Estrutura: `chats/{chatId}/messages/{messageId}` = `{ senderId, receiverId, content, audioUrl, read, createdAt }`; `userChats/{userId}/{chatId}` = `{ peerId, lastMessage, lastMessageAt }`. `chatId = [a,b].sort().join('_')` (helper `chatIdFor`).
- **Apagar = tombstone:** o nó permanece com `{ deleted: true, content: '', audioUrl: null }` (preserva `senderId`/`receiverId`/`createdAt`/`read`). Nunca remove o nó.
- **Janela de apagar = 10 minutos = `600000` ms**, medida contra `createdAt` (epoch ms) pelo **relógio do servidor** no backend.
- **Mecanismo = endpoint backend com admin SDK.** Regras do RTDB (`backend/firebase.rules.json`) ficam **inalteradas** — não editar esse arquivo.
- **Arquivar** seta `userChats/{me}/{chatId}/archived = true` só do lado do próprio usuário; `getConversations` filtra `archived === true`; `touchUserChats` seta `archived: false` nos dois lados (roda em toda mensagem nova → desarquiva/reaparece).
- Ambas as ações reusam `ui/ConfirmDialog` (props: `open`, `title`, `description`, `confirmLabel`, `cancelLabel`, `tone`, `loading`, `onConfirm`, `onCancel`).
- Sem dependência npm nova.
- Texto de UI em pt-BR.
- Barra de verificação final: backend `node --test` 100% verde, frontend `vitest run` 100% verde, `npm run build` OK, delta de lint 0 vs. baseline da main.

---

### Task 1: Backend — `deleteMessage` no chatRealtimeService (+ helper de janela)

**Files:**
- Modify: `backend/src/services/chatRealtimeService.js`
- Create: `backend/tests/helpers/fakeRtdb.js`
- Create: `backend/tests/chatRealtimeService.test.js`

**Interfaces:**
- Produces:
  - `DELETE_WINDOW_MS = 600000` (export const)
  - `isWithinDeleteWindow(createdAt, nowMs = Date.now()) => boolean`
  - `deleteMessage(meId, peerId, messageId, db = rtdb) => Promise<message>` — lança `Error` com `.code` em `'not_found' | 'forbidden' | 'window_expired'`; no sucesso devolve o objeto tombstone.
  - `makeFakeRtdb(seed = {}) => { ref(path) }` (helper de teste) exportado de `backend/tests/helpers/fakeRtdb.js`.

- [ ] **Step 1: Criar o RTDB falso em memória (helper de teste)**

Criar `backend/tests/helpers/fakeRtdb.js`:

```js
/**
 * RTDB falso em memória p/ testar chatRealtimeService sem Firebase real.
 * Suporta só o subconjunto usado pelo serviço: ref(path).get()/set()/update()/push(),
 * e snapshots com exists()/val()/forEach(). update() usa chaves planas.
 */
export function makeFakeRtdb(seed = {}) {
  const store = structuredClone(seed)

  function nodeAt(path, create = false) {
    const keys = path.split('/')
    let node = store
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      if (node[k] == null || typeof node[k] !== 'object') {
        if (!create) return node[k]
        node[k] = {}
      }
      node = node[k]
    }
    return node
  }

  function setAt(path, value) {
    const keys = path.split('/')
    let node = store
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (node[k] == null || typeof node[k] !== 'object') node[k] = {}
      node = node[k]
    }
    node[keys[keys.length - 1]] = value
  }

  function snapshot(value) {
    return {
      exists: () => value != null,
      val: () => value,
      forEach: (cb) => {
        if (value && typeof value === 'object') {
          for (const [key, v] of Object.entries(value)) cb({ key, val: () => v })
        }
      },
    }
  }

  function ref(path) {
    return {
      async get() { return snapshot(nodeAt(path)) },
      async set(value) { setAt(path, value) },
      async update(patch) {
        const target = nodeAt(path, true)
        Object.assign(target, patch)
      },
      push() {
        const key = `msg_${Math.random().toString(36).slice(2, 10)}`
        return { key, async set(value) { setAt(`${path}/${key}`, value) } }
      },
    }
  }

  return { ref, __store: store }
}
```

- [ ] **Step 2: Escrever os testes de `deleteMessage` (falhando)**

Criar `backend/tests/chatRealtimeService.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeFakeRtdb } from './helpers/fakeRtdb.js'
import {
  chatIdFor,
  isWithinDeleteWindow,
  deleteMessage,
} from '../src/services/chatRealtimeService.js'

const NOW = 1_800_000_000_000 // epoch ms fixo p/ os testes

function seedWithMessage(overrides = {}) {
  const meId = 'ana'
  const peerId = 'bob'
  const chatId = chatIdFor(meId, peerId)
  const msg = {
    id: 'm1', senderId: meId, receiverId: peerId,
    content: 'oi', audioUrl: null, read: false, createdAt: NOW, ...overrides,
  }
  const db = makeFakeRtdb({
    chats: { [chatId]: { messages: { m1: msg } } },
    userChats: {
      [meId]: { [chatId]: { peerId, lastMessage: 'oi', lastMessageAt: NOW } },
      [peerId]: { [chatId]: { peerId: meId, lastMessage: 'oi', lastMessageAt: NOW } },
    },
  })
  return { meId, peerId, chatId, db }
}

test('isWithinDeleteWindow: dentro/fora de 10min', () => {
  assert.equal(isWithinDeleteWindow(NOW, NOW), true)
  assert.equal(isWithinDeleteWindow(NOW, NOW + 600_000), true)
  assert.equal(isWithinDeleteWindow(NOW, NOW + 600_001), false)
})

test('deleteMessage: happy path vira tombstone (deleted, content vazio, audio nulo)', async () => {
  const { meId, peerId, chatId, db } = seedWithMessage()
  const res = await deleteMessage(meId, peerId, 'm1', db)
  assert.equal(res.deleted, true)
  const stored = db.__store.chats[chatId].messages.m1
  assert.equal(stored.deleted, true)
  assert.equal(stored.content, '')
  assert.equal(stored.audioUrl, null)
  assert.equal(stored.senderId, meId) // preserva metadados
  assert.equal(stored.createdAt, NOW)
})

test('deleteMessage: rejeita quem não é o autor (forbidden)', async () => {
  const { peerId, meId, db } = seedWithMessage()
  await assert.rejects(
    () => deleteMessage(peerId, meId, 'm1', db), // bob tentando apagar msg da ana
    (e) => e.code === 'forbidden',
  )
})

test('deleteMessage: rejeita fora da janela (window_expired)', async () => {
  const { meId, peerId, chatId, db } = seedWithMessage({ createdAt: Date.now() - 700_000 })
  await assert.rejects(
    () => deleteMessage(meId, peerId, 'm1', db),
    (e) => e.code === 'window_expired',
  )
  // não virou tombstone
  assert.equal(db.__store.chats[chatId].messages.m1.deleted, undefined)
})

test('deleteMessage: mensagem inexistente (not_found)', async () => {
  const { meId, peerId, db } = seedWithMessage()
  await assert.rejects(
    () => deleteMessage(meId, peerId, 'inexistente', db),
    (e) => e.code === 'not_found',
  )
})

test('deleteMessage: se era a última mensagem, atualiza o preview dos dois userChats', async () => {
  const { meId, peerId, chatId, db } = seedWithMessage()
  await deleteMessage(meId, peerId, 'm1', db)
  assert.equal(db.__store.userChats[meId][chatId].lastMessage, '🚫 Mensagem apagada')
  assert.equal(db.__store.userChats[peerId][chatId].lastMessage, '🚫 Mensagem apagada')
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/chatRealtimeService.test.js`
Expected: FAIL (`isWithinDeleteWindow`/`deleteMessage` não exportados)

- [ ] **Step 4: Implementar no serviço**

Em `backend/src/services/chatRealtimeService.js`, adicionar (depois de `chatIdFor`, junto ao topo do módulo):

```js
export const DELETE_WINDOW_MS = 600_000

/** true se a mensagem ainda está dentro da janela de apagar (10 min). */
export function isWithinDeleteWindow(createdAt, nowMs = Date.now()) {
  return nowMs - createdAt <= DELETE_WINDOW_MS
}
```

E adicionar a função (pode ficar depois de `markAsRead`):

```js
/**
 * Apaga (tombstone) a própria mensagem do usuário, se dentro da janela.
 * Lança Error com .code = 'not_found' | 'forbidden' | 'window_expired'.
 * O nó permanece com deleted:true / content:'' / audioUrl:null.
 */
export async function deleteMessage(meId, peerId, messageId, db = rtdb) {
  const chatId = chatIdFor(meId, peerId)
  const msgRef = db.ref(`chats/${chatId}/messages/${messageId}`)
  const snap = await msgRef.get()
  if (!snap.exists()) {
    throw Object.assign(new Error('Mensagem não encontrada.'), { code: 'not_found' })
  }
  const msg = snap.val()
  if (msg.senderId !== meId) {
    throw Object.assign(new Error('Você só pode apagar suas próprias mensagens.'), { code: 'forbidden' })
  }
  if (!isWithinDeleteWindow(msg.createdAt)) {
    throw Object.assign(new Error('O prazo para apagar esta mensagem já passou.'), { code: 'window_expired' })
  }

  await msgRef.update({ deleted: true, content: '', audioUrl: null })

  // Se era a mensagem mais recente do chat, atualiza o preview da lista de conversas.
  const allSnap = await db.ref(`chats/${chatId}/messages`).get()
  let latestId = null
  let latestAt = -1
  allSnap.forEach((child) => {
    const at = child.val().createdAt ?? 0
    if (at > latestAt) { latestAt = at; latestId = child.key }
  })
  if (latestId === messageId) {
    await Promise.all([
      db.ref(`userChats/${meId}/${chatId}`).update({ lastMessage: '🚫 Mensagem apagada' }),
      db.ref(`userChats/${peerId}/${chatId}`).update({ lastMessage: '🚫 Mensagem apagada' }),
    ])
  }

  messageLogger.info('message:deleted', { userId: meId, action: 'delete_message', metadata: { peerId, messageId } })
  return { ...msg, deleted: true, content: '', audioUrl: null }
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/chatRealtimeService.test.js`
Expected: PASS (6 testes)

- [ ] **Step 6: Rodar a suíte completa do backend**

Run: `cd backend && node --test`
Expected: PASS (sem regressão)

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/chatRealtimeService.js backend/tests/helpers/fakeRtdb.js backend/tests/chatRealtimeService.test.js
git commit -m "feat(chat): deleteMessage (tombstone em janela de 10min) no chatRealtimeService [CHAT-01]"
```

---

### Task 2: Backend — arquivar/desarquivar (`setArchived` + filtro + resurface)

**Files:**
- Modify: `backend/src/services/chatRealtimeService.js`
- Modify: `backend/tests/chatRealtimeService.test.js`

**Interfaces:**
- Consumes: `makeFakeRtdb` (Task 1), `chatIdFor`.
- Produces:
  - `setArchived(meId, peerId, archived, db = rtdb) => Promise<void>`
  - `getConversations(meId, db = rtdb)` — agora ignora entradas com `archived === true`.
  - `touchUserChats(chatId, senderId, receiverId, lastMessage, lastMessageAt, db = rtdb)` — agora grava `archived: false` nos dois lados.

- [ ] **Step 1: Escrever os testes (falhando)**

Adicionar ao final de `backend/tests/chatRealtimeService.test.js`:

```js
import { setArchived, getConversations, touchUserChats } from '../src/services/chatRealtimeService.js'

test('setArchived: marca só o lado do próprio usuário', async () => {
  const meId = 'ana', peerId = 'bob'
  const chatId = chatIdFor(meId, peerId)
  const db = makeFakeRtdb({
    userChats: {
      [meId]: { [chatId]: { peerId, lastMessage: 'oi', lastMessageAt: NOW } },
      [peerId]: { [chatId]: { peerId: meId, lastMessage: 'oi', lastMessageAt: NOW } },
    },
  })
  await setArchived(meId, peerId, true, db)
  assert.equal(db.__store.userChats[meId][chatId].archived, true)
  assert.equal(db.__store.userChats[peerId][chatId].archived, undefined) // peer intacto
})

test('getConversations: filtra conversas arquivadas', async () => {
  const meId = 'ana'
  const db = makeFakeRtdb({
    userChats: {
      [meId]: {
        ana_bob: { peerId: 'bob', lastMessage: 'oi', lastMessageAt: NOW, archived: true },
        ana_cid: { peerId: 'cid', lastMessage: 'ola', lastMessageAt: NOW + 1 },
      },
    },
  })
  const convs = await getConversations(meId, db)
  assert.equal(convs.length, 1)
  assert.equal(convs[0].peerId, 'cid')
})

test('touchUserChats: desarquiva os dois lados (resurface com mensagem nova)', async () => {
  const meId = 'ana', peerId = 'bob'
  const chatId = chatIdFor(meId, peerId)
  const db = makeFakeRtdb({
    userChats: {
      [meId]: { [chatId]: { peerId, lastMessage: 'oi', lastMessageAt: NOW, archived: true } },
      [peerId]: { [chatId]: { peerId: meId, lastMessage: 'oi', lastMessageAt: NOW, archived: true } },
    },
  })
  await touchUserChats(chatId, meId, peerId, 'nova', NOW + 5, db)
  assert.equal(db.__store.userChats[meId][chatId].archived, false)
  assert.equal(db.__store.userChats[peerId][chatId].archived, false)
  assert.equal(db.__store.userChats[meId][chatId].lastMessage, 'nova')
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/chatRealtimeService.test.js`
Expected: FAIL (`setArchived` não existe; `getConversations`/`touchUserChats` ainda não aceitam `db` nem filtram/limpam `archived`)

- [ ] **Step 3: Implementar / alterar no serviço**

Em `backend/src/services/chatRealtimeService.js`:

Alterar `touchUserChats` (assinatura + payload):

```js
/** Atualiza o índice de conversas recentes de ambos os participantes. */
async function touchUserChats(chatId, senderId, receiverId, lastMessage, lastMessageAt, db = rtdb) {
  await Promise.all([
    db.ref(`userChats/${senderId}/${chatId}`).update({ peerId: receiverId, lastMessage, lastMessageAt, archived: false }),
    db.ref(`userChats/${receiverId}/${chatId}`).update({ peerId: senderId, lastMessage, lastMessageAt, archived: false }),
  ])
}
```

Alterar `getConversations` (assinatura + filtro):

```js
/** Lista as conversas recentes do usuário (para o dashboard / aba de mensagens). */
export async function getConversations(meId, db = rtdb) {
  const snap = await db.ref(`userChats/${meId}`).get()
  if (!snap.exists()) return []
  const entries = []
  snap.forEach((child) => {
    const v = child.val()
    if (v.archived === true) return // conversa arquivada some da lista de recentes
    entries.push({
      peerId: v.peerId,
      lastMessage: v.lastMessage,
      lastMessageAt: v.lastMessageAt,
    })
  })
  entries.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  return entries
}
```

Adicionar `setArchived` (depois de `deleteMessage`):

```js
/** Arquiva/desarquiva a conversa SÓ para o próprio usuário (o índice do peer não é tocado). */
export async function setArchived(meId, peerId, archived, db = rtdb) {
  const chatId = chatIdFor(meId, peerId)
  await db.ref(`userChats/${meId}/${chatId}`).update({ archived: Boolean(archived) })
}
```

Nota: `createMessage` chama `touchUserChats(chatId, senderId, receiverId, content, createdAt)` sem o 6º argumento — usa o default `db = rtdb`, então continua funcionando sem alteração.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/chatRealtimeService.test.js`
Expected: PASS (9 testes no arquivo)

- [ ] **Step 5: Rodar a suíte completa do backend**

Run: `cd backend && node --test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/chatRealtimeService.js backend/tests/chatRealtimeService.test.js
git commit -m "feat(chat): arquivar conversa (some da lista, resurface c/ msg nova) [CHAT-03]"
```

---

### Task 3: Backend — controller + rotas (apagar + arquivar)

**Files:**
- Modify: `backend/src/controllers/messageController.js`
- Modify: `backend/src/routes/messageRoutes.js`

**Interfaces:**
- Consumes: `deleteMessage`, `setArchived` do `chatRealtimeService` (Tasks 1-2).
- Produces:
  - Handler `deleteMessage(req, res)` → `DELETE /messages/:peerId/:messageId`
  - Handler `archiveConversation(req, res)` → `PATCH /conversations/:peerId/archive`

> Observação de teste: este projeto **não tem testes de controller** (nenhum `supertest`; `userController`/`messageController` não têm teste próprio — a cobertura vem dos serviços/schemas). Seguindo esse padrão, os handlers finos são cobertos pelos testes de serviço das Tasks 1-2; a verificação desta task é a suíte completa sem regressão. Não introduzir framework de teste de controller aqui.

- [ ] **Step 1: Adicionar os imports do serviço no controller**

Em `backend/src/controllers/messageController.js`, no bloco de import do `chatRealtimeService` (linhas ~3-9), adicionar `deleteMessage as deleteMessageRTDB` e `setArchived as setArchivedRTDB`:

```js
import {
  createMessage,
  getHistory,
  getConversations as getConversationsRTDB,
  getUnreadCount as getUnreadCountRTDB,
  markAsRead as markAsReadRTDB,
  deleteMessage as deleteMessageRTDB,
  setArchived as setArchivedRTDB,
} from '../services/chatRealtimeService.js'
```

- [ ] **Step 2: Adicionar os handlers**

Em `backend/src/controllers/messageController.js`, adicionar ao final (antes ou depois de `markAsRead`):

```js
/** DELETE /messages/:peerId/:messageId — apaga (tombstone) a própria mensagem em janela de 10min. */
export const deleteMessage = async (req, res) => {
    try {
        const me = req.userId
        const { peerId, messageId } = req.params
        if (!peerId || !messageId) return res.status(400).json({ msg: "Parâmetros inválidos" })
        if (peerId === me) return res.status(400).json({ msg: "Conversa inválida" })

        const message = await deleteMessageRTDB(me, peerId, messageId)
        res.status(200).json({ message })
    } catch (e) {
        const statusByCode = { not_found: 404, forbidden: 403, window_expired: 409 }
        const status = statusByCode[e.code]
        if (status) return res.status(status).json({ msg: e.message })
        messageLogger.error('message:delete_failed', { error: e.message, stack: e.stack, userId: req.userId, endpoint: req.originalUrl })
        res.status(500).json({ msg: "Erro ao apagar mensagem" })
    }
}

/** PATCH /conversations/:peerId/archive — arquiva/desarquiva a conversa só para o usuário. */
export const archiveConversation = async (req, res) => {
    try {
        const me = req.userId
        const { peerId } = req.params
        const { archived } = req.body
        if (!peerId) return res.status(400).json({ msg: "Usuário inválido" })
        if (peerId === me) return res.status(400).json({ msg: "Conversa inválida" })
        if (typeof archived !== 'boolean') return res.status(422).json({ msg: 'Campo "archived" deve ser booleano' })

        await setArchivedRTDB(me, peerId, archived)
        res.status(200).json({ msg: archived ? "Conversa arquivada" : "Conversa desarquivada" })
    } catch (e) {
        messageLogger.error('message:archive_failed', { error: e.message, stack: e.stack, userId: req.userId, endpoint: req.originalUrl })
        res.status(500).json({ msg: "Erro ao arquivar conversa" })
    }
}
```

- [ ] **Step 3: Adicionar as rotas**

Em `backend/src/routes/messageRoutes.js`, adicionar `deleteMessage` e `archiveConversation` ao import do controller (linhas ~5-12):

```js
import {
    sendMessage,
    sendAudioMessage,
    getMessageHistory,
    getConversations,
    getUnreadCount,
    markAsRead,
    deleteMessage,
    archiveConversation,
} from '../controllers/messageController.js';
```

E registrar as rotas (junto às demais, antes de `export default router`):

```js
// Apagar mensagem própria (janela 10min) e sair/arquivar conversa
router.delete('/messages/:peerId/:messageId', checkToken, deleteMessage);
router.patch('/conversations/:peerId/archive', checkToken, archiveConversation);
```

- [ ] **Step 4: Rodar a suíte completa do backend**

Run: `cd backend && node --test`
Expected: PASS (sem regressão — a cobertura de comportamento vem das Tasks 1-2)

- [ ] **Step 5: Sanidade — o app sobe sem erro de import/rota**

Run: `cd backend && node -e "import('./src/routes/messageRoutes.js').then(() => console.log('routes OK')).catch((e) => { console.error(e); process.exit(1) })"`
Expected: imprime `routes OK` (valida que os imports do controller e as rotas resolvem)

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/messageController.js backend/src/routes/messageRoutes.js
git commit -m "feat(chat): rotas DELETE /messages/:peerId/:messageId e PATCH /conversations/:peerId/archive [CHAT-01/CHAT-03]"
```

---

### Task 4: Frontend — helpers puros `chatMessages.js` (janela + merge)

**Files:**
- Create: `frontend/src/utils/chatMessages.js`
- Create: `frontend/src/utils/chatMessages.test.js`

**Interfaces:**
- Produces:
  - `DELETE_WINDOW_MS = 600000`
  - `canDeleteMessage(message, meId, nowMs = Date.now()) => boolean`
  - `mergeMessageById(messages, changed) => array` — devolve nova lista com o item de mesmo `id` mesclado (`{ ...antigo, ...changed }`); se não achar o id, devolve a lista inalterada.

Ficam num módulo próprio (sem import de Firebase) pra serem testáveis isolados; o hook e a página importam daqui.

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `frontend/src/utils/chatMessages.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { canDeleteMessage, mergeMessageById, DELETE_WINDOW_MS } from './chatMessages'

const NOW = 1_800_000_000_000

describe('canDeleteMessage', () => {
  const base = { id: 'm1', senderId: 'ana', createdAt: NOW, deleted: false }

  it('permite apagar a própria mensagem dentro da janela', () => {
    expect(canDeleteMessage(base, 'ana', NOW)).toBe(true)
    expect(canDeleteMessage(base, 'ana', NOW + DELETE_WINDOW_MS)).toBe(true)
  })
  it('bloqueia fora da janela', () => {
    expect(canDeleteMessage(base, 'ana', NOW + DELETE_WINDOW_MS + 1)).toBe(false)
  })
  it('bloqueia mensagem de outra pessoa', () => {
    expect(canDeleteMessage(base, 'bob', NOW)).toBe(false)
  })
  it('bloqueia mensagem já apagada', () => {
    expect(canDeleteMessage({ ...base, deleted: true }, 'ana', NOW)).toBe(false)
  })
  it('bloqueia mensagem otimista (sem id real)', () => {
    expect(canDeleteMessage({ ...base, _optimistic: true }, 'ana', NOW)).toBe(false)
  })
})

describe('mergeMessageById', () => {
  it('substitui a mensagem de mesmo id, mesclando campos', () => {
    const msgs = [{ id: 'a', content: 'oi', read: false }, { id: 'b', content: 'ola' }]
    const out = mergeMessageById(msgs, { id: 'a', deleted: true, content: '' })
    expect(out[0]).toEqual({ id: 'a', content: '', read: false, deleted: true })
    expect(out[1]).toBe(msgs[1]) // outros itens intactos
  })
  it('devolve a lista inalterada se o id não existir', () => {
    const msgs = [{ id: 'a' }]
    expect(mergeMessageById(msgs, { id: 'x', deleted: true })).toBe(msgs)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/utils/chatMessages.test.js`
Expected: FAIL (`Failed to resolve import "./chatMessages"`)

- [ ] **Step 3: Implementar o módulo**

Criar `frontend/src/utils/chatMessages.js`:

```js
export const DELETE_WINDOW_MS = 600_000 // 10 minutos

/** Pode o usuário apagar esta mensagem agora? (própria, não apagada, não otimista, dentro da janela) */
export function canDeleteMessage(message, meId, nowMs = Date.now()) {
  if (!message || message.senderId !== meId) return false
  if (message.deleted || message._optimistic) return false
  return nowMs - message.createdAt <= DELETE_WINDOW_MS
}

/** Substitui a mensagem de mesmo id por { ...antigo, ...changed }; lista inalterada se o id sumir. */
export function mergeMessageById(messages, changed) {
  const idx = messages.findIndex((m) => m.id === changed.id)
  if (idx === -1) return messages
  const next = [...messages]
  next[idx] = { ...next[idx], ...changed }
  return next
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/utils/chatMessages.test.js`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/chatMessages.js frontend/src/utils/chatMessages.test.js
git commit -m "feat(chat): helpers puros canDeleteMessage + mergeMessageById [CHAT-01]"
```

---

### Task 5: Frontend — hook `useFirebaseChat` ganha `onChildChanged` + `onMessageChanged`

**Files:**
- Modify: `frontend/src/hooks/useFirebaseChat.js`

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces: o hook `useFirebaseChat({ meId, peerId, onMessage, onMessageChanged })` passa a assinar também `onChildChanged`, chamando `onMessageChanged(changedMessage)` a cada mudança de nó (tombstone/leitura). `onMessageChanged` é opcional.

> Teste: a assinatura do listener depende do SDK do Firebase e do estado de config; não há harness de teste do hook no projeto (o `useFirebaseChat` não tem teste). A verificação é a suíte completa sem regressão + o import de `onChildChanged` resolver no build. A lógica testável (merge) já está coberta na Task 4.

- [ ] **Step 1: Importar `onChildChanged`**

Em `frontend/src/hooks/useFirebaseChat.js`, na linha 2, adicionar `onChildChanged` ao import do `firebase/database`:

```js
import { ref, push, onChildAdded, onChildChanged, update, get } from 'firebase/database'
```

- [ ] **Step 2: Aceitar e "refear" o callback `onMessageChanged`**

Na assinatura do hook (linha ~20) e nos refs (linhas ~24-25):

```js
export function useFirebaseChat({ meId, peerId, onMessage, onMessageChanged }) {
  const [ready, setReady] = useState(false)
  const [realtimeActive, setRealtimeActive] = useState(false)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const onMessageChangedRef = useRef(onMessageChanged)
  onMessageChangedRef.current = onMessageChanged
```

- [ ] **Step 3: Assinar `onChildChanged` junto do `onChildAdded`**

Dentro do `useEffect`, onde hoje só há `onChildAdded` (linhas ~49-53), passar a manter as duas assinaturas e desinscrever ambas. Substituir o bloco:

```js
        const messagesRef = ref(rtdb, `chats/${chatId}/messages`)
        unsubscribe = onChildAdded(messagesRef, (snapshot) => {
          const message = { id: snapshot.key, ...snapshot.val() }
          onMessageRef.current?.(message)
        })
```

por:

```js
        const messagesRef = ref(rtdb, `chats/${chatId}/messages`)
        const offAdded = onChildAdded(messagesRef, (snapshot) => {
          const message = { id: snapshot.key, ...snapshot.val() }
          onMessageRef.current?.(message)
        })
        const offChanged = onChildChanged(messagesRef, (snapshot) => {
          const message = { id: snapshot.key, ...snapshot.val() }
          onMessageChangedRef.current?.(message)
        })
        unsubscribe = () => { offAdded(); offChanged() }
```

- [ ] **Step 4: Rodar a suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS (sem regressão — nenhum teste depende do hook diretamente)

- [ ] **Step 5: Build (garante que `onChildChanged` resolve)**

Run: `cd frontend && npm run build`
Expected: build sem erros

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useFirebaseChat.js
git commit -m "feat(chat): useFirebaseChat assina onChildChanged (propaga tombstone/leitura) [CHAT-01]"
```

---

### Task 6: Frontend — Chat: apagar mensagem (lixeira + ConfirmDialog + tombstone)

**Files:**
- Modify: `frontend/src/pages/Chat/index.jsx`
- Create: `frontend/src/pages/Chat/Chat.test.jsx`

**Interfaces:**
- Consumes: `canDeleteMessage`, `mergeMessageById` (Task 4); `ConfirmDialog` (`ui`); `api` (`services/api`); `onMessageChanged` do hook (Task 5).

- [ ] **Step 1: Escrever o teste do fluxo de apagar (falhando)**

Criar `frontend/src/pages/Chat/Chat.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock, useParams: () => ({ userId: 'bob' }) }
})
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn().mockResolvedValue({ data: {} }), delete: vi.fn() } }))
vi.mock('../../hooks/useFirebaseChat', () => ({
  useFirebaseChat: () => ({
    chatId: 'ana_bob', ready: true, realtimeActive: true,
    sendMessage: vi.fn(), markRead: vi.fn().mockResolvedValue(),
  }),
}))
vi.mock('../../hooks/useSocket', () => ({
  useSocket: () => ({ socket: { emit: vi.fn() }, emitTyping: vi.fn(), emitRead: vi.fn(), isConnected: true }),
}))
vi.mock('../../hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({ isRecording: false, startRecording: vi.fn(), stopRecording: vi.fn(), audioBlob: null, clearAudio: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

import Chat from './index'
import api from '../../services/api'

const NOW = Date.now()
const MINHA_RECENTE = { id: 'm1', senderId: 'ana', receiverId: 'bob', content: 'oi', createdAt: NOW, read: false }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('meuId', 'ana')
  localStorage.setItem('meuRole', 'FAMILIAR')
  api.get.mockImplementation((url) => {
    if (url.startsWith('/messages/history/')) {
      return Promise.resolve({ data: { peer: { id: 'bob', name: 'Bob', role: 'CUIDADOR' }, messages: [MINHA_RECENTE] } })
    }
    return Promise.resolve({ data: {} })
  })
})

function renderChat() {
  return render(<MemoryRouter><Chat /></MemoryRouter>)
}

describe('Chat — apagar mensagem', () => {
  it('mostra a lixeira na própria mensagem recente e apaga via api.delete', async () => {
    api.delete.mockResolvedValue({ data: { message: { ...MINHA_RECENTE, deleted: true, content: '' } } })
    const user = userEvent.setup()
    renderChat()

    const bubble = await screen.findByText('oi')
    await user.click(bubble) // revela a lixeira ao clicar na própria bolha
    const trash = await screen.findByRole('button', { name: /apagar mensagem/i })
    await user.click(trash)

    // ConfirmDialog abre
    const confirm = await screen.findByRole('button', { name: /^apagar$/i })
    await user.click(confirm)

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/messages/bob/m1'))
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/Chat/Chat.test.jsx`
Expected: FAIL (não há lixeira/ConfirmDialog de apagar ainda)

- [ ] **Step 3: Importar os novos módulos na página**

Em `frontend/src/pages/Chat/index.jsx`, adicionar aos imports:

```js
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { ConfirmDialog } from '../../components/ui'
import { canDeleteMessage, mergeMessageById } from '../../utils/chatMessages'
```

- [ ] **Step 4: Estado do diálogo + handler de apagar**

Adicionar estado (junto dos outros `useState`, ~linha 43):

```js
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deletingMsg, setDeletingMsg] = useState(false)
  const [activeMsgId, setActiveMsgId] = useState(null) // bolha "aberta" que mostra a lixeira
```

Adicionar o callback de mudança (tombstone/leitura) e passá-lo ao hook. Onde o hook é chamado (~linha 165), incluir `onMessageChanged`:

```js
  const handleChangedMessage = useCallback((message) => {
    setMessages((prev) => mergeMessageById(prev, message))
  }, [])

  const { sendMessage: sendFirebaseMessage, markRead: markFirebaseRead, realtimeActive } = useFirebaseChat({
    meId,
    peerId,
    onMessage: handleIncomingMessage,
    onMessageChanged: handleChangedMessage,
  })
```

Adicionar o handler que chama a API (perto de `handleSend`):

```js
  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteId) return
    setDeletingMsg(true)
    try {
      await api.delete(`/messages/${peerId}/${confirmDeleteId}`)
      // O tombstone ao vivo chega via onChildChanged; atualiza otimista também:
      setMessages((prev) => mergeMessageById(prev, { id: confirmDeleteId, deleted: true, content: '', audioUrl: null }))
    } catch (err) {
      const msg = err.response?.status === 409
        ? 'O prazo para apagar esta mensagem já passou.'
        : 'Não foi possível apagar a mensagem.'
      toast.error(msg)
    } finally {
      setDeletingMsg(false)
      setConfirmDeleteId(null)
      setActiveMsgId(null)
    }
  }, [confirmDeleteId, peerId])
```

- [ ] **Step 5: Render — tombstone + lixeira na bolha**

Substituir o corpo do `.map((m) => {...})` das mensagens (linhas ~356-384) por uma versão que trata `deleted` e mostra a lixeira quando `canDeleteMessage`:

```jsx
        {messages.map((m) => {
          const mine = m.senderId === meId
          const deletable = mine && canDeleteMessage(m, meId)
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
              <div
                onClick={() => deletable && setActiveMsgId((cur) => (cur === m.id ? null : m.id))}
                className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-opacity duration-200
                  ${mine ? 'bg-virla-roxo text-white rounded-br-md' : 'bg-white text-virla-texto border border-virla-roxo/10 rounded-bl-md'}
                  ${m._optimistic ? 'opacity-70' : 'opacity-100'}
                  ${deletable ? 'cursor-pointer' : ''}
                `}
              >
                {m.deleted ? (
                  <p className="italic opacity-70 flex items-center gap-1">🚫 Esta mensagem foi apagada</p>
                ) : m.audioUrl ? (
                  <audio src={`${API_URL}${m.audioUrl}`} controls className="max-w-full h-10 mt-1 rounded" />
                ) : (
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                )}

                {!m.deleted && (
                  <p className={`text-[10px] mt-1.5 flex items-center gap-1 ${mine ? 'text-white/70 justify-end' : 'text-virla-texto/40 justify-start'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {mine && !m._optimistic && (
                      <span className={m.read ? 'text-blue-300' : 'text-white/50'}>
                        {m.read ? '✓✓' : '✓'}
                      </span>
                    )}
                  </p>
                )}

                {deletable && activeMsgId === m.id && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(m.id) }}
                    className="absolute -top-2 -left-2 bg-white text-red-600 border border-red-200 rounded-full p-1 shadow-sm hover:bg-red-50"
                    aria-label="Apagar mensagem"
                  >
                    <DeleteOutlined sx={{ fontSize: 16 }} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
```

- [ ] **Step 6: Render — o `ConfirmDialog` de apagar**

Adicionar, junto ao final do JSX (perto do `GenerateChargeModal`, antes do fechamento do container):

```jsx
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Apagar mensagem?"
        description="Ela aparecerá como apagada para você e para a outra pessoa."
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        loading={deletingMsg}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/Chat/Chat.test.jsx`
Expected: PASS

- [ ] **Step 8: Rodar a suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS (sem regressão)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/Chat/index.jsx frontend/src/pages/Chat/Chat.test.jsx
git commit -m "feat(chat): apagar mensagem própria (lixeira + ConfirmDialog + tombstone) [CHAT-01]"
```

---

### Task 7: Frontend — Chat: sair/arquivar conversa (botão header + ConfirmDialog)

**Files:**
- Modify: `frontend/src/pages/Chat/index.jsx`
- Modify: `frontend/src/pages/Chat/Chat.test.jsx`

**Interfaces:**
- Consumes: `ConfirmDialog`, `api.patch` (Task 6 já importou `ConfirmDialog` e `api` existe).

- [ ] **Step 1: Escrever o teste do fluxo de arquivar (falhando)**

Adicionar a `frontend/src/pages/Chat/Chat.test.jsx`:

```jsx
describe('Chat — sair da conversa', () => {
  it('arquiva via api.patch e navega para a lista de conversas', async () => {
    api.patch.mockResolvedValue({ data: { msg: 'Conversa arquivada' } })
    const user = userEvent.setup()
    renderChat()

    await screen.findByText('oi') // conversa carregada
    await user.click(screen.getByRole('button', { name: /sair da conversa/i }))

    const confirm = await screen.findByRole('button', { name: /^sair$/i })
    await user.click(confirm)

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/conversations/bob/archive', { archived: true }))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/home?tab=mensagens'))
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/Chat/Chat.test.jsx`
Expected: FAIL (não há botão "Sair da conversa" ainda)

- [ ] **Step 3: Importar o ícone**

Em `frontend/src/pages/Chat/index.jsx`, adicionar aos imports de ícones:

```js
import ExitToApp from '@mui/icons-material/ExitToApp'
```

- [ ] **Step 4: Estado + handler de arquivar**

Adicionar estado (junto dos demais `useState`):

```js
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
```

Adicionar o handler (perto de `handleConfirmDelete`):

```js
  const handleConfirmLeave = useCallback(async () => {
    setLeaving(true)
    try {
      await api.patch(`/conversations/${peerId}/archive`, { archived: true })
      navigate('/home?tab=mensagens')
    } catch {
      toast.error('Não foi possível sair da conversa.')
      setLeaving(false)
      setConfirmLeave(false)
    }
  }, [peerId, navigate])
```

- [ ] **Step 5: Botão no header**

No `<header>` (perto do link "Histórico", ~linha 339), adicionar o botão de sair:

```jsx
        <button
          type="button"
          onClick={() => setConfirmLeave(true)}
          className="p-2 rounded-xl hover:bg-white/15 transition-colors flex-shrink-0"
          title="Sair da conversa"
          aria-label="Sair da conversa"
        >
          <ExitToApp sx={{ fontSize: 24 }} />
        </button>
```

- [ ] **Step 6: `ConfirmDialog` de sair**

Adicionar junto ao `ConfirmDialog` de apagar (Task 6):

```jsx
      <ConfirmDialog
        open={confirmLeave}
        title="Sair desta conversa?"
        description="Ela sai da sua lista de conversas; a outra pessoa continua vendo, e você não perde o histórico."
        confirmLabel="Sair"
        cancelLabel="Cancelar"
        loading={leaving}
        onConfirm={handleConfirmLeave}
        onCancel={() => setConfirmLeave(false)}
      />
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/Chat/Chat.test.jsx`
Expected: PASS (os dois describes: apagar + sair)

- [ ] **Step 8: Rodar a suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/Chat/index.jsx frontend/src/pages/Chat/Chat.test.jsx
git commit -m "feat(chat): sair/arquivar conversa (botão header + ConfirmDialog) [CHAT-03]"
```

---

### Task 8: Verificação final da branch

**Files:** nenhum — só validação.

- [ ] **Step 1: Suíte completa do backend**

Run: `cd backend && node --test`
Expected: PASS, 100% (sem regressão na contagem de testes)

- [ ] **Step 2: Suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS, 100%

- [ ] **Step 3: Build do frontend**

Run: `cd frontend && npm run build`
Expected: build sem erros

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: sem novos erros/warnings introduzidos por este bloco (comparar contagem com a baseline da main — deve permanecer o mesmo número)

- [ ] **Step 5: Atualizar o roadmap**

Em `docs/ROADMAP-melhorias-fabio.md`, na "Fase 4", marcar como concluídos CHAT-01 (apagar mensagem) e a parte de "sair de conversa" do CHAT-03. Exemplo de nota (seguindo o estilo já usado no doc):

```markdown
> ✅ **Concluído no branch `chat-features` (2026-07-04):** CHAT-01 (apagar mensagem própria em janela de 10min, tombstone) e "sair/arquivar conversa" (parte do antigo CHAT-03). Restam CHAT-02 (pacote grande), PROD-01/02/03.
```

```bash
git add docs/ROADMAP-melhorias-fabio.md
git commit -m "docs(roadmap): marca CHAT-01 e sair/arquivar conversa como concluídos"
```

---

## Notas de escopo / decisões herdadas do spec

- **Áudio apagado** vira tombstone com `audioUrl: null`; o arquivo em `/uploads/` fica órfão — coleta de lixo está **fora de escopo**.
- **Janela pelo relógio do servidor** é a autoridade; a lixeira no cliente usa o relógio local só como dica de UI. Um cliente com relógio adiantado pode ver a lixeira e receber `409` ao confirmar — a UI mostra toast, sem risco de dado.
- **Regras do RTDB inalteradas** — delete/archive passam pelo admin SDK.
- **Controllers sem teste unitário** — segue o padrão do projeto (nenhum controller tem teste próprio); a cobertura de comportamento vem dos testes de serviço (Tasks 1-2).
- **Fora de escopo:** editar mensagem; "apagar só para mim"; aba/pasta de arquivadas; GC de áudios órfãos.
