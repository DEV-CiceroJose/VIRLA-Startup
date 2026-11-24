import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DatePickerField from './DatePickerField'

describe('DatePickerField (GlassCalendar)', () => {
  it('só tem a visão mensal e mostra a data escolhida em dd/mm/aaaa', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DatePickerField label="Data do serviço" value="2026-11-03" onChange={onChange} />)

    await user.click(screen.getByLabelText('Data do serviço'))
    const dialog = screen.getByRole('dialog', { name: 'Calendário de Data do serviço' })
    expect(dialog).not.toHaveTextContent(/semana/i)
    expect(dialog.querySelector('.gc-readout')).toHaveTextContent('03/11/2026')
    // o mês inteiro aparece de uma vez
    expect(dialog.querySelectorAll('.gc-day')).toHaveLength(30)

    await user.click(screen.getByRole('button', { name: '20 de novembro de 2026' }))
    expect(dialog.querySelector('.gc-readout')).toHaveTextContent('20/11/2026')
    await user.click(screen.getByRole('button', { name: /aplicar data/i }))
    expect(onChange).toHaveBeenCalledWith({ target: { value: '2026-11-20', name: undefined } })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('funciona sem estado externo, lido por ref como um input', async () => {
    const user = userEvent.setup()
    const ref = createRef()
    render(<DatePickerField ref={ref} label="Nascimento" shortcuts={false} max="2026-11-24" />)
    expect(ref.current.value).toBe('')

    await user.click(screen.getByLabelText('Nascimento'))
    expect(screen.queryByRole('button', { name: 'Hoje' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /escolher ano/i }))
    await user.click(screen.getByRole('button', { name: '1990' }))
    await user.click(screen.getByRole('button', { name: 'janeiro' }))
    await user.click(screen.getByRole('button', { name: '2 de janeiro de 1990' }))
    await user.click(screen.getByRole('button', { name: /aplicar data/i }))

    expect(ref.current.value).toBe('1990-01-02')
    expect(screen.getByLabelText('Nascimento')).toHaveTextContent('02/01/1990')
  })

  it('bloqueia dias e anos fora do intervalo', async () => {
    const user = userEvent.setup()
    render(<DatePickerField label="Início" value="" onChange={() => {}} min="2026-11-10" max="2026-12-05" />)
    await user.click(screen.getByLabelText('Início'))

    expect(screen.getByRole('button', { name: '9 de novembro de 2026' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '10 de novembro de 2026' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /escolher ano/i }))
    expect(screen.getAllByRole('button', { name: /^\d{4}$/ }).map((b) => b.textContent)).toEqual(['2026'])
  })
})
