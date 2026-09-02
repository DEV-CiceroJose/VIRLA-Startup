const CARE_TYPE_TO_SPECIALTY = {
  alzheimer: 'ALZHEIMER_DEMENCIA',
  'alzheimer demencia': 'ALZHEIMER_DEMENCIA',
  parkinson: 'PARKINSON',
  'pos operatorio': 'POS_CIRURGICO',
  'pos cirurgico': 'POS_CIRURGICO',
  'mobilidade reduzida': 'MOBILIDADE_REDUZIDA',
  diabetes: 'DIABETES',
  hipertensao: 'HIPERTENSAO',
  'cuidados paliativos': 'CUIDADOS_PALIATIVOS',
  reabilitacao: 'REABILITACAO',
  'acompanhamento diurno': 'ACOMPANHAMENTO_DIURNO',
  pernoite: 'PERNOITE',
}

export const CAREGIVER_MATCH_VISIBILITY = Object.freeze({
  threshold: 60,
  minimumVisible: 5,
})

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function normalizedPlace(value) {
  return normalize(value)
}

export function careTypesToSpecialties(careTypes) {
  return [...new Set((Array.isArray(careTypes) ? careTypes : [])
    .map((value) => {
      const raw = String(value ?? '').trim()
      if (/^[A-Z0-9_]+$/.test(raw)) return raw
      return CARE_TYPE_TO_SPECIALTY[normalize(raw)] ?? null
    })
    .filter(Boolean))]
}

function matchLevel(score) {
  if (score >= 85) return 'EXCELENTE'
  if (score >= 70) return 'ALTA'
  if (score >= 50) return 'BOA'
  return 'POSSIVEL'
}

function addReason(reasons, code, label, points) {
  if (points > 0) reasons.push({ code, label, points })
}

/**
 * Pontuação determinística e explicável. Não usa dados sensíveis nem atributos
 * protegidos (idade, gênero, CPF etc.) e nunca elimina candidatos.
 */
export function scoreCaregiverForSolicitacao(caregiver, solicitacao) {
  const reasons = []
  const attention = []
  let score = 0

  const caregiverCity = normalizedPlace(caregiver?.city)
  const caregiverState = normalizedPlace(caregiver?.state)
  const requestCity = normalizedPlace(solicitacao?.cidade)
  const requestState = normalizedPlace(solicitacao?.estado)

  if (caregiverCity && requestCity && caregiverCity === requestCity && caregiverState === requestState) {
    score += 25
    addReason(reasons, 'SAME_CITY', 'Atende na mesma cidade', 25)
  } else if (caregiverState && requestState && caregiverState === requestState) {
    score += 15
    addReason(reasons, 'SAME_STATE', 'Atende no mesmo estado', 15)
    attention.push('Confirme a disponibilidade para deslocamento até a cidade do serviço.')
  } else {
    attention.push('Localização diferente ou ainda não informada.')
  }

  const requested = careTypesToSpecialties(solicitacao?.tipoCuidado)
  const caregiverSpecialties = new Set(Array.isArray(caregiver?.specialties) ? caregiver.specialties : [])
  const matchedSpecialties = requested.filter((value) => caregiverSpecialties.has(value))
  if (requested.length === 0) {
    score += 35
    addReason(reasons, 'GENERAL_CARE', 'Disponível para solicitação de cuidado geral', 35)
  } else if (matchedSpecialties.length > 0) {
    const points = Math.round(35 * (matchedSpecialties.length / requested.length))
    score += points
    addReason(
      reasons,
      'SPECIALTY_MATCH',
      matchedSpecialties.length === requested.length
        ? 'Especialidades cobrem todas as necessidades'
        : `Compatível com ${matchedSpecialties.length} de ${requested.length} necessidades`,
      points,
    )
    if (matchedSpecialties.length < requested.length) {
      attention.push('Algumas necessidades não constam nas especialidades do perfil.')
    }
  } else {
    attention.push('Nenhuma especialidade solicitada aparece no perfil.')
  }

  const requestedAvailability = [
    solicitacao?.turno ? {
      matches: (caregiver?.availableShifts ?? []).includes(solicitacao.turno)
        || (caregiver?.availableShifts ?? []).includes('A_COMBINAR'),
      label: 'Turno compatível',
    } : null,
    solicitacao?.frequencia ? {
      matches: (caregiver?.serviceFrequencies ?? []).includes(solicitacao.frequencia),
      label: 'Frequência de atendimento compatível',
    } : null,
  ].filter(Boolean)
  if (requestedAvailability.length === 0) {
    score += 10
    addReason(reasons, 'FLEXIBLE_SCHEDULE', 'Horários a combinar', 10)
  } else {
    const matchedAvailability = requestedAvailability.filter((item) => item.matches)
    const points = Math.round(10 * (matchedAvailability.length / requestedAvailability.length))
    score += points
    addReason(
      reasons,
      'AVAILABILITY_MATCH',
      matchedAvailability.length === requestedAvailability.length
        ? 'Turno e frequência compatíveis'
        : matchedAvailability[0]?.label ?? '',
      points,
    )
    if (matchedAvailability.length < requestedAvailability.length) {
      attention.push('Confirme turno e frequência: a disponibilidade cadastrada não cobre todo o pedido.')
    }
  }

  const budget = Number(solicitacao?.valorHora)
  const rate = Number(caregiver?.hourlyRate)
  if (Number.isFinite(budget) && budget > 0 && Number.isFinite(rate) && rate > 0) {
    const ratio = rate / budget
    let points = 0
    let label = ''
    if (ratio <= 1) {
      points = 20
      label = 'Valor dentro do orçamento'
    } else if (ratio <= 1.1) {
      points = 15
      label = 'Valor até 10% acima do orçamento'
    } else if (ratio <= 1.25) {
      points = 8
      label = 'Valor próximo do orçamento'
    } else {
      attention.push('Valor/hora acima da faixa definida na solicitação.')
    }
    score += points
    addReason(reasons, 'PRICE_FIT', label, points)
  } else {
    attention.push('Compare o valor/hora diretamente antes de contratar.')
  }

  let trustPoints = 0
  if (caregiver?.council && caregiver?.registerNumber) trustPoints += 5
  if (String(caregiver?.description ?? caregiver?.bio ?? '').trim().length >= 80) trustPoints += 2
  if (String(caregiver?.approach ?? '').trim().length >= 20) trustPoints += 2
  if (caregiver?.profileImage) trustPoints += 1
  trustPoints = Math.min(10, trustPoints)
  score += trustPoints
  addReason(reasons, 'PROFILE_QUALITY', 'Perfil profissional bem preenchido', trustPoints)

  const roundedScore = Math.max(0, Math.min(100, Math.round(score)))
  return {
    score: roundedScore,
    level: matchLevel(roundedScore),
    reasons: reasons.sort((a, b) => b.points - a.points),
    attention,
    matchedSpecialties,
    requestedSpecialties: requested,
    version: 'virla-match-v1',
  }
}

