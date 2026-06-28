import express from 'express';
import multer from 'multer';
import checkToken from '../middlewares/checkToken.js';
import upload from '../config/upload.js';
import {
    sendMessage,
    sendAudioMessage,
    getMessageHistory,
    getConversations,
    getUnreadCount,
    markAsRead
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

// Rota de texto normal
router.post('/messages', checkToken, sendMessage);

// Rota de áudio (o Multer intercepta o arquivo "audio" antes de chegar ao controller)
router.post('/messages/audio', checkToken, uploadAudio, sendAudioMessage);

// Histórico e Lista de Conversas
router.get('/messages/history/:userId', checkToken, getMessageHistory);
router.get('/conversations', checkToken, getConversations);

// Rotas de notificação (O nosso contador e o marcador de leitura)
router.get('/messages/unread-count', checkToken, getUnreadCount);
router.patch('/messages/read/:userId', checkToken, markAsRead);

export default router;