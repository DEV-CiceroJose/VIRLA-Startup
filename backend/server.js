import 'dotenv/config'
import http from 'http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { Server as SocketServer } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'

import userRoutes from './src/routes/userRoutes.js'
import authRoutes from './src/routes/authRoutes.js'
import messageRoutes from './src/routes/messageRoutes.js'
import PaymentRoutes from './src/routes/paymentRoutes.js'
import firebaseRoutes from './src/routes/firebaseRoutes.js'
import solicitacaoRoutes from './src/routes/solicitacaoRoutes.js'

import { logger, securityLogger } from './src/lib/logger.js'
import { requestLogger } from './src/middlewares/requestLogger.js'
import { healthCheck, dashboard } from './src/controllers/observabilityController.js'
import { socketAuthMiddleware, registerConnectionEvents } from './src/events/authEvents.js'
import { registerMessageEvents } from './src/events/messageEvents.js'

// ─── Resolve __dirname in ES Modules ─────────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3002
const NODE_ENV = process.env.NODE_ENV || 'development'
const IS_PROD = NODE_ENV === 'production'

// ─── CORS: Lista de origens permitidas ───────────────────────────
//
// CORREÇÃO 1: Separar a lista de origens CORS num Set para lookup O(1).
// O bug original: se FRONTEND_URL não estivesse definido, a lista ficava
// incompleta e origens válidas do Render eram bloqueadas com HTTP 500
// (porque `new Error()` no callback do cors vai para o error handler global,
// não retorna 403 como seria esperado).
//
const allowedOriginsSet = new Set([
  'http://localhost:5173', // Vite dev
  'http://localhost:3000',
  'https://virla-app.onrender.com', // Frontend na Render
])

// Injeta variável de ambiente limpando espaços e barras no final
if (process.env.FRONTEND_URL) {
  allowedOriginsSet.add(process.env.FRONTEND_URL.trim().replace(/\/$/, ''))
}

const allowedOrigins = [...allowedOriginsSet]

// Função de validação de origin reutilizada pelo Express e pelo Socket.io
function isOriginAllowed(origin) {
  // Permite requests sem origin (Postman, cURL, webhooks server-to-server)
  if (!origin) return true
  return allowedOriginsSet.has(origin)
}

// Socket.io usa o pacote `cors`, que exige callback — não aceita retorno booleano.
function corsOriginCallback(origin, callback) {
  if (isOriginAllowed(origin)) {
    return callback(null, true)
  }
  securityLogger.warn('cors:socket_blocked', { origin })
  return callback(null, false)
}

// ─── Express app ─────────────────────────────────────────────────
const app = express()

// Atrás do proxy da Render: confia no primeiro hop para que req.ip reflita
// o X-Forwarded-For real (essencial para rate limiting e logs de segurança).
app.set('trust proxy', 1)

// Melhoria #2 — headers de segurança HTTP (CSP, X-Frame-Options, no-sniff,
// HSTS, etc.) que faltavam por completo. `crossOriginResourcePolicy` é
// liberado porque o backend é uma API pura (sem páginas HTML) e serve
// /uploads (imagens/áudio) para o frontend hospedado em outra origem —
// o padrão restritivo do helmet bloquearia esses arquivos cross-origin.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Sem páginas HTML próprias para proteger; o CSP padrão do helmet não
    // tem efeito útil aqui e poderia conflitar com clientes/Swagger futuros.
    contentSecurityPolicy: false,
  }),
)

// CORREÇÃO 2: Retornar 403 em vez de propagar erro para o handler global.
// No original, `return callback(new Error(...))` enviava o erro para o
// middleware de erro do Express, que respondia com HTTP 500 e logava um
// stack trace desnecessário para cada request de origem inválida.
app.use(cors({
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true)
    }
    // Retorna null (sem erro) + false: Express envia 403 automaticamente
    // sem poluir o logger de erros com falsos-positivos
    securityLogger.warn('cors:blocked', { origin })
    return callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // CORREÇÃO 3: Responder pre-flight OPTIONS com 204 sem passar para rotas.
  // Sem isso, OPTIONS pode cair em rotas não configuradas e retornar 404.
  optionsSuccessStatus: 204,
}))

app.use(express.json({ limit: '4mb' }))

// ─── Logging de requisições + métricas (observabilidade) ─────────
app.use(requestLogger)

// ─── Servir pasta uploads publicamente ───────────────────────────
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')))

// ─── Healthcheck + Dashboard de observabilidade ──────────────────
// CORREÇÃO 4 (CRÍTICA para o 502): A Render usa /health para checar se o
// serviço está vivo. Agora ele também verifica banco, memória, CPU e APIs.
app.get('/health', healthCheck)
app.get('/observability/dashboard', dashboard)

// ─── Rotas HTTP ──────────────────────────────────────────────────
app.use(userRoutes)
app.use(authRoutes)
app.use(messageRoutes)
app.use(PaymentRoutes)
app.use(firebaseRoutes)
app.use(solicitacaoRoutes)