export function rankCaregiversForSolicitacao(caregivers, solicitacao) {
  return (Array.isArray(caregivers) ? caregivers : [])
    .map((caregiver) => ({
      caregiver,
      match: scoreCaregiverForSolicitacao(caregiver, solicitacao),
    }))
    .sort((a, b) => b.match.score - a.match.score || String(a.caregiver.name).localeCompare(String(b.caregiver.name), 'pt-BR'))
}

/**
 * Mantém oportunidades novas abaixo do limiar fora da listagem principal.
 * Quando há pouca oferta compatível, completa a vitrine até o mínimo definido
 * com as melhores alternativas. Itens já visualizados ou assumidos nunca são
 * ocultados, pois fazem parte do fluxo ativo do cuidador.
 */
export function selectSolicitacoesForCaregiver(
  scoredSolicitacoes,
  caregiverId,
  policy = CAREGIVER_MATCH_VISIBILITY,
) {
  const threshold = Number(policy?.threshold ?? CAREGIVER_MATCH_VISIBILITY.threshold)
  const minimumVisible = Math.max(0, Number(policy?.minimumVisible ?? CAREGIVER_MATCH_VISIBILITY.minimumVisible))
  const sorted = [...(Array.isArray(scoredSolicitacoes) ? scoredSolicitacoes : [])]
    .sort((a, b) => Number(b?.match?.score ?? 0) - Number(a?.match?.score ?? 0))

  const interacted = []
  const discovery = []
  for (const solicitacao of sorted) {
    const wasViewed = Array.isArray(solicitacao?.viewedByIds)
      && solicitacao.viewedByIds.includes(caregiverId)
    const wasAssigned = solicitacao?.assignedCaregiverId === caregiverId
    if (wasViewed || wasAssigned) interacted.push(solicitacao)
    else discovery.push(solicitacao)
  }

  const preferred = discovery.filter((item) => Number(item?.match?.score ?? 0) >= threshold)
  const belowThreshold = discovery.filter((item) => Number(item?.match?.score ?? 0) < threshold)
  const fallbackCount = Math.min(
    belowThreshold.length,
    Math.max(0, minimumVisible - preferred.length),
  )
  const fallback = belowThreshold.slice(0, fallbackCount).map((item) => ({
    ...item,
    match: { ...item.match, isFallback: true },
  }))
  const solicitacoes = [...interacted, ...preferred, ...fallback]
    .sort((a, b) => Number(b?.match?.score ?? 0) - Number(a?.match?.score ?? 0))

  return {
    solicitacoes,
    policy: {
      threshold,
      minimumVisible,
      preferredCount: preferred.length,
      fallbackCount,
      hiddenCount: belowThreshold.length - fallbackCount,
    },
  }
}
