import { toast } from 'sonner'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Person from '@mui/icons-material/Person'
import Email from '@mui/icons-material/Email'
import Badge from '@mui/icons-material/Badge'
import VerifiedUser from '@mui/icons-material/VerifiedUser'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ArrowForward from '@mui/icons-material/ArrowForward'
import FamilyRestroomOutlined from '@mui/icons-material/FamilyRestroomOutlined'
import VolunteerActivismOutlined from '@mui/icons-material/VolunteerActivismOutlined'
import CheckCircle from '@mui/icons-material/CheckCircle'
import api from '../../services/api'
import { Field, DatePickerField } from '../../components/ui'
import ProfileImageUpload from '../../components/ProfileImageUpload'
import AuthLayout from '../../components/auth/AuthLayout'
import Stepper from '../../components/auth/Stepper'
import PasswordField from '../../components/auth/PasswordField'
import GoogleIcon from '../../components/auth/GoogleIcon'
import LegalConsent from '../../components/legal/LegalConsent'
import { TERMS_VERSION } from '../../constants/legal'
import { isValidCpf, isValidEmail, maskCpf, stripCpf } from '../../utils/validators'
import { registerWithEmail, loginWithGoogle, mapAuthError, getIdToken, logout } from '../../services/auth'
import { COUNCILS, isValidRegister } from '../../constants/councils'

const ALL_STEPS = [
  { id: 'conta', title: 'Conta', heading: 'Como você vai usar a VIRLA?', lede: 'Escolha o tipo de conta. Se preferir, comece pelo Google.' },
  { id: 'dados', title: 'Seus dados', heading: 'Conte quem você é', lede: 'Usamos estes dados para confirmar sua identidade.' },
  { id: 'registro', title: 'Registro', heading: 'Registro profissional', lede: 'Opcional. Com o conselho e o número informados, seu perfil ganha o selo de verificado.', onlyFor: 'CUIDADOR' },
  { id: 'acesso', title: 'Acesso', heading: 'Crie seu acesso', lede: 'Depois enviamos um e-mail para você confirmar o endereço.' },
]

const ROLES = [
  { value: 'FAMILIAR', Icon: FamilyRestroomOutlined, title: 'Sou da família', text: 'Procuro alguém para cuidar de quem eu amo.' },
  { value: 'CUIDADOR', Icon: VolunteerActivismOutlined, title: 'Sou cuidador', text: 'Quero oferecer meu trabalho e receber solicitações.' },
]

