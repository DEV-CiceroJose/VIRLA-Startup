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
 *
 * DÉBITO CONHECIDO (MVP): o padrão leitura-depois-escrita não é transacional.
 * Duas mensagens quase simultâneas do mesmo remetente (rajada, double-click,
 * retry) podem ambas ler "não existe não-lida" e criar duas linhas em vez de
 * colapsar numa só. Não corrompe dados nem quebra o envio (a notificação é
 * best-effort); só pode exibir duas entradas do mesmo remetente no sino.
 * Se virar incômodo real, migrar para db.runTransaction (mesmo trade-off de
 * concorrência já assumido em outros pontos do MVP).
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
