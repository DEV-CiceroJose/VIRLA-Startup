import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../../design-system/theme/ThemeProvider'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock }
})
vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }))
vi.mock('../../services/auth', () => ({
  registerWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  mapAuthError: vi.fn(() => ''),
  getIdToken: vi.fn(),
  logout: vi.fn(() => Promise.resolve()),
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }))
// Upload de imagem usa FileReader/canvas — fora do escopo deste fluxo.
vi.mock('../../components/ProfileImageUpload', () => ({ default: () => null }))

import Cadastro from './index'
import api from '../../services/api'
import { registerWithEmail, loginWithGoogle, getIdToken } from '../../services/auth'
import { toast } from 'sonner'

function renderCadastro() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <Cadastro />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

const stepHeading = () => screen.getByRole('heading', { level: 2 })
const next = (user) => user.click(screen.getByRole('button', { name: /continuar/i }))

async function pickBirthDate(user) {
  await user.click(screen.getByLabelText(/^Data de nascimento/))
  await user.click(screen.getByRole('button', { name: /escolher ano/i }))
  await user.click(screen.getByRole('button', { name: '1994' }))
  await user.click(screen.getByRole('button', { name: 'maio' }))
  await user.click(screen.getByRole('button', { name: '10 de maio de 1994' }))
  await user.click(screen.getByRole('button', { name: /aplicar data/i }))
  expect(screen.getByLabelText(/^Data de nascimento/)).toHaveTextContent('10/05/1994')
}

/** Etapa "Seus dados" preenchida e avançada. */
async function fillDados(user, { cpf = '52998224725' } = {}) {
  await user.type(screen.getByPlaceholderText('Nome completo'), 'Ana Souza')
  await user.type(screen.getByPlaceholderText('000.000.000-00'), cpf)
  await pickBirthDate(user)
  await next(user)
}

/** Abre cada documento legal e aceita (no jsdom o texto já conta como lido até o fim). */
async function acceptLegal(user) {
  for (const doc of ['Termos de Uso', 'Política de Privacidade']) {
    await user.click(screen.getByRole('button', { name: new RegExp(doc) }))
    const accept = await screen.findByRole('button', { name: 'Li e aceito' })
    await waitFor(() => expect(accept).toBeEnabled())
    await user.click(accept)
  }
}

async function fillAcesso(user, { confirm = 'segredo1', legal = true } = {}) {
  await user.type(screen.getByPlaceholderText('seu@email.com'), 'ana@provedor.com')
  await user.type(screen.getByPlaceholderText('Senha (mín. 6 caracteres)'), 'segredo1')
  await user.type(screen.getByPlaceholderText('Repita a senha'), confirm)
  if (legal) await acceptLegal(user)
  await user.click(screen.getByRole('button', { name: /criar conta/i }))
}

