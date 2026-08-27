import {
  getUserById,
  emailExists,
  cpfExists,
  registerExists,
  createUserWithId,
  updateUser,
  deleteUser,
  listByRole,
} from '../repositories/userRepository.js'
import { firebaseAdmin } from '../lib/firebase.js'
import { project } from '../repositories/_helpers.js'
import { authLogger, logger } from '../lib/logger.js'
import { USER_PUBLIC_SELECT, USER_SELF_SELECT } from '../lib/userSelects.js'
import * as solicitacaoRepo from '../repositories/solicitacaoRepository.js'
import { objectIdSchema } from '../schemas/paymentSchemas.js'
import { rankCaregiversForSolicitacao } from '../services/matchingService.js'

function parseBirthDate(value) {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseHourlyRate(value) {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function emptyToNull(str) {
  if (str == null) return null
  const t = String(str).trim()
  return t === '' ? null : t
}

function parseSpecialties(value) {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value
      .filter((s) => typeof s === 'string')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parseSpecialties(parsed)
    } catch {
      /* ignore */
    }
    return value.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  }
  return []
}

/**
 * POST /users — cria o PERFIL do usuário já autenticado no Firebase Auth.
 * O uid e o e-mail vêm do token verificado (checkTokenAllowUnverified), não do
 * body. Body validado por createUserBodySchema (sem senha/email).
 */
const createUsers = async (req, res) => {
  const uid = req.userId
  const email = req.email
  const {
    name, birthDate: birthDateRaw, role, bio, cpf,
    profileImage, council, hourlyRate: hourlyRateRaw, registerNumber,
    approach, specialties, availableShifts, serviceFrequencies, description, city, state, zipCode,
  } = req.body

  const birthDate = parseBirthDate(birthDateRaw)
  const hourlyRate = parseHourlyRate(hourlyRateRaw)
  if (hourlyRateRaw != null && hourlyRateRaw !== '' && hourlyRate === null) {
    return res.status(422).json({ msg: 'Valor por hora inválido' })
  }

  try {
    // Idempotência: se o perfil já existe (retry), não recria.
    const already = await getUserById(uid)
    if (already) {
      const user = project(already, USER_SELF_SELECT)
      return res.status(200).json({ user })
    }
    if (await emailExists(email, uid)) {
      return res.status(409).json({ msg: 'Este e-mail já está cadastrado' })
    }
    if (await cpfExists(cpf, uid)) {
      return res.status(409).json({ msg: 'Este CPF já está cadastrado' })
    }
    if (council && registerNumber && (await registerExists(council, registerNumber, uid))) {
      return res.status(409).json({ msg: 'Este registro profissional já está cadastrado.' })
    }

    const created = await createUserWithId(uid, {
      name,
      birthDate,
      role,
      bio: bio ?? '',
      email,
      cpf: cpf ?? null,
      profileImage: emptyToNull(profileImage),
      council: role === 'CUIDADOR' ? (council || null) : null,
      registerNumber: emptyToNull(registerNumber),
      hourlyRate,
      specialties: parseSpecialties(specialties),
      availableShifts: parseSpecialties(availableShifts),
      serviceFrequencies: parseSpecialties(serviceFrequencies),
      approach: emptyToNull(approach),
      description: emptyToNull(description),
      city: emptyToNull(city),
      state: emptyToNull(state),
      zipCode: emptyToNull(zipCode),
    })

    // role em custom claim → checkToken/requireRole leem sem read extra no Firestore.
    await firebaseAdmin.auth().setCustomUserClaims(uid, { role })

    const user = project(created, USER_SELF_SELECT)
    authLogger.info('auth:register_success', { userId: uid, role, ip: req.ip })
    return res.status(201).json({ user })
  } catch (error) {
    logger.error('user:create_failed', { error: error.message, stack: error.stack, endpoint: req.originalUrl })
    return res.status(500).json({ msg: 'Erro ao criar conta. Tente novamente.' })
  }
}

const FEED_PAGE_SIZE = 10

