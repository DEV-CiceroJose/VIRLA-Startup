import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Field, Button, Card } from '../../components/ui'
import api from '../../services/api'
import { getIdToken } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'

export default function CompletarCadastroPage() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [role, setRole] = useState('FAMILIAR')
  const [loading, setLoading] = useState(false)
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
    setLoading(true)
    try {
      await api.post('/users', {
        name: nome.current.value.trim(),
        cpf: cpf.current.value.trim(),
        role,
        birthDate: birthDate.current.value,
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
    <div className="min-h-screen bg-virla-neve flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card as="form" onSubmit={handleSubmit} className="p-8 space-y-4">
          <h2 className="text-xl font-bold text-virla-texto">Completar cadastro</h2>
          <p className="text-sm text-virla-muted">Só faltam alguns dados para começar.</p>

          <Field ref={nome} label="Nome completo" name="name" placeholder="Seu nome" />
          <Field ref={cpf} label="CPF" name="cpf" placeholder="000.000.000-00" />
          <Field ref={birthDate} label="Data de nascimento" type="date" name="birthDate" max={new Date().toISOString().split('T')[0]} />

          <div className="flex gap-2">
            <Button type="button" fullWidth variant={role === 'FAMILIAR' ? 'primary' : 'secondary'} onClick={() => setRole('FAMILIAR')}>Familiar</Button>
            <Button type="button" fullWidth variant={role === 'CUIDADOR' ? 'primary' : 'secondary'} onClick={() => setRole('CUIDADOR')}>Cuidador</Button>
          </div>

          <Button type="submit" fullWidth loading={loading}>Concluir</Button>
        </Card>
      </div>
    </div>
  )
}
