import bcrypt from 'bcrypt'
import prisma from '../lib/prisma.js'
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

  const passwordHash = await bcrypt.hash(password, 12)

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ msg: 'Este e-mail já está cadastrado' })
    }

    const user = await prisma.user.create({
      data: {
        name,
        birthDate,
        role,
        bio: bio ?? '',
        email,
        cpf,
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
      },
      select: USER_SELF_SELECT,
    })
    authLogger.info('auth:register_success', {
      userId: user.id,
      role: user.role,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    })
    return res.status(201).json({ user })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ msg: 'Este e-mail já está cadastrado' })
    }
    logger.error('user:create_failed', {
      error: error.message,
      stack: error.stack,
      endpoint: req.originalUrl,
    })
    return res.status(500).json({ msg: 'Erro ao criar conta. Tente novamente.' })
  }
}

const getUsers = async (req, res) => {
  // Rota administrativa/interna — protegida por checkToken.
  // Usa o select público (sem email/cpf) para não expor PII em massa.
  const users = await prisma.user.findMany({ select: USER_PUBLIC_SELECT })
  res.status(200).send(users)
}

const FEED_PAGE_SIZE = 10

const getFeedUsers = async (req, res) => {
  try {
    const loggedUserId = req.params.id
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
    const limit = FEED_PAGE_SIZE
    const skip = (page - 1) * limit

    const loggedUser = await prisma.user.findUnique({
      where: { id: loggedUserId },
    })

    if (!loggedUser) {
      return res.status(404).json({ msg: 'Usuário não encontrado' })
    }

    const oppositeRole = loggedUser.role === 'CUIDADOR' ? 'FAMILIAR' : 'CUIDADOR'
    const where = { role: oppositeRole }

    const [feedUsers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: USER_PUBLIC_SELECT,
      }),
      prisma.user.count({ where }),
    ])

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
    await prisma.user.update({
      where: { id: req.params.id },
      data,
    })

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: USER_SELF_SELECT,
    })
    res.status(200).json({ user })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ msg: 'Este e-mail já está cadastrado' })
    }
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
    await prisma.user.delete({
      where: { id: req.params.id },
    })
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

export { createUsers, getUsers, getFeedUsers, updateUsers, deleteUsers }
