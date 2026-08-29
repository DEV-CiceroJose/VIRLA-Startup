import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchDemo from './index'

describe('Demonstração do match inteligente', () => {
  it('reordena e explica os cuidadores ao trocar a solicitação', async () => {
    const user = userEvent.setup({ delay: null })
    render(<MatchDemo />)

    let cards = screen.getAllByRole('article')
    expect(cards[0]).toHaveTextContent('Ana Oliveira')
    expect(cards[0]).toHaveTextContent('100% compatível')

    await user.click(screen.getByLabelText(/solicitação usada no match/i))
    await user.click(screen.getByRole('option', { name: /Cuidados pós-operatórios/i }))
    cards = screen.getAllByRole('article')
    expect(cards[0]).toHaveTextContent('Carla Souza')
    expect(cards[0]).toHaveTextContent('Especialidades cobrem todas as necessidades')
  })

  it('oculta matches baixos com muita oferta e libera alternativas quando há pouca oferta', async () => {
    const user = userEvent.setup({ delay: null })
    render(<MatchDemo />)
    const caregiverView = screen.getByRole('region', { name: /regra de visibilidade para o cuidador/i })

    expect(within(caregiverView).getByText(/6 solicitações com pelo menos 60%/i)).toBeInTheDocument()
    expect(within(caregiverView).queryByText(/58% compatível/i)).not.toBeInTheDocument()

    await user.click(screen.getByLabelText(/cenário de oferta para o cuidador/i))
    await user.click(screen.getByRole('option', { name: /Poucas solicitações compatíveis/i }))

    expect(within(caregiverView).getByText(/lista é completada com as 3 melhores alternativas/i)).toBeInTheDocument()
    expect(within(caregiverView).getByText(/58% compatível · alternativa/i)).toBeInTheDocument()
  })
})
