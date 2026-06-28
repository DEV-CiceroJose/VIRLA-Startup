import * as solicitacaoRepo from '../repositories/solicitacaoRepository.js'
import { getUserById, listByIds } from '../repositories/userRepository.js'
import { logger } from '../lib/logger.js'

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
    const { titulo, descricao, tipoCuidado, cidade, estado, urgencia } = req.body

    const solicitacao = await solicitacaoRepo.create({
      familiarId,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      tipoCuidado,
      cidade: cidade?.trim() || null,
      estado: estado?.trim().toUpperCase() || null,
      urgencia,
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

    const { titulo, descricao, tipoCuidado, cidade, estado, urgencia } = req.body

    const updated = await solicitacaoRepo.update(id, {
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      tipoCuidado,
      cidade: cidade?.trim() || null,
      estado: estado?.trim().toUpperCase() || null,
      urgencia,
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
    const caregiverId = req.userId

    const solicitacao = await solicitacaoRepo.getById(id)
    if (!solicitacao) {
      return res.status(404).json({ msg: 'Solicitação não encontrada.' })
    }
    if (!['ABERTA', 'VISUALIZADA'].includes(solicitacao.status)) {
      return res.status(422).json({ msg: 'Esta solicitação já foi assumida, concluída ou cancelada.' })
    }

    const viewedByIds = solicitacao.viewedByIds.includes(caregiverId)
      ? solicitacao.viewedByIds
      : [...solicitacao.viewedByIds, caregiverId]

    const updated = await solicitacaoRepo.update(id, {
      status: 'EM_ANDAMENTO',
      assignedCaregiverId: caregiverId,
      viewedByIds,
    })
    return res.status(200).json({ solicitacao: updated })
  } catch (err) {
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

    const updated = await solicitacaoRepo.update(id, { status: 'CONCLUIDA' })
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
    const base = await solicitacaoRepo.listAvailableForCaregiver(caregiverId)

    // Enriququece com os dados do familiar (substitui o join do Prisma),
    // buscando os usuários em lote.
    const familiarById = new Map(
      (await listByIds([...new Set(base.map((s) => s.familiarId))])).map((u) => [u.id, u])
    )
    const solicitacoes = base.map((s) => ({
      ...s,
      familiar: pickFamiliar(familiarById.get(s.familiarId)),
    }))
    return res.status(200).json({ solicitacoes })
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
    const caregiverId = req.userId

    const solicitacao = await solicitacaoRepo.getById(id)
    if (!solicitacao) {
      return res.status(404).json({ msg: 'Solicitação não encontrada.' })
    }

    const alreadyViewed = solicitacao.viewedByIds.includes(caregiverId)
    const updated = await solicitacaoRepo.update(id, {
      viewedByIds: alreadyViewed ? solicitacao.viewedByIds : [...solicitacao.viewedByIds, caregiverId],
      status: solicitacao.status === 'ABERTA' ? 'VISUALIZADA' : solicitacao.status,
    })
    return res.status(200).json({ solicitacao: updated })
  } catch (err) {
    logger.error('solicitacao:mark_viewed_failed', {
      error: err.message,
      stack: err.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    return res.status(500).json({ msg: 'Erro ao marcar solicitação como visualizada.' })
  }
}