// ─── Global error handler ─────────────────────────────────────────
// CORREÇÃO 5: Não retornar stack trace em produção (vaza informação interna).
app.use((err, req, res, _next) => {
  logger.error('http:unhandled_error', {
    error: err.message,
    stack: IS_PROD ? undefined : err.stack,
    path: req.path,
    method: req.method,
  })
  res.status(err.status ?? 500).json({ msg: IS_PROD ? 'Internal server error' : err.message })
})

// ─── HTTP server (compartilhado com Socket.io) ───────────────────
const server = http.createServer(app)

// ─── Socket.io ───────────────────────────────────────────────────
//
// CORREÇÃO 6 (CRÍTICA para o chat): Declarar `transports` explicitamente.
//
// O problema: sem declarar transportes, o Socket.io tenta WebSocket direto.
// Na Render, o proxy reverso (nginx) deles às vezes não propaga o header
// `Upgrade: websocket` corretamente no primeiro handshake — especialmente
// no plano free/starter. Isso faz a conexão falhar silenciosamente ou
// ficar em estado "connecting" indefinidamente no cliente.
//
// A solução: iniciar com 'polling' e deixar o Socket.io fazer o upgrade
// para 'websocket' assim que o handshake HTTP estiver estável.
// ['polling', 'websocket'] = polling primeiro, upgrade automático depois.
//
// IMPORTANTE: o frontend também precisa usar esta ordem:
//   io(URL, { transports: ['polling', 'websocket'] })
//
const io = new SocketServer(server, {
  cors: {
    origin: corsOriginCallback,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  },

  transports: ['polling', 'websocket'],

  // CORREÇÃO 7: Ajustar ping para o ambiente da Render.
  //
  // A Render fecha conexões TCP idle após ~55s (plano free) ou ~75s (paid).
  // Com pingTimeout: 60000, quando o servidor enviava um ping e aguardava
  // 60s pela resposta, a conexão já havia sido fechada pelo proxy da Render
  // (~55s) — o servidor ficava esperando uma resposta que nunca chegaria,
  // e o socket era marcado como "disconnected" após 60s de silêncio.
  // Resultado: mensagens enviadas nessa janela eram perdidas.
  //
  // Valores seguros para Render:
  //   pingInterval: 10s  → servidor pinga o cliente a cada 10s
  //   pingTimeout: 20s   → se não receber pong em 20s, reconecta
  // Isso garante que a conexão "keepalive" acontece bem antes do proxy
  // fechar (~55s), mantendo o canal sempre ativo.
  pingInterval: 10_000,
  pingTimeout: 20_000,

  // CORREÇÃO 8: Aumentar buffer de conexões simultâneas.
  // O padrão (1000) é suficiente para MVP, mas declarar explicitamente
  // facilita ajuste futuro sem surpresas.
  maxHttpBufferSize: 1e6, // 1MB por mensagem (suficiente para imagens em base64 pequenas)

  // allowEIO3: false — só aceita clientes Socket.io v4+ (nosso frontend usa v4)
  allowEIO3: false,
})

// Auth middleware — executa antes de cada conexão
io.use(socketAuthMiddleware)

io.on('connection', (socket) => {
  registerConnectionEvents(socket, io)
  registerMessageEvents(socket, io)
})

// ─── Start server ─────────────────────────────────────────────────
server.listen(PORT, (err) => {
  if (err) {
    logger.error('server:start_failed', { error: err.message })
    process.exit(1)
    return
  }
  logger.info('server:started', { port: PORT, env: NODE_ENV })
})

// ─── Graceful shutdown ───────────────────────────────────────────
//
// CORREÇÃO 9: Fechar o io antes do server, e aguardar as conexões
// ativas drenarem antes de process.exit(). Isso evita que requests
// de pagamento em andamento sejam cortadas abruptamente (causando 502).
//
const SHUTDOWN_TIMEOUT_MS = 10_000 // 10s para requisições ativas terminarem

const shutdown = (signal) => {
  logger.info('server:shutdown_initiated', { signal })

  // 1. Para de aceitar novas conexões WebSocket
  io.close(() => {
    logger.info('server:socketio_closed')
  })

  // 2. Para de aceitar novas conexões HTTP e aguarda as ativas
  server.close(() => {
    logger.info('server:http_closed')
    process.exit(0)
  })

  // 3. Força saída se demorar mais que o timeout (evita travamento na Render)
  setTimeout(() => {
    logger.warn('server:shutdown_timeout', { timeoutMs: SHUTDOWN_TIMEOUT_MS })
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS).unref() // .unref() não impede o Node de sair antes se estiver pronto
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// CORREÇÃO 10: Capturar rejeições não tratadas para evitar crash silencioso
// (que também gera 502 na Render sem log claro).
process.on('unhandledRejection', (reason) => {
  logger.error('process:unhandled_rejection', { reason: String(reason) })
})

process.on('uncaughtException', (err) => {
  logger.error('process:uncaught_exception', { error: err.message, stack: err.stack })
  process.exit(1)
})

export { io }