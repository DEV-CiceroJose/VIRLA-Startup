// Feature flags do frontend.
//
// Sprint 6: permite gerar uma build sem o fluxo de pagamento (botão "Gerar
// Cobrança", "Pagar", banner de cobrança pendente e as páginas /pagamento),
// sem remover ou alterar nenhuma lógica de pagamento/escrow no backend.
//
// Decisão atual: o fluxo de pagamento fica OCULTO por padrão (botões de
// pagamento não aparecem nem para o cuidador nem para o familiar). Para
// reativar a UI de pagamento basta definir VITE_ENABLE_PAYMENT=true.
//
// Uso:
//   VITE_ENABLE_PAYMENT=true   -> build completa, com UI de pagamento
//   (qualquer outro valor ou ausência) -> build sem vestígio visual de pagamento

export const PAYMENT_ENABLED = import.meta.env.VITE_ENABLE_PAYMENT === 'true'
