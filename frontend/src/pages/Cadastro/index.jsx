import { toast } from 'sonner'
import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Person from '@mui/icons-material/Person'
import Work from '@mui/icons-material/Work'
import Email from '@mui/icons-material/Email'
import Lock from '@mui/icons-material/Lock'
import PersonAdd from '@mui/icons-material/PersonAdd'
import ArrowBack from '@mui/icons-material/ArrowBack'
import Badge from '@mui/icons-material/Badge'
import VerifiedUser from '@mui/icons-material/VerifiedUser'
import api from '../../services/api'
import { Field, Button, Card } from '../../components/ui'
import ProfileImageUpload from '../../components/ProfileImageUpload'
import { isValidCpf, isValidEmail, maskCpf, stripCpf } from '../../utils/validators'

function formatRegisterError(err) {
  const data = err.response?.data
  const msg = data?.msg ?? data?.message
  if (typeof msg === 'string') return msg
  if (Array.isArray(msg)) return msg.join('\n')
  if (msg && typeof msg === 'object') return JSON.stringify(msg)
  return err.message || 'Erro ao criar conta. Verifique os dados e tente novamente.'
}

export default function Cadastro() {
  const navigate = useNavigate()
  const [role, setRole] = useState('CUIDADOR')
  const [submitting, setSubmitting] = useState(false)
  const [cpf, setCpf] = useState('')
  const [profileImage, setProfileImage] = useState('')

  const inputName = useRef()
  const inputEmail = useRef()
  const inputPassword = useRef()
  const inputCrmCrf = useRef()

  async function createUser(e) {
    e?.preventDefault()
    if (submitting) return

    const name = inputName.current?.value?.trim()
    const email = inputEmail.current?.value?.trim()
    const password = inputPassword.current?.value
    const cpfDigits = stripCpf(cpf)

    if (!name) {
      toast.warning('Informe seu nome.')
      return
    }
    if (!isValidEmail(email)) {
      toast.warning('Informe um e-mail válido (ex.: nome@provedor.com).')
      return
    }
    if (!isValidCpf(cpfDigits)) {
      toast.warning('CPF inválido. Verifique os dígitos.')
      return
    }
    if (!password || password.length < 6) {
      toast.warning('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name,
        role,
        bio: '',
        email,
        cpf: cpfDigits,
        password,
      }

      if (profileImage) payload.profileImage = profileImage

      if (role === 'CUIDADOR') {
        const crmCrf = inputCrmCrf.current?.value?.trim()
        if (crmCrf) payload.crm_crf = crmCrf
      }

      await api.post('/users', payload)
      toast.success('Conta criada! Faça login para continuar.')
      navigate('/login')
    } catch (err) {
      console.error(err)
      toast.error(formatRegisterError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-virla-neve flex items-center justify-center px-4 py-12"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(128,0,128,0.12), transparent)',
      }}
    >
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.ico" alt="" className="w-12 h-12 object-contain mb-3" aria-hidden />
          <h1 className="text-3xl font-display font-black text-virla-roxo tracking-tight">VIRLA</h1>
          <p className="text-virla-muted text-sm mt-1">Crie sua conta gratuita</p>
        </div>

        <Card as="form" onSubmit={createUser} className="p-8 space-y-4">
          <h2 className="text-xl font-bold text-virla-texto mb-1">Cadastro</h2>

          <Field
            as="select"
            label="Tipo de conta"
            icon={Work}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="CUIDADOR">Cuidador</option>
            <option value="FAMILIAR">Familiar</option>
          </Field>

          <ProfileImageUpload value={profileImage} onChange={setProfileImage} />

          <Field
            ref={inputName}
            label="Nome completo"
            required
            icon={Person}
            type="text"
            placeholder="Nome completo"
          />

          <Field
            label="CPF"
            required
            icon={VerifiedUser}
            type="text"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(maskCpf(e.target.value))}
            maxLength={14}
          />

          {role === 'CUIDADOR' && (
            <Field
              ref={inputCrmCrf}
              label="CRM / CRF (opcional)"
              icon={Badge}
              type="text"
              placeholder="Número do conselho"
            />
          )}

          <Field
            ref={inputEmail}
            label="E-mail"
            required
            icon={Email}
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
          />

          <Field
            ref={inputPassword}
            label="Senha"
            required
            icon={Lock}
            type="password"
            placeholder="Senha (mín. 6 caracteres)"
            autoComplete="new-password"
          />

          <Button type="submit" fullWidth loading={submitting} icon={PersonAdd} className="mt-2">
            {submitting ? 'Criando conta…' : 'Criar conta'}
          </Button>

          <p className="text-center text-sm text-virla-muted pt-1">
            Já tem conta?{' '}
            <Link to="/login" className="text-virla-roxo font-semibold hover:underline">
              Entrar
            </Link>
          </p>
        </Card>

        <Link
          to="/"
          className="flex items-center justify-center gap-1 mt-6 text-sm text-virla-muted hover:text-virla-roxo transition-colors"
        >
          <ArrowBack sx={{ fontSize: 16 }} aria-hidden />
          Voltar à página inicial
        </Link>
      </div>
    </div>
  )
}
