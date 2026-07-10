import { rtdb } from '../lib/firebase.js'
import { messageLogger } from '../lib/logger.js'

/**
 * chatRealtimeService — camada de acesso ao Firebase Realtime Database
 * para o domínio de mensagens (Sprint 0).
 *
 * Estrutura de dados no RTDB:
 *
 *   chats/{chatId}/members/{userId}            -> true
 *   chats/{chatId}/messages/{messageId}/        -> { senderId, receiverId, content, audioUrl, createdAt, read }
 *   userChats/{userId}/{chatId}/                -> { peerId, lastMessage, lastMessageAt }  (índice p/ lista de conversas)
 *
 * chatId é determinístico: os dois userIds ordenados e unidos por "_".
 * Isso permite que as Security Rules do Firebase validem o acesso sem
 * precisar de uma consulta extra (basta checar se auth.uid faz parte do chatId).
 *
 * NOTA IMPORTANTE (trade-off de segurança):
 * O conteúdo das mensagens passa a ser armazenado em texto puro no RTDB
 * (em vez de criptografado como era no Mongo via crypto.js). Isso é o
 * padrão recomendado pelo próprio Firebase: a proteção de acesso é feita
 * via Security Rules (somente remetente/destinatário autenticados podem
 * ler o nó `chats/{chatId}`), e não por criptografia de campo. Como o
 * conteúdo já trafegava como texto puro para o cliente (via Socket.io/REST),
 * isso não reduz a segurança fim-a-fim — apenas move a "fronteira" de
 * confiança da criptografia AES local para as regras de acesso do Firebase.
 * Se desejarem manter criptografia em repouso, isso pode ser feito depois
 * com Cloud Functions (plano Blaze), fora do escopo da Sprint 0.
 */

export function chatIdFor(userIdA, userIdB) {
  return [userIdA, userIdB].sort().join('_')
}

export const DELETE_WINDOW_MS = 600_000

/** true se a mensagem ainda está dentro da janela de apagar (10 min). */
export function isWithinDeleteWindow(createdAt, nowMs = Date.now()) {
  return nowMs - createdAt <= DELETE_WINDOW_MS
}

/** Garante que os dois participantes estão registrados como membros do chat (usado pelas Security Rules). */
async function ensureMembership(chatId, userIdA, userIdB) {
  await rtdb.ref(`chats/${chatId}/members`).update({
    [userIdA]: true,
    [userIdB]: true,
  })
}

/** Atualiza o índice de conversas recentes de ambos os participantes. */
export async function touchUserChats(chatId, senderId, receiverId, lastMessage, lastMessageAt, db = rtdb) {
  await Promise.all([
    db.ref(`userChats/${senderId}/${chatId}`).update({ peerId: receiverId, lastMessage, lastMessageAt, archived: false }),
    db.ref(`userChats/${receiverId}/${chatId}`).update({ peerId: senderId, lastMessage, lastMessageAt, archived: false }),
  ])
}

/** Cria uma mensagem (texto ou áudio) e retorna o objeto salvo, já com `id`. */
export async function createMessage({
  senderId, receiverId, content, audioUrl = null,
  attachmentUrl = null, attachmentType = null, attachmentName = null,
}) {
  const chatId = chatIdFor(senderId, receiverId)
  const ref = rtdb.ref(`chats/${chatId}/messages`).push()
  const createdAt = Date.now()

  const message = {
    id: ref.key,
    senderId,
    receiverId,
    content,
    audioUrl,
    attachmentUrl,
    attachmentType,
    attachmentName,
    read: false,
    createdAt,
  }

  await ref.set(message)
  await ensureMembership(chatId, senderId, receiverId)
  await touchUserChats(chatId, senderId, receiverId, content, createdAt)

  messageLogger.info('message:sent', { userId: senderId, action: 'create_message', metadata: { receiverId, messageId: ref.key } })

  return message
}

/**
 * Histórico completo de uma conversa, ordenado por data crescente.
 *
 * CORREÇÃO (erro 500): trocamos `orderByChild('createdAt')` por leitura
 * completa do nó + ordenação em memória. A query indexada exigia a regra
 * `.indexOn` publicada no console do Firebase; sem ela o RTDB respondia com
 * erro e a rota /messages/history caía em 500. A ordenação em memória torna
 * o chat resiliente mesmo sem índices configurados.
 */
export async function getHistory(meId, otherId) {
  const chatId = chatIdFor(meId, otherId)
  const snap = await rtdb.ref(`chats/${chatId}/messages`).get()
  if (!snap.exists()) return []
  const messages = []
  snap.forEach((child) => {
    messages.push(child.val())
  })
  messages.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
  return messages
}

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

/** Conta mensagens não lidas recebidas pelo usuário, em todos os chats. */
export async function getUnreadCount(meId) {
  const userChatsSnap = await rtdb.ref(`userChats/${meId}`).get()
  if (!userChatsSnap.exists()) return 0

  let total = 0
  const chatIds = Object.keys(userChatsSnap.val())

  // CORREÇÃO (erro 500): leitura completa + filtro em memória, em vez de
  // `orderByChild('receiverId').equalTo(meId)` (que exigia `.indexOn`).
  await Promise.all(
    chatIds.map(async (chatId) => {
      const msgsSnap = await rtdb.ref(`chats/${chatId}/messages`).get()
      if (!msgsSnap.exists()) return
      msgsSnap.forEach((child) => {
        const msg = child.val()
        if (msg.receiverId === meId && msg.read === false) total += 1
      })
    })
  )

  return total
}

/** Marca como lidas todas as mensagens enviadas por `otherId` para `meId`. */
export async function markAsRead(meId, otherId) {
  const chatId = chatIdFor(meId, otherId)
  // CORREÇÃO (erro 500): leitura completa + filtro em memória, em vez de
  // `orderByChild('senderId').equalTo(otherId)` (que exigia `.indexOn`).
  const snap = await rtdb.ref(`chats/${chatId}/messages`).get()

  if (!snap.exists()) return

  const updates = {}
  snap.forEach((child) => {
    const msg = child.val()
    if (msg.senderId === otherId && msg.read === false) {
      updates[`${child.key}/read`] = true
    }
  })

  if (Object.keys(updates).length > 0) {
    await rtdb.ref(`chats/${chatId}/messages`).update(updates)
  }
}

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

/** Arquiva/desarquiva a conversa SÓ para o próprio usuário (o índice do peer não é tocado). */
export async function setArchived(meId, peerId, archived, db = rtdb) {
  const chatId = chatIdFor(meId, peerId)
  await db.ref(`userChats/${meId}/${chatId}`).update({ archived: Boolean(archived) })
}

/** Busca os dados (nome) de um peer a partir do índice de conversas — usado só como fallback. */
export async function getPeerIdsOf(meId) {
  const snap = await rtdb.ref(`userChats/${meId}`).get()
  if (!snap.exists()) return []
  return Object.values(snap.val()).map((v) => v.peerId)
}