describe('Página de Cadastro (em etapas)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // Guarda anti-regressão da TELA BRANCA: se o componente quebrar ao montar
  // (ex.: erro de hook por React duplicado), este render falha.
  it('abre na primeira etapa com o tipo de conta, o Google e o stepper', () => {
    renderCadastro()
    expect(screen.getByRole('heading', { level: 1, name: 'Crie sua conta' })).toBeInTheDocument()
    expect(stepHeading()).toHaveTextContent('Como você vai usar a VIRLA?')
    expect(screen.getByText('Passo 1 de 4')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /sou cuidador/i })).toBeChecked()
    expect(screen.getByRole('button', { name: /cadastrar com google/i })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Etapas do cadastro' }).children).toHaveLength(4)
  })

  it('família pula a etapa de registro profissional', async () => {
    const user = userEvent.setup()
    renderCadastro()
    await user.click(screen.getByRole('radio', { name: /sou da família/i }))
    expect(screen.getByRole('list', { name: 'Etapas do cadastro' }).children).toHaveLength(3)
    expect(screen.queryByLabelText('Conselho')).not.toBeInTheDocument()
    await next(user)
    await fillDados(user)
    expect(stepHeading()).toHaveTextContent('Crie seu acesso')
    expect(screen.getByText('Passo 3 de 3')).toBeInTheDocument()
  })

  it('não avança com CPF inválido e avisa', async () => {
    const user = userEvent.setup()
    renderCadastro()
    await next(user)
    await fillDados(user, { cpf: '11111111111' })
    expect(toast.warning).toHaveBeenCalledWith('CPF inválido. Verifique os dígitos.')
    expect(stepHeading()).toHaveTextContent('Conte quem você é')
    expect(registerWithEmail).not.toHaveBeenCalled()
  })

  it('não avança quando só o conselho ou só o número do registro for preenchido', async () => {
    const user = userEvent.setup()
    renderCadastro()
    await next(user)
    await fillDados(user)
    expect(stepHeading()).toHaveTextContent('Registro profissional')
    await user.click(screen.getByLabelText('Conselho'))
    await user.click(screen.getByRole('option', { name: /COREN/ }))
    await next(user)

    expect(toast.warning).toHaveBeenCalledWith(
      'Informe o conselho e o número do registro (ou deixe ambos em branco).',
    )
    expect(stepHeading()).toHaveTextContent('Registro profissional')
    expect(registerWithEmail).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('bloqueia envio com senhas divergentes e avisa', async () => {
    const user = userEvent.setup()
    renderCadastro()
    await next(user)
    await fillDados(user)
    await next(user)
    await fillAcesso(user, { confirm: 'segredo2' })

    expect(toast.warning).toHaveBeenCalledWith('As senhas não conferem.')
    expect(registerWithEmail).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('não cria a conta sem ler e aceitar os Termos e a Política', async () => {
    const user = userEvent.setup()
    renderCadastro()
    await next(user)
    await fillDados(user)
    await next(user)
    await fillAcesso(user, { legal: false })
    expect(toast.warning).toHaveBeenCalledWith('Leia e aceite os Termos de Uso e a Política de Privacidade para criar a conta.')
    expect(registerWithEmail).not.toHaveBeenCalled()
  })

  it('voltar mantém o que já foi digitado', async () => {
    const user = userEvent.setup()
    renderCadastro()
    await next(user)
    await fillDados(user)
    await user.click(screen.getByRole('button', { name: /^voltar$/i }))
    expect(stepHeading()).toHaveTextContent('Conte quem você é')
    expect(screen.getByPlaceholderText('Nome completo')).toHaveValue('Ana Souza')
    expect(screen.getByPlaceholderText('000.000.000-00')).toHaveValue('529.982.247-25')
  })

  it('cadastro válido cria credencial no Firebase, envia perfil sem senha e navega para /login', async () => {
    registerWithEmail.mockResolvedValue({ uid: 'u9' })
    api.post.mockResolvedValue({ data: { user: { id: 'u9' } } })
    getIdToken.mockResolvedValue('token')
    const user = userEvent.setup()
    renderCadastro()
    await next(user)
    await fillDados(user)
    await next(user)
    await fillAcesso(user)

    await waitFor(() => expect(registerWithEmail).toHaveBeenCalledWith('ana@provedor.com', 'segredo1'))
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    const [url, payload] = api.post.mock.calls[0]
    expect(url).toBe('/users')
    expect(payload).toMatchObject({
      name: 'Ana Souza',
      cpf: '52998224725',
      role: 'CUIDADOR',
      birthDate: '1994-05-10',
    })
    expect(payload).toMatchObject({ acceptedTerms: true, termsVersion: expect.any(String) })
    expect(payload).not.toHaveProperty('password')
    expect(payload).not.toHaveProperty('email')
    expect(getIdToken).toHaveBeenCalledWith(true)
    expect(navigateMock).toHaveBeenCalledWith('/login')
  })

  it('cadastro com Google chama loginWithGoogle e navega para completar cadastro', async () => {
    loginWithGoogle.mockResolvedValue({ uid: 'g1' })
    const user = userEvent.setup()
    renderCadastro()
    await user.click(screen.getByRole('button', { name: /cadastrar com google/i }))

    await waitFor(() => expect(loginWithGoogle).toHaveBeenCalledTimes(1))
    expect(navigateMock).toHaveBeenCalledWith('/completar-cadastro')
  })
})
