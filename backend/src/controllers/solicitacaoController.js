import * as solicitacaoRepo from '../repositories/solicitacaoRepository.js'
import { getUserById, listByIds } from '../repositories/userRepository.js'
import { logger } from '../lib/logger.js'
import * as notificationService from '../services/notificationService.js'
import { getBySolicitacaoId as getServiceReportBySolicitacaoId } from '../repositories/serviceReportRepository.js'
import {
  scoreCaregiverForSolicitacao,
  selectSolicitacoesForCaregiver,
} from '../services/matchingService.js'

/** Projeção do familiar embutido (substitui o join `familiar` do Prisma). */
function pickFamiliar(user) {
  if (!user) return null
  return { id: user.id, name: user.name, city: user.city ?? null, state: user.state ?? null }
}

/**
 * POST /solicitacoes
 * FAMILIAR (requireRole): cria uma nova solicitação de cuidado.
 */
export const createSolicitacao = async (req, res) => {
  try {
    const familiarId = req.userId
    const { titulo, descricao, tipoCuidado, cidade, estado, urgencia, valorHora, turno, frequencia, paymentRecurrence, dataInicio } = req.body

    const solicitacao = await solicitacaoRepo.create({
      familiarId,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      tipoCuidado,
      cidade: cidade?.trim() || null,
      estado: estado?.trim().toUpperCase() || null,
      urgencia,
      valorHora: Number(valorHora),
      turno: turno || null,
      frequencia: frequencia || null,
      paymentRecurrence,
      dataInicio: dataInicio || null,
    })

    return res.status(201).json({ solicitacao })
  } catch (err) {
    logger.error('solicitacao:create_failed', {
      error: err.message,
      stack: err.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    return res.status(500).json({ msg: 'Erro ao criar solicitação.' })
  }
}

/**
 * PUT /solicitacoes/:id
 * FAMILIAR (dono): edita uma solicitação própria, enquanto ela ainda não
 * estiver em andamento/concluída/cancelada — evita editar algo que o
 * cuidador já está atendendo.
 */
export const updateSolicitacao = async (req, res) => {
  try {
    const { id } = req.params
    const existing = await solicitacaoRepo.getById(id)
    if (!existing) {
      return res.status(404).json({ msg: 'Solicitação não encontrada.' })
    }
    if (existing.familiarId !== req.userId) {
      return res.status(403).json({ msg: 'Você só pode editar suas próprias solicitações.' })
    }
    if (!['ABERTA', 'VISUALIZADA'].includes(existing.status)) {
      return res.status(422).json({ msg: 'Esta solicitação não pode mais ser editada.' })
    }

    const { titulo, descricao, tipoCuidado, cidade, estado, urgencia, valorHora, turno, frequencia, paymentRecurrence, dataInicio } = req.body

    const updated = await solicitacaoRepo.update(id, {
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      tipoCuidado,
      cidade: cidade?.trim() || null,
      estado: estado?.trim().toUpperCase() || null,
      urgencia,
      valorHora: Number(valorHora),
      turno: turno || null,
      frequencia: frequencia || null,
      paymentRecurrence,
      dataInicio: dataInicio || null,
    })

    return res.status(200).json({ solicitacao: updated })
  } catch (err) {
    logger.error('solicitacao:update_failed', {
      error: err.message,
      stack: err.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    return res.status(500).json({ msg: 'Erro ao atualizar solicitação.' })
  }
}

/**
 * PATCH /solicitacoes/:id/assumir
 * CUIDADOR: assume o serviço de uma solicitação que já visualizou.
 * Sprint "fluxo completo": fecha a lacuna em que a solicitação ficava
 * presa em VISUALIZADA para sempre, sem nenhuma forma de avançar.
 */
export const assumirSolicitacao = async (req, res) => {
  try {
    const { id } = req.params
    // Transação atômica no repositório: previne que dois cuidadores assumam a
    // mesma solicitação simultaneamente (race condition no read→check→write).
    const updated = await solicitacaoRepo.assumir(id, req.userId)
    try {
      const actor = await getUserById(req.userId)
      await notificationService.notifySolicitacao(req.app.get('io'), {
        userId: updated.familiarId,
        type: 'SOLICITACAO_ASSUMIDA',
        solicitacaoId: updated.id,
        solicitacaoTitulo: updated.titulo,
        actorId: req.userId,
        actorName: actor?.name ?? null,
      })
    } catch (err) {
      logger.error('notification:assumir_failed', { error: err.message, userId: req.userId })
    }
    return res.status(200).json({ solicitacao: updated })
  } catch (err) {
    if (err instanceof solicitacaoRepo.SolicitacaoError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 422
      return res.status(status).json({ msg: err.message })
    }
    logger.error('solicitacao:assumir_failed', {
      error: err.message,
      stack: err.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    return res.status(500).json({ msg: 'Erro ao assumir solicitação.' })
  }
}

/**
 * PATCH /solicitacoes/:id/concluir
 * FAMILIAR (dono): confirma a conclusão do serviço. Quem consome o
 * serviço confirma — evita que o cuidador se autodeclare concluído.
 */
export const concluirSolicitacao = async (req, res) => {
  try {
    const { id } = req.params
    const solicitacao = await solicitacaoRepo.getById(id)
    if (!solicitacao) {
      return res.status(404).json({ msg: 'Solicitação não encontrada.' })
    }
    if (solicitacao.familiarId !== req.userId) {
      return res.status(403).json({ msg: 'Você só pode concluir suas próprias solicitações.' })
    }
    if (solicitacao.status !== 'EM_ANDAMENTO') {
      return res.status(422).json({ msg: 'Só é possível concluir uma solicitação que está em andamento.' })
    }

    const report = await getServiceReportBySolicitacaoId(id)
    if (!report?.signature?.signedAt || !report?.reportHash) {
      return res.status(409).json({
        msg: 'Para concluir o serviço, revise e assine o relatório diário enviado pelo cuidador.',
        code: 'SERVICE_REPORT_SIGNATURE_REQUIRED',
      })
    }

    const updated = await solicitacaoRepo.update(id, { status: 'CONCLUIDA' })
    try {
      const actor = await getUserById(req.userId)
      await notificationService.notifySolicitacao(req.app.get('io'), {
        userId: solicitacao.assignedCaregiverId,
        type: 'SOLICITACAO_CONCLUIDA',
        solicitacaoId: solicitacao.id,
        solicitacaoTitulo: solicitacao.titulo,
        actorId: req.userId,
        actorName: actor?.name ?? null,
      })
    } catch (err) {
      logger.error('notification:concluir_failed', { error: err.message, userId: req.userId })
    }
    return res.status(200).json({ solicitacao: updated })
  } catch (err) {
    logger.error('solicitacao:concluir_failed', {
      error: err.message,
      stack: err.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    return res.status(500).json({ msg: 'Erro ao concluir solicitação.' })
  }
}

/**
 * GET /solicitacoes/minhas
 * FAMILIAR: lista as próprias solicitações, mais recentes primeiro.
 */
export const listMySolicitacoes = async (req, res) => {
  try {
    const familiarId = req.userId
    const solicitacoes = await solicitacaoRepo.listByFamiliar(familiarId)
    // "interessados" = nº de cuidadores que já visualizaram a solicitação.
    const withCounts = solicitacoes.map((s) => ({
      ...s,
      _count: { interessados: s.viewedByIds?.length ?? 0 },
    }))
    return res.status(200).json({ solicitacoes: withCounts })
  } catch (err) {
    logger.error('solicitacao:list_mine_failed', {
      error: err.message,
      stack: err.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    return res.status(500).json({ msg: 'Erro ao buscar suas solicitações.' })
  }
}

/**
 * GET /solicitacoes/:id
 * Dono (familiar) ou cuidador autenticado podem visualizar o detalhe.
 */
export const getSolicitacao = async (req, res) => {
  try {
    const { id } = req.params
    const solicitacao = await solicitacaoRepo.getById(id)
    if (!solicitacao) {
      return res.status(404).json({ msg: 'Solicitação não encontrada.' })
    }
    const familiar = pickFamiliar(await getUserById(solicitacao.familiarId))
    return res.status(200).json({ solicitacao: { ...solicitacao, familiar } })
  } catch (err) {
    logger.error('solicitacao:get_failed', {
      error: err.message,
      stack: err.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    return res.status(500).json({ msg: 'Erro ao buscar solicitação.' })
  }
}

/**
 * PUT /solicitacoes/:id/cancelar
 * FAMILIAR (dono): cancela uma solicitação própria, se ainda não concluída.
 */
export const cancelSolicitacao = async (req, res) => {
  try {
    const { id } = req.params
    const solicitacao = await solicitacaoRepo.getById(id)
    if (!solicitacao) {
      return res.status(404).json({ msg: 'Solicitação não encontrada.' })
    }
    if (solicitacao.familiarId !== req.userId) {
      return res.status(403).json({ msg: 'Você só pode cancelar suas próprias solicitações.' })
    }
    if (['CONCLUIDA', 'CANCELADA'].includes(solicitacao.status)) {
      return res.status(422).json({ msg: 'Esta solicitação não pode mais ser cancelada.' })
    }

    const updated = await solicitacaoRepo.update(id, { status: 'CANCELADA' })
    if (solicitacao.assignedCaregiverId) {
      try {
        const actor = await getUserById(req.userId)
        await notificationService.notifySolicitacao(req.app.get('io'), {
          userId: solicitacao.assignedCaregiverId,
          type: 'SOLICITACAO_CANCELADA',
          solicitacaoId: solicitacao.id,
          solicitacaoTitulo: solicitacao.titulo,
          actorId: req.userId,
          actorName: actor?.name ?? null,
        })
      } catch (err) {
        logger.error('notification:cancelar_failed', { error: err.message, userId: req.userId })
      }
    }
    return res.status(200).json({ solicitacao: updated })
  } catch (err) {
    logger.error('solicitacao:cancel_failed', {
      error: err.message,
      stack: err.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    return res.status(500).json({ msg: 'Erro ao cancelar solicitação.' })
  }
}

/**
 * GET /solicitacoes/disponiveis
 * CUIDADOR: lista solicitações ainda abertas, mais as que este cuidador
 * já assumiu (EM_ANDAMENTO) — senão elas "desapareceriam" da tela dele
 * depois de assumidas.
 */
export const listAvailableSolicitacoes = async (req, res) => {
  try {
    const caregiverId = req.userId
    const [base, caregiver] = await Promise.all([
      solicitacaoRepo.listAvailableForCaregiver(caregiverId),
      getUserById(caregiverId),
    ])
    if (!caregiver) return res.status(404).json({ msg: 'Cuidador não encontrado.' })

    // Enriququece com os dados do familiar (substitui o join do Prisma),
    // buscando os usuários em lote.
    const familiarById = new Map(
      (await listByIds([...new Set(base.map((s) => s.familiarId))])).map((u) => [u.id, u])
    )
    const scored = base.map((s) => ({
      ...s,
      familiar: pickFamiliar(familiarById.get(s.familiarId)),
      match: scoreCaregiverForSolicitacao(caregiver, s),
    }))
    const { solicitacoes, policy: matchPolicy } = selectSolicitacoesForCaregiver(scored, caregiverId)
    return res.status(200).json({ solicitacoes, matchPolicy })
  } catch (err) {
    logger.error('solicitacao:list_available_failed', {
      error: err.message,
      stack: err.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    return res.status(500).json({ msg: 'Erro ao buscar solicitações disponíveis.' })
  }
}

/**
 * PUT /solicitacoes/:id/visualizar
 * CUIDADOR: marca a solicitação como visualizada por ele.
 */
export const markSolicitacaoViewed = async (req, res) => {
  try {
    const { id } = req.params
    // Transação atômica: evita perder visualizações concorrentes no array.
    const updated = await solicitacaoRepo.markViewed(id, req.userId)
    return res.status(200).json({ solicitacao: updated })
  } catch (err) {
    if (err instanceof solicitacaoRepo.SolicitacaoError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 422
      return res.status(status).json({ msg: err.message })
    }
    logger.error('solicitacao:mark_viewed_failed', {
      error: err.message,
      stack: err.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    return res.status(500).json({ msg: 'Erro ao marcar solicitação como visualizada.' })
  }
}
