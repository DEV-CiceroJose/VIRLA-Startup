import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../../design-system/theme/ThemeProvider'
import Landing from './index'

const renderLanding = () => render(<ThemeProvider><MemoryRouter><Landing /></MemoryRouter></ThemeProvider>)

describe('Landing', () => {
  it('mantém a hero nova e as seções do site original', () => {
    renderLanding()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mais conforto para quem precisa.')
    for (const title of [
      'Conheça a Márcia.',
      'A barreira da contratação',
      'O porto seguro da Márcia',
      'Nosso lugar no mercado.',
      'Uma jornada de conquistas.',
      'O time por trás da VIRLA',
      'Ajude-nos a construir o futuro.',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
  })

  it('mostra os números finais (Number Ticker) para leitores de tela', () => {
    renderLanding()
    expect(screen.getByLabelText('33 milhões')).toBeInTheDocument()
    expect(screen.getByLabelText('R$ 12,3 bi')).toBeInTheDocument()
    expect(screen.getByLabelText('300 mil')).toBeInTheDocument()
    expect(screen.getByLabelText('840 mil')).toBeInTheDocument()
  })

  it('mostra a trajetória em baralho com índice de todos os marcos', async () => {
    renderLanding()
    const deck = screen.getByRole('region', { name: /marcos da trajetória/i })
    expect(within(deck).getByRole('button', { name: /O Nascimento.*No topo/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'O Nascimento' })).toBeInTheDocument()

    const index = screen.getByRole('navigation', { name: /todos os marcos/i })
    expect(within(index).getAllByRole('button')).toHaveLength(15)

    fireEvent.click(within(index).getByRole('button', { name: /Pré-Incubação Sertão Inovador/i }))
    expect(screen.getByRole('heading', { level: 3, name: 'Pré-Incubação Sertão Inovador' })).toBeInTheDocument()
    expect(screen.getByText('Agora')).toBeInTheDocument()

    fireEvent.click(within(deck).getByRole('button', { name: /próxima carta/i }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Próximos passos' })).toBeInTheDocument()
    expect(screen.getByText('Em breve')).toBeInTheDocument()

    for (const name of ['Fabio Henrique', 'Cicero José', 'Joéverton Paulo']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
  })

  it('mostra os cargos atualizados dos sócios e Joéverton fora dos colaboradores', () => {
    renderLanding()
    const role = (name) => screen.getByText(name).closest('li').querySelector('span').textContent
    expect(role('Joéverton Paulo')).toBe('CFO')
    expect(role('Alissomberg Domingos')).toBe('COO')
    expect(role('Cicero José')).toBe('CTO')
    expect(role('Miguel Alves')).toBe('CBO')
    expect(screen.getAllByText('Colaborador')).toHaveLength(2)
  })

  it('mantém o aviso sobre pagamentos fora da plataforma e os formulários de validação', () => {
    renderLanding()
    expect(screen.getByText(/não reconhece nem se responsabiliza por pagamentos realizados fora da plataforma/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /formulário para famílias/i })).toHaveAttribute('href', expect.stringContaining('docs.google.com/forms'))
    expect(screen.getByRole('link', { name: /formulário para cuidadores/i })).toHaveAttribute('href', expect.stringContaining('docs.google.com/forms'))
  })

  it('a faixa de trajetória não duplica itens para leitores de tela', () => {
    renderLanding()
    const region = screen.getByRole('region', { name: /eventos e instituições/i })
    const visibleLists = region.querySelectorAll('ul:not([aria-hidden="true"])')
    expect(visibleLists).toHaveLength(1)
  })

  it('troca o tema pelo botão do cabeçalho (sem View Transitions, troca na hora)', async () => {
    const user = userEvent.setup()
    document.documentElement.dataset.theme = 'light'
    localStorage.setItem('virla-theme', 'light')
    renderLanding()
    await user.click(screen.getByRole('button', { name: 'Ativar tema escuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Ativar tema claro' })).toBeInTheDocument()
    localStorage.removeItem('virla-theme')
  })

  it('abre o menu no celular', async () => {
    const user = userEvent.setup()
    renderLanding()
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true')
  })
})
