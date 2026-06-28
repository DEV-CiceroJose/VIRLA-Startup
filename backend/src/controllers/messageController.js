import prisma from '../lib/prisma.js'
import { messageLogger } from '../lib/logger.js'
import {
  createMessage,
  getHistory,
  getConversations as getConversationsRTDB,
  getUnreadCount as getUnreadCountRTDB,
  markAsRead as markAsReadRTDB,
} from '../services/chatRealtimeService.js'

/**
 * Sprint 0: as mensagens deixaram de ser persistidas no MongoDB via Prisma e
 * passaram a viver no Firebase Realtime Database (ver chatRealtimeService.js).
 * O `prisma` continua sendo usado aqui apenas para validar/enriquecer dados
 * de usuário (User ainda mora no Mongo) — só as Mensagens migraram.
 */

/** POST body: { receiverId, content } — sender is req.userId from JWT */
export const sendMessage = async (req, res) => {
    try {
        const { receiverId, content } = req.body
        const senderId = req.userId

        if (!content || typeof content !== "string" || !content.trim()) {
            return res.status(422).json({ msg: "Mensagem não pode ser vazia" })
        }
        if (!receiverId) {
            return res.status(422).json({ msg: "Destinatário é obrigatório" })
        }
        if (receiverId === senderId) {
            return res.status(400).json({ msg: "Não é possível enviar mensagem para si mesmo" })
        }

        const receiver = await prisma.user.findUnique({ where: { id: receiverId } })
        if (!receiver) {
            return res.status(404).json({ msg: "Usuário destinatário não encontrado" })
        }

        const message = await createMessage({ senderId, receiverId, content: content.trim() })

        res.status(201).json({ message })
    } catch (e) {
        messageLogger.error('message:send_failed', { error: e.message, stack: e.stack, userId: req.userId, endpoint: req.originalUrl })
        res.status(500).json({ msg: "Erro ao enviar mensagem" })
    }
}

/** POST para enviar áudios */
export const sendAudioMessage = async (req, res) => {
    try {
        const { receiverId } = req.body
        const senderId = req.userId
        const file = req.file

        if (!file) return res.status(400).json({ msg: "Nenhum arquivo de áudio" })
        if (!receiverId) return res.status(422).json({ msg: "Destinatário é obrigatório" })

        const message = await createMessage({
            senderId,
            receiverId,
            content: "🎵 Mensagem de Áudio",
            audioUrl: `/uploads/${file.filename}`,
        })

        res.status(201).json({ message })
    } catch (e) {
        messageLogger.error('message:audio_upload_failed', { error: e.message, stack: e.stack, userId: req.userId, endpoint: req.originalUrl })
        res.status(500).json({ msg: "Erro ao enviar mensagem de áudio" })
    }
}

/** Histórico completo entre usuário e :userId */
export const getMessageHistory = async (req, res) => {
    try {
        const me = req.userId
        const otherId = req.params.userId

        if (!otherId) { return res.status(400).json({ msg: "Usuário inválido" }) }
        if (otherId === me) { return res.status(400).json({ msg: "Conversa inválida" }) }

        const other = await prisma.user.findUnique({
            where: { id: otherId },
            select: { id: true, name: true, role: true, profileImage: true, approach: true, crm_crf: true },
        })
        if (!other) return res.status(404).json({ msg: "Usuário não encontrado" })

        const messages = await getHistory(me, otherId)

        res.status(200).json({ peer: other, messages })
    } catch (e) {
        const firebaseDown = String(e?.message ?? '').toLowerCase().includes('firebase') || e?.code === 'app/network-error'
        messageLogger.error('message:history_failed', { error: e.message, stack: e.stack, userId: req.userId, firebaseDown, endpoint: req.originalUrl })
        res.status(firebaseDown ? 503 : 500).json({
            msg: firebaseDown ? 'Não foi possível conectar ao banco de dados em tempo real...' : 'Erro ao buscar mensagens',
        })
    }
}

/** Lista conversas recentes para o dashboard */
export const getConversations = async (req, res) => {
    try {
        const me = req.userId
        const entries = await getConversationsRTDB(me)

        const peerIds = entries.map((e) => e.peerId)
        const peers = peerIds.length
            ? await prisma.user.findMany({ where: { id: { in: peerIds } }, select: { id: true, name: true } })
            : []
        const peerNameById = new Map(peers.map((p) => [p.id, p.name]))

        const conversations = entries.map((e) => ({
            peerId: e.peerId,
            peerName: peerNameById.get(e.peerId) ?? 'Usuário',
            lastMessage: e.lastMessage,
            lastMessageAt: e.lastMessageAt,
        }))

        res.status(200).json({ conversations })
    } catch (e) {
        const firebaseDown = String(e?.message ?? '').toLowerCase().includes('firebase') || e?.code === 'app/network-error'
        messageLogger.error('message:conversations_failed', { error: e.message, stack: e.stack, userId: req.userId, firebaseDown, endpoint: req.originalUrl })
        res.status(firebaseDown ? 503 : 500).json({
            msg: firebaseDown ? 'Não foi possível conectar ao banco de dados em tempo real...' : 'Erro ao listar conversas',
        })
    }
}

/** Contar mensagens não lidas */
export const getUnreadCount = async (req, res) => {
    try {
        const count = await getUnreadCountRTDB(req.userId)
        res.status(200).json({ count })
    } catch (e) {
        messageLogger.error('message:unread_count_failed', { error: e.message, stack: e.stack, userId: req.userId })
        res.status(500).json({ msg: "Erro ao buscar notificações" })
    }
}

/** Marcar mensagens de um usuário como lidas */
export const markAsRead = async (req, res) => {
    try {
        const { userId } = req.params
        if (!userId) {
            return res.status(400).json({ msg: 'Usuário inválido' })
        }
        if (userId === req.userId) {
            return res.status(400).json({ msg: 'Conversa inválida' })
        }
        await markAsReadRTDB(req.userId, userId)
        res.status(200).json({ msg: 'Mensagens lidas' })
    } catch (e) {
        messageLogger.error('message:mark_read_failed', { error: e.message, stack: e.stack, userId: req.userId })
        res.status(500).json({ msg: 'Erro ao marcar como lida' })
    }
}