function isValidPersonName(name) {
  const okChars = /^[\p{L}][\p{L} .'-]*$/u.test(name) && name.length >= 2
  const letters = name.replace(/[^\p{L}]/gu, '')
  const notRepeated = !(letters.length >= 2 && /^(.)\1+$/u.test(letters))
  return okChars && notRepeated
}

export default function Cadastro() {
  const navigate = useNavigate()
  const [role, setRole] = useState('CUIDADOR')
  const [submitting, setSubmitting] = useState(false)
  const [cpf, setCpf] = useState('')
  const [profileImage, setProfileImage] = useState('')
  const [council, setCouncil] = useState('')
  const [stepIndex, setStepIndex] = useState(0)
  const [legal, setLegal] = useState({ terms: false, privacy: false })

  const inputName = useRef()
  const inputEmail = useRef()
  const inputPassword = useRef()
  const inputConfirmPassword = useRef()
  const inputRegister = useRef()
  const inputBirthDate = useRef()
  const headingRef = useRef(null)
  const firstRender = useRef(true)

  const steps = ALL_STEPS.filter((step) => !step.onlyFor || step.onlyFor === role)
  const current = steps[Math.min(stepIndex, steps.length - 1)]
  const isLast = stepIndex >= steps.length - 1

  // A cada troca de etapa o foco vai para o título (leitores de tela anunciam).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [stepIndex])

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
    if (!isValidPersonName(name)) {
      toast.warning('Informe um nome válido (apenas letras).')
      return
    }
    if (!legal.terms || !legal.privacy) {
      toast.warning('Leia e aceite os Termos de Uso e a Política de Privacidade para criar a conta.')
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
        acceptedTerms: true,
        termsVersion: TERMS_VERSION,
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
      // Sai da sessão criada pelo cadastro: o perfil foi checado antes de existir
      // e o login seguinte precisa recarregá-lo (senão cai em completar cadastro).
      await logout().catch(() => {})
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

  /** Confere só os campos da etapa atual, com as mesmas mensagens do envio final. */
  function stepProblem(id) {
    if (id === 'dados') {
      const name = inputName.current?.value?.trim()
      if (!name) return 'Informe seu nome.'
      if (!isValidPersonName(name)) return 'Informe um nome válido (apenas letras).'
      if (!isValidCpf(stripCpf(cpf))) return 'CPF inválido. Verifique os dígitos.'
      if (!inputBirthDate.current?.value) return 'Informe sua data de nascimento.'
    }
    if (id === 'registro') {
      const registerNumber = inputRegister.current?.value?.trim()
      if (council && registerNumber && !isValidRegister(council, registerNumber)) {
        return 'Número de registro inválido para o conselho informado.'
      }
      if (Boolean(council) !== Boolean(registerNumber)) {
        return 'Informe o conselho e o número do registro (ou deixe ambos em branco).'
      }
    }
    return ''
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (isLast) {
      createUser()
      return
    }
    const problem = stepProblem(current.id)
    if (problem) {
      toast.warning(problem)
      return
    }
    setStepIndex((index) => index + 1)
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
    <AuthLayout>
      <div className="va-head">
        <h1>Crie sua conta</h1>
        <p>É grátis e leva poucos minutos.</p>
      </div>

      <Stepper steps={steps} current={stepIndex} onSelect={setStepIndex} label="Etapas do cadastro" />

      <form className="va-form" onSubmit={handleSubmit} noValidate>
        <div className="va-step-head" key={current.id}>
          <p className="va-step-count">Passo {stepIndex + 1} de {steps.length}</p>
          <h2 ref={headingRef} tabIndex={-1}>{current.heading}</h2>
          <p>{current.lede}</p>
        </div>

        {/* Todas as etapas ficam montadas (só a atual aparece) para os campos
            não controlados manterem o que foi digitado. */}
        <section className="va-panel" hidden={current.id !== 'conta'}>
          <fieldset className="va-roles">
            <legend className="sr-only">Tipo de conta</legend>
            {ROLES.map(({ value, Icon, title, text }) => (
              <label key={value} className={`va-role${role === value ? ' is-selected' : ''}`}>
                <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} />
                <span className="va-role-icon"><Icon aria-hidden /></span>
                <span className="va-role-text">
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
                <CheckCircle aria-hidden className="va-role-check" />
              </label>
            ))}
          </fieldset>
        </section>

        <section className="va-panel" hidden={current.id !== 'dados'}>
          <ProfileImageUpload value={profileImage} onChange={setProfileImage} />
          <Field ref={inputName} label="Nome completo" required icon={Person} type="text" placeholder="Nome completo" autoComplete="name" />
          <div className="va-grid-2">
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
            <DatePickerField
              ref={inputBirthDate}
              label="Data de nascimento"
              required
              shortcuts={false}
              placeholder="dd/mm/aaaa"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </section>

        {role === 'CUIDADOR' && (
          <section className="va-panel" hidden={current.id !== 'registro'}>
            <Field as="select" label="Conselho" icon={Badge} value={council} onChange={(e) => setCouncil(e.target.value)}>
              <option value="">Conselho (opcional)</option>
              {COUNCILS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Field>
            <Field ref={inputRegister} label="Número do registro" icon={Badge} type="text" placeholder="Número do registro" />
          </section>
        )}

        <section className="va-panel" hidden={current.id !== 'acesso'}>
          <Field ref={inputEmail} label="E-mail" required icon={Email} type="email" placeholder="seu@email.com" autoComplete="email" />
          <PasswordField ref={inputPassword} label="Senha" required placeholder="Senha (mín. 6 caracteres)" autoComplete="new-password" />
          <PasswordField ref={inputConfirmPassword} label="Confirmar senha" required placeholder="Repita a senha" autoComplete="new-password" />
          <LegalConsent value={legal} onChange={setLegal} />
        </section>

        <div className="va-actions">
          {stepIndex > 0 && (
            <button type="button" className="va-secondary" onClick={() => setStepIndex((index) => index - 1)} disabled={submitting}>
              <ArrowBack aria-hidden />
              Voltar
            </button>
          )}
          <button type="submit" className="va-primary" disabled={submitting}>
            {isLast ? (submitting ? 'Criando conta…' : 'Criar conta') : <>Continuar <ArrowForward aria-hidden /></>}
          </button>
        </div>

        {current.id === 'conta' && (
          <>
            <div className="va-divider"><span>ou</span></div>
            <button type="button" className="va-google" onClick={handleGoogle} disabled={submitting}>
              <GoogleIcon />
              Cadastrar com Google
            </button>
          </>
        )}
      </form>

      <p className="va-switch">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </AuthLayout>
  )
}
