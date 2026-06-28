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

/** Garante que os dois participantes estão registrados como membros do chat (usado pelas Security Rules). */
async function ensureMembership(chatId, userIdA, userIdB) {
  await rtdb.ref(`chats/${chatId}/members`).update({
    [userIdA]: true,
    [userIdB]: true,
  })
}

/** Atualiza o índice de conversas recentes de ambos os participantes. */
async function touchUserChats(chatId, senderId, receiverId, lastMessage, lastMessageAt) {
  await Promise.all([
    rtdb.ref(`userChats/${senderId}/${chatId}`).update({ peerId: receiverId, lastMessage, lastMessageAt }),
    rtdb.ref(`userChats/${receiverId}/${chatId}`).update({ peerId: senderId, lastMessage, lastMessageAt }),
  ])
}

/** Cria uma mensagem (texto ou áudio) e retorna o objeto salvo, já com `id`. */
export async function createMessage({ senderId, receiverId, content, audioUrl = null }) {
  const chatId = chatIdFor(senderId, receiverId)
  const ref = rtdb.ref(`chats/${chatId}/messages`).push()
  const createdAt = Date.now()

  const message = {
    id: ref.key,
    senderId,
    receiverId,
    content,
    audioUrl,
    read: false,
    createdAt,
  }

  await ref.set(message)
  await ensureMembership(chatId, senderId, receiverId)
  await touchUserChats(chatId, senderId, receiverId, content, createdAt)

  messageLogger.info('message:sent', { userId: senderId, action: 'create_message', metadata: { receiverId, messageId: ref.key } })

  return message
}

/** Histórico completo de uma conversa, ordenado por data crescente. */
export async function getHistory(meId, otherId) {
  const chatId = chatIdFor(meId, otherId)
  // Busca o nó inteiro e ordena em memória — não depende de `.indexOn` no RTDB
  // (queries com orderByChild falham com 500 se as rules não foram publicadas).
  const snap = await rtdb.ref(`chats/${chatId}/messages`).get()
  if (!snap.exists()) return []
  const messages = []
  snap.forEach((child) => {
    const val = child.val()
    messages.push({ id: val.id ?? child.key, ...val })
  })
  messages.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
  return messages
}

/** Lista as conversas recentes do usuário (para o dashboard / aba de mensagens). */
export async function getConversations(meId) {
  const snap = await rtdb.ref(`userChats/${meId}`).get()
  if (!snap.exists()) return []
  const entries = []
  snap.forEach((child) => {
    const v = child.val()
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

  await Promise.all(
    chatIds.map(async (chatId) => {
      const msgsSnap = await rtdb.ref(`chats/${chatId}/messages`).get()
      if (!msgsSnap.exists()) return
      msgsSnap.forEach((child) => {
        const val = child.val()
        if (val.receiverId === meId && val.read === false) total += 1
      })
    })
  )

  return total
}

/** Marca como lidas todas as mensagens enviadas por `otherId` para `meId`. */
export async function markAsRead(meId, otherId) {
  const chatId = chatIdFor(meId, otherId)
  const snap = await rtdb.ref(`chats/${chatId}/messages`).get()

  if (!snap.exists()) return

  const updates = {}
  snap.forEach((child) => {
    const val = child.val()
    if (val.senderId === otherId && val.read === false) {
      updates[`${child.key}/read`] = true
    }
  })

  if (Object.keys(updates).length > 0) {
    await rtdb.ref(`chats/${chatId}/messages`).update(updates)
  }
}

/** Busca os dados (nome) de um peer a partir do índice de conversas — usado só como fallback. */
export async function getPeerIdsOf(meId) {
  const snap = await rtdb.ref(`userChats/${meId}`).get()
  if (!snap.exists()) return []
  return Object.values(snap.val()).map((v) => v.peerId)
}
