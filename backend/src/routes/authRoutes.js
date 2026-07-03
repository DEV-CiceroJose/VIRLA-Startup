import express from "express"
import { getUserById, getCurrentUser } from "../controllers/authController.js"
import { checkToken, checkTokenAllowUnverified } from "../middlewares/checkToken.js"

const router = express.Router()

// Perfil do próprio usuário (permite e-mail não verificado: usado para decidir
// o fluxo de "completar cadastro" logo após o signup).
router.get('/users/me', checkTokenAllowUnverified, getCurrentUser)
router.get('/users/:id', checkToken, getUserById)

export default router
