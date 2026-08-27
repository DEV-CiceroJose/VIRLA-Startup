import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchDemo from './index'

describe('Demonstração do match inteligente', () => {
  it('reordena e explica os cuidadores ao trocar a solicitação', async () => {
    const user = userEvent.setup({ delay: null })
    render(<MatchDemo />)

    let cards = screen.getAllByRole('article')
    expect(cards[0]).toHaveTextContent('Ana Oliveira')
    expect(cards[0]).toHaveTextContent('100% compatível')

    await user.selectOptions(screen.getByLabelText(/solicitação usada no match/i), 'pos')
    cards = screen.getAllByRole('article')
    expect(cards[0]).toHaveTextContent('Carla Souza')
    expect(cards[0]).toHaveTextContent('Especialidades cobrem todas as necessidades')
  })
})
