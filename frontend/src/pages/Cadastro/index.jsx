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
import CalendarMonth from '@mui/icons-material/CalendarMonth'
import api from '../../services/api'
import { Field, Button, Card } from '../../components/ui'
import ProfileImageUpload from '../../components/ProfileImageUpload'
import { isValidCpf, isValidEmail, maskCpf, stripCpf } from '../../utils/validators'
import { registerWithEmail, loginWithGoogle, mapAuthError, getIdToken } from '../../services/auth'
import { COUNCILS, isValidRegister } from '../../constants/councils'

export default function Cadastro() {
  const navigate = useNavigate()
  const [role, setRole] = useState('CUIDADOR')
  const [submitting, setSubmitting] = useState(false)
  const [cpf, setCpf] = useState('')
  const [profileImage, setProfileImage] = useState('')
  const [council, setCouncil] = useState('')

  const inputName = useRef()
  const inputEmail = useRef()
  const inputPassword = useRef()
  const inputConfirmPassword = useRef()
  const inputRegister = useRef()
  const inputBirthDate = useRef()

  async function createUser(e) {
    e?.preventDefault()
    if (submitting) return

    const name = inputName.current?.value?.trim()
    const email = inputEmail.current?.value?.trim()
    const password = inputPassword.current?.value
    const confirmPassword = inputConfirmPassword.current?.value
    const birthDate = inputBirthDate.current?.value
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
    if (password !== confirmPassword) {
      toast.warning('As senhas não conferem.')
      return
    }
    if (!birthDate) {
      toast.warning('Informe sua data de nascimento.')
      return
    }
    const okChars = /^[\p{L}][\p{L} .'-]*$/u.test(name) && name.length >= 2
    const letters = name.replace(/[^\p{L}]/gu, '')
    const notRepeated = !(letters.length >= 2 && /^(.)\1+$/u.test(letters))
    if (!okChars || !notRepeated) {
      toast.warning('Informe um nome válido (apenas letras).')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name,
        role,
        bio: '',
        cpf: cpfDigits,
        birthDate,
      }

      if (profileImage) payload.profileImage = profileImage

      if (role === 'CUIDADOR') {
        const registerNumber = inputRegister.current?.value?.trim()
        if (council && registerNumber) {
          if (!isValidRegister(council, registerNumber)) {
            toast.warning('Número de registro inválido para o conselho informado.')
            setSubmitting(false)
            return
          }
          payload.council = council
          payload.registerNumber = registerNumber
        } else if (council || registerNumber) {
          toast.warning('Informe o conselho e o número do registro (ou deixe ambos em branco).')
          setSubmitting(false)
          return
        }
      }

      await registerWithEmail(email, password)
      await api.post('/users', payload)
      await getIdToken(true)
      toast.success('Conta criada! Confirme seu e-mail para entrar.')
      navigate('/login')
    } catch (err) {
      console.error(err)
      const msg = mapAuthError(err.code) || err.response?.data?.msg || 'Não foi possível criar a conta.'
      if (msg) toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    if (submitting) return
    setSubmitting(true)
    try {
      await loginWithGoogle()
      navigate('/completar-cadastro')
    } catch (err) {
      const msg = mapAuthError(err.code)
      if (msg) toast.error(msg)
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

          <Field
            ref={inputBirthDate}
            label="Data de nascimento"
            required
            icon={CalendarMonth}
            type="date"
            max={new Date().toISOString().split('T')[0]}
          />

          {role === 'CUIDADOR' && (
            <>
              <Field
                as="select"
                label="Conselho"
                icon={Badge}
                value={council}
                onChange={(e) => setCouncil(e.target.value)}
              >
                <option value="">Conselho (opcional)</option>
                {COUNCILS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Field>

              <Field
                ref={inputRegister}
                label="Número do registro"
                icon={Badge}
                type="text"
                placeholder="Número do registro"
              />
            </>
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

          <Field
            ref={inputConfirmPassword}
            label="Confirmar senha"
            required
            icon={Lock}
            type="password"
            placeholder="Repita a senha"
            autoComplete="new-password"
          />

          <Button type="submit" fullWidth loading={submitting} icon={PersonAdd} className="mt-2">
            {submitting ? 'Criando conta…' : 'Criar conta'}
          </Button>

          <Button type="button" fullWidth variant="secondary" onClick={handleGoogle} disabled={submitting}>
            Cadastrar com Google
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
