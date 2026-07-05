import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProfileCompleteness from './index'
import { computeCompleteness } from './completeness'

const CUIDADOR_COMPLETO = {
  profileImage: 'data:image/png;base64,x',
  bio: 'Sobre mim',
  hourlyRate: '25.00',
  zipCode: '50030230',
  city: '',
  state: '',
  council: 'COREN',
  registerNumber: '123456',
  specialties: ['IDOSOS'],
  description: 'Experiência de 5 anos...',
}

const CUIDADOR_VAZIO = {
  profileImage: '', bio: '', hourlyRate: '', zipCode: '', city: '', state: '',
  council: '', registerNumber: '', specialties: [], description: '',
}

describe('computeCompleteness', () => {
  it('CUIDADOR: 100% quando os 7 itens estão preenchidos', () => {
    const { percent, missing } = computeCompleteness(CUIDADOR_COMPLETO, 'CUIDADOR')
    expect(percent).toBe(100)
    expect(missing).toEqual([])
  })

  it('CUIDADOR: 0% e lista os 7 itens faltantes quando tudo está vazio', () => {
    const { percent, missing } = computeCompleteness(CUIDADOR_VAZIO, 'CUIDADOR')
    expect(percent).toBe(0)
    expect(missing).toHaveLength(7)
  })

  it('CUIDADOR: aceita cidade+estado no lugar do CEP pro item de endereço', () => {
    const userData = { ...CUIDADOR_COMPLETO, zipCode: '', city: 'Recife', state: 'PE' }
    expect(computeCompleteness(userData, 'CUIDADOR').percent).toBe(100)
  })

  it('FAMILIAR: usa checklist reduzido (3 itens: foto, bio, endereço)', () => {
    const userData = { profileImage: 'x', bio: 'y', city: 'Recife', state: 'PE' }
    const { percent, missing } = computeCompleteness(userData, 'FAMILIAR')
    expect(percent).toBe(100)
    expect(missing).toEqual([])
  })
})

describe('ProfileCompleteness', () => {
  it('não renderiza nada quando o perfil está 100% completo', () => {
    const userData = { profileImage: 'x', bio: 'y', city: 'Recife', state: 'PE' }
    const { container } = render(<ProfileCompleteness userData={userData} role="FAMILIAR" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra a barra e a lista de faltantes quando incompleto', () => {
    render(<ProfileCompleteness userData={CUIDADOR_VAZIO} role="CUIDADOR" />)
    expect(screen.getByText(/perfil 0% completo/i)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})
