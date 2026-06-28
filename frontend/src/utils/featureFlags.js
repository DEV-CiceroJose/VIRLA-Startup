// Feature flags do frontend.
//
// Sprint 6: permite gerar uma build sem o fluxo de pagamento (botão "Gerar
// Cobrança", "Pagar", banner de cobrança pendente e as páginas /pagamento),
// sem remover ou alterar nenhuma lógica de pagamento/escrow no backend.
//
// Uso:
//   VITE_ENABLE_PAYMENT=true   -> build completa (padrão, se a var não existir)
//   VITE_ENABLE_PAYMENT=false  -> build sem nenhum vestígio visual de pagamento

export const PAYMENT_ENABLED = import.meta.env.VITE_ENABLE_PAYMENT !== 'false'
