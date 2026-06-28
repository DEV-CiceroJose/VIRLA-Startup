import crypto from 'crypto'
import dotenv from 'dotenv'
import { logger } from './logger.js'

dotenv.config()

// Algoritmo e chave
const algorithm = 'aes-256-cbc'
const secretKey = process.env.ENCRYPTION_KEY

// A chave precisa ter exatos 32 bytes. Se não tiver, o sistema avisa!
if (!secretKey || secretKey.length !== 32) {
    console.error("ERRO GRAVE: ENCRYPTION_KEY deve ter exatos 32 caracteres no .env")
    process.exit(1)
}

const key = Buffer.from(secretKey, 'utf-8')

// Função para TRANCAR (Criptografar)
export const encrypt = (text) => {
    const iv = crypto.randomBytes(16) // Gera um vetor aleatório para cada mensagem
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    let encrypted = cipher.update(text, 'utf-8', 'hex')
    encrypted += cipher.final('hex')
    // Retorna o IV junto com o texto criptografado (precisamos do IV para destrancar depois)
    return `${iv.toString('hex')}:${encrypted}`
}

// Função para DESTRANCAR (Descriptografar)
export const decrypt = (hash) => {
    try {
        const [ivHex, encryptedText] = hash.split(':')
        if (!ivHex || !encryptedText) return hash // Se não for criptografado (mensagens antigas), retorna normal

        const ivBuffer = Buffer.from(ivHex, 'hex')
        const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer)
        let decrypted = decipher.update(encryptedText, 'hex', 'utf-8')
        decrypted += decipher.final('utf-8')
        return decrypted
    } catch (error) {
        logger.error('crypto:decrypt_failed', { error: error.message })
        return "Mensagem corrompida"
    }
}