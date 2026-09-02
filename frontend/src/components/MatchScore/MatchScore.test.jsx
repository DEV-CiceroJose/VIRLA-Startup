import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import MatchScore from './index'

const match = {
  score: 92,
  level: 'EXCELENTE',
  reasons: [
    { code: 'SPECIALTY_MATCH', label: 'Especialidades cobrem todas as necessidades', points: 40 },
    { code: 'SAME_CITY', label: 'Atende na mesma cidade', points: 25 },
  ],
  attention: ['Confirme os horários diretamente com o profissional.'],
}

describe('MatchScore', () => {
  it('explica a pontuação sem apresentar o resultado como garantia', () => {
    render(<MatchScore match={match} />)
    expect(screen.getByRole('region', { name: /compatibilidade de 92%/i })).toHaveTextContent('92% compatível')
    expect(screen.getByText(/Especialidades cobrem todas/i)).toBeInTheDocument()
    expect(screen.getByText(/Confirme os detalhes antes de contratar/i)).toBeInTheDocument()
  })

  it('oferece versão compacta para cabeçalhos', () => {
    render(<MatchScore match={match} compact />)
    expect(screen.getByText('92% compatível')).toBeInTheDocument()
  })

  it('não renderiza sem pontuação válida', () => {
    const { container } = render(<MatchScore match={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('identifica uma alternativa liberada por haver pouca oferta', () => {
    render(<MatchScore match={{ ...match, score: 55, level: 'BOA', isFallback: true }} />)
    expect(screen.getByText('Alternativa por baixa oferta')).toBeInTheDocument()
    expect(screen.getByText(/poucas solicitações com pelo menos 60%/i)).toBeInTheDocument()
  })
})
