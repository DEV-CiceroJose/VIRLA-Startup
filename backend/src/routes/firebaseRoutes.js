import express from 'express'
import checkToken from '../middlewares/checkToken.js'
import { getFirebaseToken } from '../controllers/firebaseController.js'

const router = express.Router()

// Usado pelo frontend logo após o login (ou ao entrar no Chat) para obter
// um Custom Token e autenticar no Firebase Auth/Realtime Database.
router.get('/firebase/token', checkToken, getFirebaseToken)

export default router
