import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TagSelect from './TagSelect'

const OPTIONS = [
  { value: 'A', label: 'Opção A' },
  { value: 'B', label: 'Opção B' },
  { value: 'C', label: 'Opção C' },
]

describe('TagSelect', () => {
  it('adiciona um valor ao clicar numa opção não selecionada', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagSelect options={OPTIONS} value={[]} onChange={onChange} label="Especialidades" />)
    await user.click(screen.getByRole('button', { name: 'Opção A' }))
    expect(onChange).toHaveBeenCalledWith(['A'])
  })

  it('remove um valor já selecionado ao clicar de novo', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TagSelect options={OPTIONS} value={['A', 'B']} onChange={onChange} label="Especialidades" />)
    await user.click(screen.getByRole('button', { name: 'Opção A' }))
    expect(onChange).toHaveBeenCalledWith(['B'])
  })

  it('marca aria-pressed=true nas opções selecionadas', () => {
    render(<TagSelect options={OPTIONS} value={['B']} onChange={vi.fn()} label="Especialidades" />)
    expect(screen.getByRole('button', { name: 'Opção B' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Opção A' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('desabilita opções não selecionadas ao atingir o max', () => {
    render(<TagSelect options={OPTIONS} value={['A', 'B']} onChange={vi.fn()} max={2} label="Especialidades" />)
    expect(screen.getByRole('button', { name: 'Opção C' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Opção A' })).not.toBeDisabled()
  })
})