const getFeedUsers = async (req, res) => {
  try {
    // Anti-IDOR: usa o usuário autenticado, não o :id da URL — assim ninguém
    // monta o feed a partir do papel/conta de outra pessoa.
    const loggedUserId = req.userId
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
    const limit = FEED_PAGE_SIZE
    const skip = (page - 1) * limit

    const loggedUser = await getUserById(loggedUserId)

    if (!loggedUser) {
      return res.status(404).json({ msg: 'Usuário não encontrado' })
    }

    const oppositeRole = loggedUser.role === 'CUIDADOR' ? 'FAMILIAR' : 'CUIDADOR'
    let matchSolicitacao = null
    if (req.query.solicitacaoId) {
      const parsedId = objectIdSchema.safeParse(req.query.solicitacaoId)
      if (!parsedId.success) {
        return res.status(422).json({ msg: 'Solicitação inválida para o match.' })
      }
      matchSolicitacao = await solicitacaoRepo.getById(parsedId.data)
      if (!matchSolicitacao || matchSolicitacao.familiarId !== loggedUserId) {
        return res.status(404).json({ msg: 'Solicitação não encontrada para o match.' })
      }
    }

    // Paginação por offset emulada: o Firestore não tem offset eficiente, mas
    // o feed tem volume baixo no MVP — buscamos os usuários do papel oposto e
    // recortamos a página em memória. Mantém o contrato `?page=N` do frontend.
    const allOfRole = await listByRole(oppositeRole)
    const ranked = matchSolicitacao
      ? rankCaregiversForSolicitacao(allOfRole, matchSolicitacao)
      : allOfRole.map((caregiver) => ({ caregiver, match: null }))
    const total = ranked.length
    const feedUsers = ranked
      .slice(skip, skip + limit)
      .map(({ caregiver, match }) => ({
        ...project(caregiver, USER_PUBLIC_SELECT),
        ...(match && { match }),
      }))

    const totalPages = Math.max(1, Math.ceil(total / limit))

    res.status(200).json({
      users: feedUsers,
      total,
      totalPages,
      page,
      limit,
      matchContext: matchSolicitacao
        ? { id: matchSolicitacao.id, titulo: matchSolicitacao.titulo }
        : null,
    })
  } catch (error) {
    logger.error('user:feed_failed', {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    res.status(500).json({ msg: 'Erro ao buscar o feed' })
  }
}

const updateUsers = async (req, res) => {
  // Autorização (anti-IDOR): só o próprio dono pode editar seu cadastro.
  if (req.userId !== req.params.id) {
    authLogger.warn('user:update_forbidden', {
      userId: req.userId,
      targetId: req.params.id,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    })
    return res.status(403).json({ msg: 'Você só pode editar o próprio perfil.' })
  }

  const birthDate = req.body.birthDate != null ? parseBirthDate(req.body.birthDate) : undefined
  if (req.body.birthDate != null && req.body.birthDate !== '' && birthDate === null) {
    return res.status(422).json({ msg: 'Data de nascimento inválida' })
  }

  let hourlyRatePatch
  if (req.body.hourlyRate !== undefined) {
    const parsed = parseHourlyRate(req.body.hourlyRate)
    if (req.body.hourlyRate != null && req.body.hourlyRate !== '' && parsed === null) {
      return res.status(422).json({ msg: 'Valor por hora inválido' })
    }
    hourlyRatePatch = { hourlyRate: parsed }
  }

  const data = {
    ...(req.body.name != null && { name: req.body.name }),
    ...(birthDate !== undefined && { birthDate }),
    ...(req.body.bio != null && { bio: req.body.bio }),
    ...(req.body.profileImage !== undefined && { profileImage: req.body.profileImage || null }),
    ...(req.body.council !== undefined && { council: req.body.council || null }),
    ...(req.body.registerNumber !== undefined && { registerNumber: req.body.registerNumber || null }),
    ...(hourlyRatePatch != null && hourlyRatePatch),
    ...(req.body.specialties !== undefined && { specialties: parseSpecialties(req.body.specialties) }),
    ...(req.body.availableShifts !== undefined && { availableShifts: parseSpecialties(req.body.availableShifts) }),
    ...(req.body.serviceFrequencies !== undefined && { serviceFrequencies: parseSpecialties(req.body.serviceFrequencies) }),
    ...(req.body.approach !== undefined && { approach: req.body.approach || null }),
    ...(req.body.description !== undefined && { description: req.body.description || null }),
    ...(req.body.city !== undefined && { city: req.body.city || null }),
    ...(req.body.state !== undefined && { state: req.body.state || null }),
    ...(req.body.zipCode !== undefined && { zipCode: req.body.zipCode || null }),
  }

  if (data.council && data.registerNumber && (await registerExists(data.council, data.registerNumber, req.params.id))) {
    return res.status(409).json({ msg: 'Este registro profissional já está cadastrado.' })
  }

  try {
    const updated = await updateUser(req.params.id, data)
    const user = project(updated, USER_SELF_SELECT)
    res.status(200).json({ user })
  } catch (error) {
    logger.error('user:update_failed', {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    res.status(500).json({ msg: 'Erro ao atualizar perfil.' })
  }
}

const deleteUsers = async (req, res) => {
  // Autorização (anti-IDOR): só o próprio dono pode excluir a conta.
  if (req.userId !== req.params.id) {
    authLogger.warn('user:delete_forbidden', {
      userId: req.userId,
      targetId: req.params.id,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    })
    return res.status(403).json({ msg: 'Você só pode excluir a própria conta.' })
  }

  try {
    await deleteUser(req.params.id)
    // Remove também a credencial no Firebase Auth (o id do perfil = uid).
    try {
      await firebaseAdmin.auth().deleteUser(req.params.id)
    } catch (e) {
      logger.warn('user:firebase_delete_failed', { userId: req.userId, error: e.message })
    }
    authLogger.info('user:deleted', {
      userId: req.userId,
      timestamp: new Date().toISOString(),
    })
    res.status(200).json({ message: 'Usuário deletado com sucesso' })
  } catch (error) {
    logger.error('user:delete_failed', {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      endpoint: req.originalUrl,
    })
    res.status(500).json({ msg: 'Erro ao excluir conta.' })
  }
}

export { createUsers, getFeedUsers, updateUsers, deleteUsers }
