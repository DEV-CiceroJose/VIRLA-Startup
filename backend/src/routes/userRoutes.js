import express from "express"
import { createUsers, getFeedUsers, updateUsers, deleteUsers } from "../controllers/userController.js"
import checkToken from '../middlewares/checkToken.js'
import { requireRole } from '../middlewares/requireRole.js'
import { validateZod } from '../middlewares/validateZod.js'
import { rateLimit } from '../middlewares/rateLimit.js'
import { createUserBodySchema, updateUserBodySchema } from '../schemas/userSchemas.js'
const router = express.Router()

// Anti-abuso: no máximo 5 cadastros por minuto por IP.
const registerLimiter = rateLimit({ windowMs: 60_000, max: 5, name: 'register' })

// Cadastro é público (auto-registro), mas validado por Zod + rate limit.
router.post('/users', registerLimiter, validateZod(createUserBodySchema), createUsers)

// CORREÇÃO DE SEGURANÇA (Broken Access Control):
// as rotas abaixo expunham/alteravam dados de QUALQUER usuário sem autenticação.
// Agora exigem token; update/delete também verificam posse (ownership) no controller.
// (A listagem geral GET /users foi removida: dump de todas as contas sem uso real
// no frontend e sem papel de admin para justificá-la.)
router.put('/users/:id', checkToken, validateZod(updateUserBodySchema), updateUsers)
router.delete('/users/:id', checkToken, deleteUsers)

// Sprint 4: o feed de perfis de Familiar deixou de ser navegável pelo Cuidador —
// ele passa a interagir exclusivamente via Solicitações (/solicitacoes/disponiveis).
// O Familiar continua usando o feed normalmente para encontrar Cuidadores.
router.get('/users/:id/feed', checkToken, requireRole('FAMILIAR'), getFeedUsers)

export default router