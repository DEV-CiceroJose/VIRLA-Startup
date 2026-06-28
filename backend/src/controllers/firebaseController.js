import { firebaseAdmin, FIREBASE_CONFIGURED } from '../lib/firebase.js'
import { authLogger } from '../lib/logger.js'

/**
 * Gera um Firebase Custom Token para o usuário autenticado (req.userId vem
 * do checkToken / JWT já validado). O frontend usa esse token para se
 * autenticar no Firebase Auth (signInWithCustomToken) e assim satisfazer
 * as Security Rules do Realtime Database, que exigem `auth.uid` para
 * liberar leitura/escrita em `chats/{chatId}`.
 */
export const getFirebaseToken = async (req, res) => {
  if (!FIREBASE_CONFIGURED) {
    return res.status(503).json({
      msg: 'Chat em tempo real indisponível — Firebase não configurado no servidor.',
    })
  }

  try {
    const customToken = await firebaseAdmin.auth().createCustomToken(req.userId, {
      virlaUserId: req.userId,
    })
    res.status(200).json({
      token: customToken,
      projectId: process.env.FIREBASE_PROJECT_ID,
    })
  } catch (e) {
    authLogger.error('firebase:token_failed', { error: e.message, stack: e.stack, userId: req.userId })
    res.status(500).json({ msg: 'Erro ao gerar token de chat em tempo real' })
  }
}
