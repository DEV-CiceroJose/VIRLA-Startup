import express from 'express';
import multer from 'multer';
import checkToken from '../middlewares/checkToken.js';
import upload from '../config/upload.js';
import uploadAttachment from '../config/uploadAttachment.js';
import {
    sendMessage,
    sendAudioMessage,
    sendAttachmentMessage,
    getMessageHistory,
    getConversations,
    getUnreadCount,
    markAsRead,
    deleteMessage,
    archiveConversation,
} from '../controllers/messageController.js';

const router = express.Router();

// Envolve o upload do Multer para converter erros (tamanho/tipo) em respostas
// HTTP limpas (413/422) em vez de cair no handler de erro global como 500.
function uploadAudio(req, res, next) {
  upload.single('audio')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        msg: tooLarge ? 'Áudio excede o tamanho máximo permitido.' : 'Falha no upload do áudio.',
      });
    }
    return res.status(err.status ?? 422).json({ msg: err.message ?? 'Arquivo inválido.' });
  });
}

// Envolve o upload de anexo (imagem/PDF) do Multer, espelhando uploadAudio.
function uploadAttachmentFile(req, res, next) {
  uploadAttachment.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        msg: tooLarge ? 'Arquivo excede o tamanho máximo (5MB).' : 'Falha no upload do arquivo.',
      });
    }
    return res.status(err.status ?? 422).json({ msg: err.message ?? 'Arquivo inválido.' });
  });
}

// Rota de texto normal
router.post('/messages', checkToken, sendMessage);

// Rota de áudio (o Multer intercepta o arquivo "audio" antes de chegar ao controller)
router.post('/messages/audio', checkToken, uploadAudio, sendAudioMessage);

// Rota de anexo (imagem/PDF) — o Multer intercepta o arquivo "file"
router.post('/messages/attachment', checkToken, uploadAttachmentFile, sendAttachmentMessage);

// Histórico e Lista de Conversas
router.get('/messages/history/:userId', checkToken, getMessageHistory);
router.get('/conversations', checkToken, getConversations);

// Rotas de notificação (O nosso contador e o marcador de leitura)
router.get('/messages/unread-count', checkToken, getUnreadCount);
router.patch('/messages/read/:userId', checkToken, markAsRead);

// Apagar mensagem própria (janela 10min) e sair/arquivar conversa
router.delete('/messages/:peerId/:messageId', checkToken, deleteMessage);
router.patch('/conversations/:peerId/archive', checkToken, archiveConversation);

export default router;