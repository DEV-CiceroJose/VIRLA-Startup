import dotenv from 'dotenv'
import { stripCpf } from '../utils/cpf.js'
import { isValidEmail } from '../utils/email.js'
import { logger } from '../lib/logger.js'

dotenv.config()

const ABACATEPAY_API_URL = 'https://api.abacatepay.com/v1'
const API_TOKEN = process.env.ABACATEPAY_TOKEN

if (!API_TOKEN) {
  logger.warn('abacatepay:token_missing', { msg: 'ABACATEPAY_TOKEN não configurado.' })
}

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_TOKEN}`,
  }
}

function getFrontendBaseUrl() {
  return (process.env.FRONTEND_URL ?? 'http://localhost:5173').trim().replace(/\/$/, '')
}

function normalizeQrBase64(raw) {
  if (!raw) return ''
  if (raw.startsWith('data:')) {
    const comma = raw.indexOf(',')
    return comma === -1 ? raw : raw.slice(comma + 1)
  }
  return raw
}

export function validateEmail(email) {
  return isValidEmail(email)
}

export function validateTaxId(value) {
  const cleaned = String(value ?? '').replace(/\D/g, '')
  return { valid: cleaned.length === 11, cleaned, type: cleaned.length === 11 ? 'CPF' : null }
}

async function abacatePost(path, body, label = path) {
  const url = `${ABACATEPAY_API_URL}${path}`
  // Não logamos o corpo (contém PII: CPF, e-mail, nome) — apenas metadados.
  logger.debug('abacatepay:request', { label, amount: body?.amount, products: body?.products?.length })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const data = await res.json().catch(() => ({}))
    logger.info('abacatepay:response', { label, status: res.status, ok: res.ok })
    if (!res.ok) {
      const msg = data?.error ?? data?.message ?? data?.msg ?? `AbacatePay ${label} HTTP ${res.status}`
      const error = new Error(msg)
      error.status = res.status
      error.responseBody = data
      throw error
    }
    return data?.data ?? data
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('AbacatePay: timeout na requisição.')
    }
    throw new Error(`AbacatePay: falha de rede — ${err.message}`)
  } finally {
    clearTimeout(timeout)
  }
}

export function buildBillingPayload({
  user,
  amount,
  description = 'Serviço Virla',
  returnUrl = getFrontendBaseUrl(),
  completionUrl = `${getFrontendBaseUrl()}/pagamento/sucesso`,
  frequency = 'ONE_TIME',
  expiresIn = 300,
  externalId,
} = {}) {
  const taxIdResult = validateTaxId(user.taxId)
  if (!taxIdResult.valid) throw new Error(`CPF inválido: "${user.taxId}".`)
  if (!validateEmail(user.email)) throw new Error(`E-mail inválido: "${user.email}".`)
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Valor inválido: ${amount}. Informe centavos inteiros positivos.`)
  }

  const payload = {
    externalId: externalId ?? `virla-${Date.now()}`,
    frequency,
    methods: ['PIX'],
    products: [
      {
        externalId: `virla-${Date.now()}`,
        name: description,
        quantity: 1,
        price: amount,
      },
    ],
    returnUrl,
    completionUrl,
    expiresIn,
  }

  const cellphone = user.cellphone ? String(user.cellphone).replace(/\D/g, '') : ''
  if (user.name && validateEmail(user.email)) {
    payload.customer = {
      name: user.name,
      email: user.email,
      taxId: stripCpf(taxIdResult.cleaned),
      ...(cellphone && { cellphone }),
    }
  }

  return payload
}

export function buildPixQrCodePayload({ user, amount, description = 'Serviço Virla', metadata, expiresInSeconds = 300 } = {}) {
  const taxIdResult = validateTaxId(user.taxId)
  if (!taxIdResult.valid) throw new Error(`CPF inválido: "${user.taxId}".`)
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Valor inválido: ${amount}. Informe centavos inteiros positivos.`)
  }

  const payload = {
    amount,
    description: String(description).slice(0, 37),
    expires_in: expiresInSeconds,
    ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
  }

  const cellphone = user.cellphone ? String(user.cellphone).replace(/\D/g, '') : ''
  if (user.name && validateEmail(user.email)) {
    payload.customer = {
      name: user.name,
      email: user.email,
      taxId: stripCpf(taxIdResult.cleaned),
      ...(cellphone && { cellphone }),
    }
  }

  return payload
}

function mapPixResponse(pix, { gatewayBillingId = null, checkoutUrl = '' } = {}) {
  return {
    billingId: pix.id,
    gatewayBillingId,
    pixCode: pix.brCode ?? pix.pixQrCode ?? pix.pix?.code ?? '',
    qrCodeBase64: normalizeQrBase64(pix.brCodeBase64 ?? pix.pixQrCodeBase64 ?? pix.pix?.qrCodeBase64 ?? ''),
    checkoutUrl: checkoutUrl || pix.url || pix.checkoutUrl || '',
    status: pix.status ?? 'PENDING',
    expiresAt: pix.expiresAt ?? pix.expireAt ?? null,
    devMode: pix.devMode ?? false,
    rawResponse: pix,
  }
}

export async function createHostedBilling(params) {
  const externalId = `virla-${Date.now()}`
  const payload = buildBillingPayload({ ...params, externalId })
  const billing = await abacatePost('/billing/create', payload, 'billing/create')
  logger.info('abacatepay:billing_created', { id: billing.id, devMode: billing.devMode ?? null })
  return billing
}

export async function createPixQrCharge(params, { linkedBillingId } = {}) {
  const metadata = {
    virlaSource: 'virla-app',
    ...(linkedBillingId && { virlaBillingId: linkedBillingId }),
  }
  const payload = buildPixQrCodePayload({ ...params, metadata, expiresInSeconds: 300 })
  const pix = await abacatePost('/pixQrCode/create', payload, 'pixQrCode/create')
  logger.info('abacatepay:pix_created', { id: pix.id, devMode: pix.devMode ?? null })
  return pix
}

export async function createBilling(params) {
  const externalId = `virla-${Date.now()}`

  const hosted = await createHostedBilling({ ...params, externalId }).catch((err) => {
    logger.error('abacatepay:billing_create_failed', { error: err.message, status: err.status })
    throw err
  })

  const pix = await createPixQrCharge(params, { linkedBillingId: hosted.id }).catch((err) => {
    logger.error('abacatepay:pix_create_failed', { error: err.message, status: err.status })
    throw err
  })

  return mapPixResponse(pix, { gatewayBillingId: hosted.id, checkoutUrl: hosted.url ?? hosted.checkoutUrl })
}

export async function getBillingStatus(billingId) {
  const url = `${ABACATEPAY_API_URL}/pixQrCode/check?id=${encodeURIComponent(billingId)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // Timeout de 8 segundos

  try {
    const res = await fetch(url, { 
      method: 'GET', 
      headers: buildHeaders(),
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`AbacatePay status check failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
    }
    
    const payload = data?.data ?? data;
    return { 
      status: payload.status ?? 'PENDING', 
      expiresAt: payload.expiresAt ?? payload.expireAt ?? null 
    };

  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err.name === 'AbortError') {
      logger.warn('abacatepay:status_timeout', { billingId });
      return { status: 'PENDING', expiresAt: null };
    }
    
    throw err;
  }
}