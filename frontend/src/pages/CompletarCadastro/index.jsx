import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import Person from '@mui/icons-material/Person'
import VerifiedUser from '@mui/icons-material/VerifiedUser'
import FamilyRestroomOutlined from '@mui/icons-material/FamilyRestroomOutlined'
import VolunteerActivismOutlined from '@mui/icons-material/VolunteerActivismOutlined'
import CheckCircle from '@mui/icons-material/CheckCircle'
import { Field, DatePickerField } from '../../components/ui'
import AuthLayout from '../../components/auth/AuthLayout'
import LegalConsent from '../../components/legal/LegalConsent'
import { TERMS_VERSION } from '../../constants/legal'
import api from '../../services/api'
import { getIdToken } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'

const ROLES = [
  { value: 'FAMILIAR', Icon: FamilyRestroomOutlined, title: 'Sou da família', text: 'Procuro alguém para cuidar de quem eu amo.' },
  { value: 'CUIDADOR', Icon: VolunteerActivismOutlined, title: 'Sou cuidador', text: 'Quero oferecer meu trabalho e receber solicitações.' },
]

export default function CompletarCadastroPage() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [role, setRole] = useState('FAMILIAR')
  const [loading, setLoading] = useState(false)
  const [legal, setLegal] = useState({ terms: false, privacy: false })
  const nome = useRef()
  const cpf = useRef()
  const birthDate = useRef()

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return
    if (!nome.current.value.trim() || !cpf.current.value.trim() || !birthDate.current.value) {
      toast.warning('Preencha nome, CPF e data de nascimento.')
      return
    }
    if (!legal.terms || !legal.privacy) {
      toast.warning('Leia e aceite os Termos de Uso e a Política de Privacidade para continuar.')
      return
    }
    setLoading(true)
    try {
      await api.post('/users', {
        name: nome.current.value.trim(),
        cpf: cpf.current.value.trim(),
        role,
        birthDate: birthDate.current.value,
        acceptedTerms: true,
        termsVersion: TERMS_VERSION,
      })
      await getIdToken(true) // recarrega o token para trazer o custom claim de role
      await refreshProfile()
      navigate('/home')
    } catch (err) {
      const status = err.response?.status
      if (status === 409) toast.error(err.response.data?.msg ?? 'Dados já cadastrados.')
      else if (status === 422) toast.error(err.response.data?.msg ?? 'Verifique os campos.')
      else toast.error('Não foi possível concluir o cadastro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="va-head">
        <h1>Só faltam alguns dados</h1>
        <p>Você entrou com o Google. Complete o cadastro para começar.</p>
      </div>

      <form className="va-form" onSubmit={handleSubmit} noValidate>
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

        <Field ref={nome} label="Nome completo" icon={Person} name="name" placeholder="Seu nome" autoComplete="name" />
        <div className="va-grid-2">
          <Field ref={cpf} label="CPF" icon={VerifiedUser} name="cpf" placeholder="000.000.000-00" inputMode="numeric" />
          <DatePickerField ref={birthDate} label="Data de nascimento" name="birthDate" shortcuts={false} placeholder="dd/mm/aaaa" max={new Date().toISOString().split('T')[0]} />
        </div>

        <LegalConsent value={legal} onChange={setLegal} />

        <button type="submit" className="va-primary" disabled={loading}>
          {loading ? 'Concluindo…' : 'Concluir cadastro'}
        </button>
      </form>
    </AuthLayout>
  )
}
