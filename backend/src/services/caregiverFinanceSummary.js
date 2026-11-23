const RECEIVABLE_STATUSES = new Set(['SIGNED', 'PAYMENT_PENDING'])

export function summarizeCaregiverReports(reports) {
  const paid = reports.filter((report) => report.status === 'PAID')
  const receivable = reports.filter((report) => RECEIVABLE_STATUSES.has(report.status))
  const sum = (items) => items.reduce((total, report) => total + (Number(report.baseAmount) || 0), 0)

  return {
    receivedCents: sum(paid),
    receivableCents: sum(receivable),
    completedServices: paid.length,
    pendingServices: receivable.length,
    entries: reports.map((report) => ({
      id: report.id,
      solicitacaoId: report.solicitacaoId,
      serviceDate: report.serviceDate,
      status: report.status,
      amountCents: Number(report.baseAmount) || 0,
    })),
  }
}
