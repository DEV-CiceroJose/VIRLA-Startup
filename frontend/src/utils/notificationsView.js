/**
 * Apresentação das notificações (PROD-03): texto exibido e destino ao clicar.
 * `type` espelha backend/src/utils/notificationTypes.js.
 */

/** Texto legível de uma notificação. */
export function notificationText(n) {
  switch (n.type) {
    case 'MESSAGE': {
      const quem = n.senderName ?? 'Alguém'
      const msg = (n.count ?? 1) > 1 ? `${n.count} novas mensagens` : 'nova mensagem'
      return `${quem} — ${msg}`
    }
    case 'SOLICITACAO_ASSUMIDA':
      return `${n.actorName ?? 'Um cuidador'} assumiu "${n.solicitacaoTitulo ?? 'sua solicitação'}"`
    case 'SOLICITACAO_CONCLUIDA':
      return `${n.actorName ?? 'A família'} concluiu "${n.solicitacaoTitulo ?? 'a solicitação'}"`
    case 'SOLICITACAO_CANCELADA':
      return `${n.actorName ?? 'A família'} cancelou "${n.solicitacaoTitulo ?? 'a solicitação'}"`
    default:
      return 'Nova notificação'
  }
}

/** Rota de destino ao clicar na notificação. */
export function notificationHref(n) {
  switch (n.type) {
    case 'MESSAGE':
      return `/chat/${n.senderId}`
    case 'SOLICITACAO_ASSUMIDA':
      return '/solicitacoes'
    case 'SOLICITACAO_CONCLUIDA':
    case 'SOLICITACAO_CANCELADA':
      return '/solicitacoes-disponiveis'
    default:
      return '/home'
  }
}
