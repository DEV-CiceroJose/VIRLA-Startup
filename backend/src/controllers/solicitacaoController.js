import prisma from '../lib/prisma.js'
import { logger } from '../lib/logger.js'

const PUBLIC_SELECT = {
  id: true,
  familiarId: true,
  titulo: true,
  descricao: true,
  tipoCuidado: true,
  cidade: true,
  estado: true,
  urgencia: true,
  status: true,
  viewedByIds: true,
  assignedCaregiverId: true,
  createdAt: true,
  updatedAt: true,
}

/**
 * POST /solicitacoes
 * FAMILIAR (requireRole): cria uma nova solicitação de cuidado.
 */
export const createSolicitacao = async (req, res) => {
  try {
    const familiarId = req.userId
    const { titulo, descricao, tipoCuidado, cidade, estado, urgencia } = req.body

    const solicitacao = await prisma.solicitacao.create({
      data: {
        familiarId,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        tipoCuidado,
        cidade: cidade?.trim() || null,
        estado: estado?.trim().toUpperCase() || null,
        urgencia,
      },
      select: PUBLIC_SELECT,
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
    const existing = await prisma.solicitacao.findUnique({ where: { id } })
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

    const updated = await prisma.solicitacao.update({
      where: { id },
      data: {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        tipoCuidado,
        cidade: cidade?.trim() || null,
        estado: estado?.trim().toUpperCase() || null,
        urgencia,
      },
      select: PUBLIC_SELECT,
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

    const solicitacao = await prisma.solicitacao.findUnique({ where: { id } })
    if (!solicitacao) {
      return res.status(404).json({ msg: 'Solicitação não encontrada.' })
    }
    if (!['ABERTA', 'VISUALIZADA'].includes(solicitacao.status)) {
      return res.status(422).json({ msg: 'Esta solicitação já foi assumida, concluída ou cancelada.' })
    }

    const viewedByIds = solicitacao.viewedByIds.includes(caregiverId)
      ? solicitacao.viewedByIds
      : [...solicitacao.viewedByIds, caregiverId]

    const updated = await prisma.solicitacao.update({
      where: { id },
      data: {
        status: 'EM_ANDAMENTO',
        assignedCaregiverId: caregiverId,
        viewedByIds,
      },
      select: PUBLIC_SELECT,
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
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id } })
    if (!solicitacao) {
      return res.status(404).json({ msg: 'Solicitação não encontrada.' })
    }
    if (solicitacao.familiarId !== req.userId) {
      return res.status(403).json({ msg: 'Você só pode concluir suas próprias solicitações.' })
    }
    if (solicitacao.status !== 'EM_ANDAMENTO') {
      return res.status(422).json({ msg: 'Só é possível concluir uma solicitação que está em andamento.' })
    }

    const updated = await prisma.solicitacao.update({
      where: { id },
      data: { status: 'CONCLUIDA' },
      select: PUBLIC_SELECT,
    })
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
    const solicitacoes = await prisma.solicitacao.findMany({
      where: { familiarId },
      orderBy: { createdAt: 'desc' },
      select: PUBLIC_SELECT,
    })
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
    const solicitacao = await prisma.solicitacao.findUnique({
      where: { id },
      select: { ...PUBLIC_SELECT, familiar: { select: { id: true, name: true, city: true, state: true } } },
    })
    if (!solicitacao) {
      return res.status(404).json({ msg: 'Solicitação não encontrada.' })
    }
    return res.status(200).json({ solicitacao })
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
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id } })
    if (!solicitacao) {
      return res.status(404).json({ msg: 'Solicitação não encontrada.' })
    }
    if (solicitacao.familiarId !== req.userId) {
      return res.status(403).json({ msg: 'Você só pode cancelar suas próprias solicitações.' })
    }
    if (['CONCLUIDA', 'CANCELADA'].includes(solicitacao.status)) {
      return res.status(422).json({ msg: 'Esta solicitação não pode mais ser cancelada.' })
    }

    const updated = await prisma.solicitacao.update({
      where: { id },
      data: { status: 'CANCELADA' },
      select: PUBLIC_SELECT,
    })
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
    const solicitacoes = await prisma.solicitacao.findMany({
      where: {
        OR: [
          { status: { in: ['ABERTA', 'VISUALIZADA'] } },
          { status: 'EM_ANDAMENTO', assignedCaregiverId: caregiverId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { ...PUBLIC_SELECT, familiar: { select: { id: true, name: true, city: true, state: true } } },
    })
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

    const solicitacao = await prisma.solicitacao.findUnique({ where: { id } })
    if (!solicitacao) {
      return res.status(404).json({ msg: 'Solicitação não encontrada.' })
    }

    const alreadyViewed = solicitacao.viewedByIds.includes(caregiverId)
    const updated = await prisma.solicitacao.update({
      where: { id },
      data: {
        viewedByIds: alreadyViewed ? solicitacao.viewedByIds : [...solicitacao.viewedByIds, caregiverId],
        status: solicitacao.status === 'ABERTA' ? 'VISUALIZADA' : solicitacao.status,
      },
      select: PUBLIC_SELECT,
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
