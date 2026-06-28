import { toast } from 'sonner'
import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Email from '@mui/icons-material/Email'
import Lock from '@mui/icons-material/Lock'
import LoginIcon from '@mui/icons-material/Login'
import ArrowBack from '@mui/icons-material/ArrowBack'
import api from '../../services/api'
import { Field, Button, Card } from '../../components/ui'
import { isValidEmail } from '../../utils/validators'

export default function LoginPage() {
  const navigate = useNavigate()
  const inputEmail = useRef()
  const inputPassword = useRef()
  const [loading, setLoading] = useState(false)

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
      const res = await api.post('/auth/login', {
        email,
        password: inputPassword.current.value,
      })

      localStorage.setItem('meuToken', res.data.token)
      localStorage.setItem('meuId', res.data.user.id)
      localStorage.setItem('meuNome', res.data.user.name)
      if (res.data.user?.role) localStorage.setItem('meuRole', res.data.user.role)

      navigate('/home')
    } catch (err) {
      console.error(err)
      toast.error('E-mail ou senha incorretos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-virla-neve flex items-center justify-center px-4"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(128,0,128,0.12), transparent)',
      }}
    >
      <div className="w-full max-w-sm animate-fade-up">
        <div className="flex flex-col items-center mb-10">
          <img src="/favicon.ico" alt="" className="w-12 h-12 object-contain mb-3" aria-hidden />
          <h1 className="text-3xl font-display font-black text-virla-roxo tracking-tight">VIRLA</h1>
          <p className="text-virla-muted text-sm mt-1">Bem-vindo de volta</p>
        </div>

        <Card as="form" onSubmit={handleLogin} className="p-8 space-y-4">
          <h2 className="text-xl font-bold text-virla-texto mb-2">Entrar na plataforma</h2>

          <Field
            ref={inputEmail}
            label="E-mail"
            srOnlyLabel
            icon={Email}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="seu@email.com"
          />

          <Field
            ref={inputPassword}
            label="Senha"
            srOnlyLabel
            icon={Lock}
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Sua senha"
          />

          <Button type="submit" fullWidth loading={loading} icon={LoginIcon} className="mt-2">
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>

          <p className="text-center text-sm text-virla-muted pt-1">
            Não tem conta?{' '}
            <Link to="/cadastro" className="text-virla-roxo font-semibold hover:underline">
              Criar conta grátis
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
