import { listByCaregiverId } from '../repositories/serviceReportRepository.js'
import { getUserById } from '../repositories/userRepository.js'
import { summarizeCaregiverReports } from '../services/caregiverFinanceSummary.js'
import { logger } from '../lib/logger.js'

export async function getCaregiverFinanceSummary(req, res) {
  try {
    const [reports, caregiver] = await Promise.all([
      listByCaregiverId(req.userId),
      getUserById(req.userId),
    ])
    return res.status(200).json({
      ...summarizeCaregiverReports(reports),
      hourlyRate: Number(caregiver?.hourlyRate) || null,
    })
  } catch (error) {
    logger.error('caregiver:finance_summary_failed', { error: error.message, userId: req.userId })
    return res.status(500).json({ msg: 'Não foi possível carregar o resumo financeiro.' })
  }
}
