import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportDemo from './index'

describe('Demonstração local do relatório', () => {
  it('percorre cuidador, assinatura do familiar e pagamento simulado', async () => {
    const user = userEvent.setup({ delay: null })
    render(<ReportDemo />)

    await user.click(screen.getByRole('button', { name: /perfil familiar.*maria da silva/i }))
    await user.click(screen.getByRole('button', { name: /ver pagamento bloqueado/i }))
    expect(await screen.findByText(/pagamento permanecerá bloqueado/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /fechar/i }))

    await user.click(screen.getByRole('button', { name: /perfil cuidador.*carlos oliveira/i }))
    await user.click(screen.getByLabelText(/recorrência do pagamento/i))
    await user.click(screen.getByRole('option', { name: 'Diária' }))
    await user.click(screen.getByRole('button', { name: /preencher relatório do dia/i }))
    await user.type(screen.getByLabelText(/atividades realizadas/i), 'Alimentação, medicação e acompanhamento durante o dia.')
    expect(screen.queryByLabelText(/valor do serviço/i)).not.toBeInTheDocument()
    expect(screen.getByText(/não há taxa adicional da virla/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /enviar para assinatura/i }))

    expect(await screen.findByText(/aguardando familiar/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /perfil familiar.*maria da silva/i }))
    await user.click(screen.getByRole('button', { name: /revisar relatório/i }))
    await user.click(screen.getByLabelText(/confirmo que o serviço foi prestado/i))
    await user.click(screen.getByLabelText(/aceito assinar eletronicamente/i))
    await user.type(screen.getByLabelText(/digite seu nome completo/i), 'Maria da Silva')
    await user.click(screen.getByRole('button', { name: /confirmar e assinar/i }))

    expect(await screen.findByRole('region', { name: /comprovante da assinatura/i })).toHaveTextContent('Maria da Silva')
    await user.click(screen.getByRole('button', { name: /simular pagamento de teste/i }))
    await waitFor(() => expect(screen.getAllByText(/pagamento confirmado/i).length).toBeGreaterThan(0))
  })
})
