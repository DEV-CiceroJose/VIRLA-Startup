import bcrypt from 'bcrypt'
import {
  getUserById,
  getUserByEmail,
  emailExists,
  createUser,
  updateUser,
  deleteUser,
  listByRole,
} from '../repositories/userRepository.js'
import { project } from '../repositories/_helpers.js'
import { authLogger, logger } from '../lib/logger.js'
import { USER_PUBLIC_SELECT, USER_SELF_SELECT } from '../lib/userSelects.js'

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

/** Body já validado por createUserBodySchema (Zod) em userRoutes. */
const createUsers = async (req, res) => {
  const {
    name,
    birthDate: birthDateRaw,
    role,
    bio,
    email,
    cpf,
    password,
    profileImage,
    crm_crf,
    hourlyRate: hourlyRateRaw,
    registerNumber,
    approach,
    specialties,
    description,
    city,
    state,
  } = req.body

  const birthDate = parseBirthDate(birthDateRaw)
  const hourlyRate = parseHourlyRate(hourlyRateRaw)
  if (hourlyRateRaw != null && hourlyRateRaw !== '' && hourlyRate === null) {
    return res.status(422).json({ msg: 'Valor por hora inválido' })
  }

  try {
    const existing = await getUserByEmail(email)
    if (existing) {
      return res.status(409).json({ msg: 'Este e-mail já está cadastrado' })
    }

    // Hash só DEPOIS de confirmar que o e-mail é novo: bcrypt(12) custa ~100ms
    // de CPU; rodá-lo antes do check deixaria o endpoint vulnerável a abuso
    // (um bot forçaria o hash repetindo e-mails já cadastrados).
    const passwordHash = await bcrypt.hash(password, 12)

    const created = await createUser({
      name,
      birthDate,
      role,
      bio: bio ?? '',
      email,
      cpf: cpf ?? null,
      password: passwordHash,
      profileImage: emptyToNull(profileImage),
      crm_crf: role === 'CUIDADOR' ? emptyToNull(crm_crf) : null,
      registerNumber: emptyToNull(registerNumber),
      hourlyRate,
      specialties: parseSpecialties(specialties),
      approach: emptyToNull(approach),
      description: emptyToNull(description),
      city: emptyToNull(city),
      state: emptyToNull(state),
    })
    const user = project(created, USER_SELF_SELECT)
    authLogger.info('auth:register_success', {
      userId: created.id,
      role: created.role,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    })
    return res.status(201).json({ user })
  } catch (error) {
    logger.error('user:create_failed', {
      error: error.message,
      stack: error.stack,
      endpoint: req.originalUrl,
    })
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

    // Paginação por offset emulada: o Firestore não tem offset eficiente, mas
    // o feed tem volume baixo no MVP — buscamos os usuários do papel oposto e
    // recortamos a página em memória. Mantém o contrato `?page=N` do frontend.
    const allOfRole = await listByRole(oppositeRole)
    const total = allOfRole.length
    const feedUsers = allOfRole
      .slice(skip, skip + limit)
      .map((u) => project(u, USER_PUBLIC_SELECT))

    const totalPages = Math.max(1, Math.ceil(total / limit))

    res.status(200).json({
      users: feedUsers,
      total,
      totalPages,
      page,
      limit,
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
    ...(req.body.email != null && { email: req.body.email }),
    ...(req.body.name != null && { name: req.body.name }),
    ...(birthDate !== undefined && { birthDate }),
    ...(req.body.bio != null && { bio: req.body.bio }),
    ...(req.body.profileImage !== undefined && { profileImage: req.body.profileImage || null }),
    ...(req.body.crm_crf !== undefined && { crm_crf: req.body.crm_crf || null }),
    ...(req.body.registerNumber !== undefined && { registerNumber: req.body.registerNumber || null }),
    ...(hourlyRatePatch != null && hourlyRatePatch),
    ...(req.body.specialties !== undefined && { specialties: parseSpecialties(req.body.specialties) }),
    ...(req.body.approach !== undefined && { approach: req.body.approach || null }),
    ...(req.body.description !== undefined && { description: req.body.description || null }),
    ...(req.body.city !== undefined && { city: req.body.city || null }),
    ...(req.body.state !== undefined && { state: req.body.state || null }),
  }

  try {
    // Unicidade de email no update (substitui o tratamento de P2002 do Prisma).
    if (data.email != null && (await emailExists(data.email, req.params.id))) {
      return res.status(409).json({ msg: 'Este e-mail já está cadastrado' })
    }

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
