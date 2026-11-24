import { toast } from 'sonner'
import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Email from '@mui/icons-material/Email'
import { Field } from '../../components/ui'
import EmailVerificationModal from '../../components/EmailVerificationModal'
import AuthLayout from '../../components/auth/AuthLayout'
import PasswordField from '../../components/auth/PasswordField'
import GoogleIcon from '../../components/auth/GoogleIcon'
import { isValidEmail } from '../../utils/validators'
import { loginWithEmail, loginWithGoogle, resetPassword, mapAuthError } from '../../services/auth'
import api from '../../services/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const inputEmail = useRef()
  const inputPassword = useRef()
  const [loading, setLoading] = useState(false)
  const [verifyModal, setVerifyModal] = useState({ open: false, email: '' })

  // Decide o destino após autenticar no Firebase: sem perfil → completar cadastro.
  async function routeAfterAuth() {
    try {
      await api.get('/users/me')
      navigate('/home')
    } catch (err) {
      if (err.response?.status === 404) navigate('/completar-cadastro')
      else throw err
    }
  }

  async function handleLogin(e) {
    e?.preventDefault()
    if (loading) return
    const email = inputEmail.current.value.trim()
    if (!isValidEmail(email)) {
      toast.warning('Informe um e-mail válido.')
      return
    }
    setLoading(true)
    try {
      const user = await loginWithEmail(email, inputPassword.current.value)
      if (!user.emailVerified) {
        setVerifyModal({ open: true, email })
        return
      }
      await routeAfterAuth()
    } catch (err) {
      const msg = mapAuthError(err.code)
      if (msg) toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    if (loading) return
    setLoading(true)
    try {
      await loginWithGoogle() // Google já vem verificado
      await routeAfterAuth()
    } catch (err) {
      const msg = mapAuthError(err.code)
      if (msg) toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot() {
    const email = inputEmail.current.value.trim()
    if (!isValidEmail(email)) {
      toast.warning('Digite seu e-mail no campo acima para redefinir a senha.')
      return
    }
    try {
      await resetPassword(email)
      toast.success('Se houver uma conta com esse e-mail, enviamos um link de redefinição.')
    } catch (err) {
      const msg = mapAuthError(err.code)
      if (msg) toast.error(msg)
    }
  }

  return (
    <AuthLayout>
      <div className="va-head">
        <h1>Bem-vindo de volta</h1>
        <p>Entre para continuar suas conversas, solicitações e pagamentos.</p>
      </div>

      <form className="va-form" onSubmit={handleLogin} noValidate>
        <Field ref={inputEmail} label="E-mail" icon={Email} type="email" name="email" autoComplete="email" placeholder="seu@email.com" />
        <PasswordField ref={inputPassword} label="Senha" name="password" autoComplete="current-password" placeholder="Sua senha" />

        <div className="va-row-end">
          <button type="button" onClick={handleForgot} className="va-link">Esqueci minha senha</button>
        </div>

        <button type="submit" className="va-primary" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="va-divider"><span>ou</span></div>

        <button type="button" className="va-google" onClick={handleGoogle} disabled={loading}>
          <GoogleIcon />
          Entrar com Google
        </button>
      </form>

      <p className="va-switch">
        Não tem conta? <Link to="/cadastro">Criar conta grátis</Link>
      </p>

      <EmailVerificationModal
        open={verifyModal.open}
        email={verifyModal.email}
        onVerified={() => { setVerifyModal({ open: false, email: '' }); routeAfterAuth() }}
        onLogout={() => setVerifyModal({ open: false, email: '' })}
      />
    </AuthLayout>
  )
}
