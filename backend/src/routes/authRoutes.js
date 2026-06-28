import express from "express"
import { LoginUser, getUserById } from "../controllers/authController.js"
import { checkToken } from "../middlewares/checkToken.js"
import { validateZod } from '../middlewares/validateZod.js'
import { rateLimit } from '../middlewares/rateLimit.js'
import { loginBodySchema } from '../schemas/authSchemas.js'

const router = express.Router()

// Anti força-bruta: no máximo 10 tentativas de login por minuto por IP.
const loginLimiter = rateLimit({ windowMs: 60_000, max: 10, name: 'login' })

router.post('/auth/login', loginLimiter, validateZod(loginBodySchema), LoginUser)
router.get('/users/:id', checkToken, getUserById);

export default router