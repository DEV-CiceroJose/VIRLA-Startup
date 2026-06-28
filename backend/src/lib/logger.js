import { createLogger, format, transports, addColors } from 'winston'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'

// ─── Diretório de logs ────────────────────────────────────────────
const LOG_DIR = process.env.LOG_DIR || 'logs'
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })

// ─── Níveis customizados (DEBUG, INFO, WARN, ERROR, FATAL) ─────────
// Quanto menor o número, maior a severidade. `level` filtra tudo que for
// numericamente <= ao configurado.
const levels = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4 }
const colors = { fatal: 'magenta bold', error: 'red', warn: 'yellow', info: 'green', debug: 'blue' }
addColors(colors)

// ─── Rotação automática ────────────────────────────────────────────
// O transport File do winston faz rotação por tamanho nativamente:
// ao atingir `maxsize`, cria app1.log, app2.log... e descarta os mais
// antigos além de `maxFiles`. `tailable: true` mantém o arquivo "base"
// sempre como o mais recente.
const ROTATION = {
  maxsize: Number(process.env.LOG_MAX_SIZE) || 5 * 1024 * 1024, // 5MB por arquivo
  maxFiles: Number(process.env.LOG_MAX_FILES) || 5, // mantém 5 arquivos por stream
  tailable: true,
}

// Formato estruturado em JSON (timestamp, level, message, stack, metadados).
const jsonFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.json(),
)

const makeFileTransport = (filename, level) =>
  new transports.File({
    filename: path.join(LOG_DIR, filename),
    level,
    ...ROTATION,
  })

const consoleTransport = new transports.Console({
  level: process.env.LOG_LEVEL || 'debug',
  format: format.combine(
    format.colorize({ all: true }),
    format.timestamp({ format: 'HH:mm:ss' }),
    format.printf(({ timestamp, level, message, ...meta }) => {
      const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
      return `${timestamp} ${level} ${message}${rest}`
    }),
  ),
})

// ─── Logger principal da aplicação ─────────────────────────────────
export const logger = createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  transports: [
    consoleTransport,
    makeFileTransport('app.log', 'info'),
    makeFileTransport('errors.log', 'error'),
  ],
  // Erros não tratados dentro do próprio winston não derrubam o processo.
  exitOnError: false,
})

// ─── Logger de autenticação (login, logout, cadastro, tokens) ──────
export const authLogger = createLogger({
  levels,
  level: 'info',
  format: jsonFormat,
  transports: [
    consoleTransport,
    makeFileTransport('auth.log', 'info'),
    makeFileTransport('errors.log', 'error'),
  ],
})

// ─── Logger de mensagens / chat ────────────────────────────────────
export const messageLogger = createLogger({
  levels,
  level: 'info',
  format: jsonFormat,
  transports: [
    makeFileTransport('messages.log', 'info'),
    makeFileTransport('errors.log', 'error'),
  ],
})

// ─── Logger de segurança (CORS, acesso negado, assinaturas, abusos) ─
export const securityLogger = createLogger({
  levels,
  level: 'info',
  format: jsonFormat,
  transports: [
    consoleTransport,
    makeFileTransport('security.log', 'info'),
    makeFileTransport('errors.log', 'error'),
  ],
})

/**
 * Normaliza um erro para o formato JSON estruturado solicitado
 * (timestamp, level, message, stack, userId, endpoint, file, line).
 * Extrai arquivo e linha da primeira frame do stack trace.
 *
 * @param {Error} error
 * @param {{ userId?: string, endpoint?: string }} [ctx]
 */
export function formatError(error, ctx = {}) {
  const stack = error?.stack ?? ''
  // Ex.: "at fn (file:///.../src/x.js:42:13)" → captura arquivo:linha
  const frame = stack.split('\n')[1] ?? ''
  const match = frame.match(/\(?(.*?):(\d+):(\d+)\)?\s*$/)
  return {
    message: error?.message ?? String(error),
    stack,
    file: match?.[1] ?? null,
    line: match?.[2] ? Number(match[2]) : null,
    userId: ctx.userId ?? null,
    endpoint: ctx.endpoint ?? null,
  }
}

export default logger
