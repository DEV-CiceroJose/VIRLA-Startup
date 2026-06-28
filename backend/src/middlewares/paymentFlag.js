// Sprint 6 — defesa em profundidade: mesmo que a UI esconda os botões de
// cobrança/pagamento (VITE_ENABLE_PAYMENT=false no frontend), uma build
// "sem pagamento" também pode travar a criação de novas cobranças/billing
// no backend definindo ENABLE_PAYMENT=false.
//
// Não bloqueia leituras (pending/escrow/auditoria) nem o webhook do
// AbacatePay — isso evitaria reconciliar pagamentos já em andamento.
export const PAYMENT_ENABLED = process.env.ENABLE_PAYMENT !== 'false'

export function requirePaymentEnabled(req, res, next) {
  if (!PAYMENT_ENABLED) {
    return res.status(403).json({ msg: 'O fluxo de pagamento está desativado nesta instância.' })
  }
  next()
}
