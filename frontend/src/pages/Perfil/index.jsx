import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import Person from '@mui/icons-material/Person'
import CalendarMonth from '@mui/icons-material/CalendarMonth'
import Cake from '@mui/icons-material/Cake'
import Description from '@mui/icons-material/Description'
import Save from '@mui/icons-material/Save'
import DeleteForever from '@mui/icons-material/DeleteForever'
import { PageLoader } from '../../components/Spinner'
import Image from '@mui/icons-material/Image'
import Payments from '@mui/icons-material/Payments'
import Badge from '@mui/icons-material/Badge'
import Psychology from '@mui/icons-material/Psychology'
import Shield from '@mui/icons-material/Shield'
import LocationOn from '@mui/icons-material/LocationOn'
import api from '../../services/api'
import { calculateAge } from '../../utils/dateUtils'
import ProfileImageUpload from '../../components/ProfileImageUpload'
import ProfileCompleteness from '../../components/ProfileCompleteness'
import { Field, Button, Card, Alert, ConfirmDialog, Badge as DSBadge, TagSelect } from '../../components/ui'
import { hasPasswordProvider, linkPassword, mapAuthError } from '../../services/auth'
import { COUNCILS, isValidRegister } from '../../constants/councils'
import { STATES } from '../../constants/states'
import { SPECIALTIES, SPECIALTY_VALUES } from '../../constants/specialties'
import { lookupCep } from '../../services/viacep'
import { maskCep, maskCurrencyInput, parseCurrencyInput } from '../../utils/formatters'

function SectionTitle({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 font-bold text-virla-texto text-base mb-4">
      <Icon sx={{ fontSize: 20 }} className="text-virla-roxo" />
      {children}
    </h2>
  )
}

function emptyUserForm() {
  return {
    name: '',
    birthDate: '',
    bio: '',
    email: '',
    role: '',
    profileImage: '',
    hourlyRate: '',
    council: '',
    registerNumber: '',
    approach: '',
    specialties: [],
    description: '',
    zipCode: '',
    city: '',
    state: '',
  }
}

function mapUserToForm(user) {
  if (!user) return emptyUserForm()
  return {
    name: user.name ?? '',
    birthDate: user.birthDate ?? '',
    bio: user.bio ?? '',
    email: user.email ?? '',
    role: user.role ?? '',
    profileImage: user.profileImage ?? '',
    hourlyRate:
      user.hourlyRate != null && user.hourlyRate !== ''
        ? maskCurrencyInput(String(Math.round(Number(user.hourlyRate) * 100)))
        : '',
    council: user.council ?? '',
    registerNumber: user.registerNumber ?? '',
    approach: user.approach ?? '',
    // Especialidades gravadas antes da lista fixa (FE-06) que não batem com
    // nenhum value válido são descartadas do estado editável — o usuário
    // pode re-selecioná-las entre as opções atuais.
    specialties: Array.isArray(user.specialties)
      ? user.specialties.filter((s) => SPECIALTY_VALUES.includes(s))
      : [],
    description: user.description ?? '',
    zipCode: user.zipCode ?? '',
    city: user.city ?? '',
    state: user.state ?? '',
  }
}

function PerfilFormSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6 animate-pulse">
      <div className="h-9 bg-virla-roxo/15 rounded w-48" />
      <div className="h-4 bg-virla-roxo/10 rounded w-64" />
      <div className="bg-white/80 rounded-2xl border border-virla-roxo/10 p-6 space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-12 bg-virla-roxo/10 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function Perfil() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [userData, setUserData] = useState(emptyUserForm)
  const [needsPassword] = useState(() => !hasPasswordProvider())
  const [passwordLinked, setPasswordLinked] = useState(false)
  const [linkingPwd, setLinkingPwd] = useState(false)
  const novaSenha = useRef()
  const confirmaNovaSenha = useRef()

  const id = localStorage.getItem('meuId')

  useEffect(() => {
    if (!id) {
      navigate('/login')
      return
    }

    async function loadUser() {
      try {
        const res = await api.get(`/users/${id}`)
        const user = res.data.user ?? res.data
        setUserData(mapUserToForm(user))
      } catch {
        setMessage({ type: 'error', text: 'Erro ao carregar dados do perfil.' })
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [id, navigate])

  async function handleUpdate(e) {
    e.preventDefault()
    setMessage({ type: '', text: '' })
    setFieldErrors({})
    const isFamiliar = userData.role === 'FAMILIAR'
    if (!isFamiliar) {
      const hasCouncil = Boolean(userData.council)
      const hasRegisterNumber = Boolean(userData.registerNumber.trim())
      if (hasCouncil !== hasRegisterNumber) {
        setFieldErrors({ registerNumber: 'Informe o conselho e o número do registro.' })
        return
      }
      if (hasCouncil && hasRegisterNumber && !isValidRegister(userData.council, userData.registerNumber.trim())) {
        setFieldErrors({ registerNumber: 'Número de registro inválido para o conselho informado.' })
        return
      }
    }
    try {
      setSaving(true)
      const basePayload = {
        name: userData.name,
        birthDate: userData.birthDate ? new Date(userData.birthDate).toISOString() : undefined,
        bio: userData.bio,
        profileImage: userData.profileImage.trim() || null,
      }
      let payload = basePayload
      if (!isFamiliar) {
        payload = {
          ...basePayload,
          zipCode: userData.zipCode.trim() || null,
          city: userData.city.trim() || null,
          state: userData.state.trim() || null,
          council: userData.council || null,
          registerNumber: userData.registerNumber.trim() || null,
          approach: userData.approach.trim() || null,
          description: userData.description.trim() || null,
          specialties: userData.specialties,
          hourlyRate: userData.hourlyRate === '' ? null : Number(parseCurrencyInput(userData.hourlyRate)),
        }
      }
      const res = await api.put(`/users/${id}`, payload)
      const updated = res.data.user ?? res.data
      if (updated?.name) localStorage.setItem('meuNome', updated.name)
      setUserData(mapUserToForm(updated))
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.msg ?? 'Erro ao atualizar perfil. Tente novamente.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleZipCodeChange(e) {
    const masked = maskCep(e.target.value)
    setUserData((prev) => ({ ...prev, zipCode: masked }))
    const digits = masked.replace(/\D/g, '')
    if (digits.length === 8) {
      const result = await lookupCep(digits)
      if (result) {
        setUserData((prev) => ({
          ...prev,
          city: result.city || prev.city,
          state: result.state || prev.state,
        }))
      }
    }
  }

  async function handleCriarSenha(e) {
    e.preventDefault()
    if (linkingPwd) return
    const s = novaSenha.current?.value ?? ''
    const c = confirmaNovaSenha.current?.value ?? ''
    if (s.length < 6) {
      toast.warning('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (s !== c) {
      toast.warning('As senhas não conferem.')
      return
    }
    setLinkingPwd(true)
    try {
      await linkPassword(s)
      setPasswordLinked(true)
      toast.success('Senha criada! Agora você também pode entrar com e-mail e senha.')
    } catch (err) {
      toast.error(mapAuthError(err.code) || 'Não foi possível criar a senha.')
    } finally {
      setLinkingPwd(false)
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true)
      await api.delete(`/users/${id}`)
      localStorage.clear()
      navigate('/login')
    } catch {
      setMessage({ type: 'error', text: 'Erro ao excluir conta. Tente novamente.' })
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (loading) {
    return (
      <PageLoader label="Carregando perfil…">
        <PerfilFormSkeleton />
      </PageLoader>
    )
  }

  const age = calculateAge(userData.birthDate)
  const isFamiliar = userData.role === 'FAMILIAR'
  const bioLength = (userData.bio ?? '').length
  const bioOverLimit = bioLength > 1900

  return (
    <div
      className="min-h-screen pt-16 bg-virla-neve"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 70% 50% at 30% 0%, rgba(128,0,128,0.07), transparent)',
      }}
    >
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div className="animate-fade-up">
          <h1 className="text-3xl font-display font-black text-virla-roxo">Meu Perfil</h1>
          <p className="text-virla-muted text-sm mt-1">Gerencie suas informações pessoais e profissionais</p>
        </div>

        <ProfileCompleteness userData={userData} role={userData.role} />

        {message.text && (
          <Alert tone={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>
        )}

        <Card className="p-6">
          <SectionTitle icon={Person}>Informações Pessoais</SectionTitle>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-virla-muted uppercase tracking-wide mb-1.5">
                Tipo de conta
              </label>
              <DSBadge tone="roxo">
                {userData.role === 'CUIDADOR' ? 'Cuidador Profissional' : 'Familiar'}
              </DSBadge>
            </div>

            <Field
              label="Nome completo"
              icon={Person}
              type="text"
              value={userData.name}
              onChange={(e) => setUserData({ ...userData, name: e.target.value })}
            />

            <Field
              label="E-mail (não editável)"
              type="text"
              value={userData.email}
              disabled
            />

            <Field
              label="Data de Nascimento"
              icon={CalendarMonth}
              type="date"
              value={userData.birthDate ? userData.birthDate.split('T')[0] : ''}
              onChange={(e) => setUserData({ ...userData, birthDate: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
            />
            {age !== null && (
              <p className="!mt-1.5 flex items-center gap-1.5 text-xs text-virla-roxo/70 font-medium">
                <Cake sx={{ fontSize: 14 }} />
                {age} anos
              </p>
            )}

            <Field
              as="textarea"
              label="Bio / Apresentação"
              icon={Description}
              rows={4}
              value={userData.bio ?? ''}
              onChange={(e) => setUserData({ ...userData, bio: e.target.value })}
              placeholder="Resumo curto para o feed…"
              hint={bioOverLimit ? undefined : `${bioLength}/2000`}
              error={bioOverLimit ? `${bioLength}/2000` : undefined}
            />

            <div className="pt-2 border-t border-virla-roxo/10">
              <SectionTitle icon={Image}>{isFamiliar ? 'Foto de perfil' : 'Imagem e valor'}</SectionTitle>
            </div>

            <ProfileImageUpload
              value={userData.profileImage}
              onChange={(v) => setUserData({ ...userData, profileImage: v })}
            />

            {!isFamiliar && (
              <>
                <Field
                  label="Valor por hora (R$)"
                  icon={Payments}
                  type="text"
                  inputMode="numeric"
                  value={userData.hourlyRate}
                  onChange={(e) => setUserData({ ...userData, hourlyRate: maskCurrencyInput(e.target.value) })}
                  placeholder="R$ 0,00"
                />

                <Field
                  as="select"
                  label="Conselho profissional"
                  icon={Badge}
                  value={userData.council}
                  onChange={(e) => setUserData({ ...userData, council: e.target.value })}
                >
                  <option value="">Selecione…</option>
                  {COUNCILS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Field>

                <Field
                  label="Registro profissional (COREN, CRP, etc.)"
                  icon={Badge}
                  type="text"
                  value={userData.registerNumber}
                  onChange={(e) => setUserData({ ...userData, registerNumber: e.target.value })}
                  placeholder="Número do conselho"
                  error={fieldErrors.registerNumber}
                />

                <Field
                  label="Abordagem (ex.: TCC, home care)"
                  icon={Psychology}
                  type="text"
                  value={userData.approach}
                  onChange={(e) => setUserData({ ...userData, approach: e.target.value })}
                />

                <TagSelect
                  label="Especialidades"
                  options={SPECIALTIES}
                  value={userData.specialties}
                  onChange={(specialties) => setUserData({ ...userData, specialties })}
                  max={12}
                />

                <Field
                  as="textarea"
                  label="Descrição longa (opcional)"
                  rows={4}
                  value={userData.description}
                  onChange={(e) => setUserData({ ...userData, description: e.target.value })}
                  placeholder="Currículo, experiência, formação…"
                />
              </>
            )}

            {!isFamiliar && (
              <>
                <Field
                  label="CEP"
                  icon={LocationOn}
                  type="text"
                  inputMode="numeric"
                  value={userData.zipCode}
                  onChange={handleZipCodeChange}
                  maxLength={9}
                  placeholder="00000-000"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Cidade"
                    value={userData.city}
                    onChange={(e) => setUserData({ ...userData, city: e.target.value })}
                  />
                  <Field
                    as="select"
                    label="Estado (UF)"
                    value={userData.state}
                    onChange={(e) => setUserData({ ...userData, state: e.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {STATES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Field>
                </div>
              </>
            )}

            <Button type="submit" fullWidth loading={saving} disabled={deleting} icon={Save} className="mt-2">
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </form>
        </Card>

        {needsPassword && !passwordLinked && (
          <Card as="form" onSubmit={handleCriarSenha} className="mt-6 p-6 space-y-4">
            <h3 className="text-lg font-bold text-virla-texto">Criar senha</h3>
            <p className="text-sm text-virla-muted">
              Você entrou com o Google. Crie uma senha para também poder entrar com e-mail e senha.
            </p>
            <input
              ref={novaSenha}
              type="password"
              placeholder="Nova senha (mín. 6 caracteres)"
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-virla-texto text-sm focus:outline-none focus:ring-2 focus:ring-virla-roxo/30 focus:border-virla-roxo transition-all duration-200"
            />
            <input
              ref={confirmaNovaSenha}
              type="password"
              placeholder="Confirmar nova senha"
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-virla-texto text-sm focus:outline-none focus:ring-2 focus:ring-virla-roxo/30 focus:border-virla-roxo transition-all duration-200"
            />
            <Button type="submit" loading={linkingPwd}>Criar senha</Button>
          </Card>
        )}

        <Card className="border-red-200 p-6">
          <SectionTitle icon={Shield}>Zona de perigo</SectionTitle>

          <p className="text-sm text-virla-muted mb-4">
            Excluir sua conta é uma ação <strong>permanente e irreversível</strong>. Todos os seus dados serão removidos
            do sistema.
          </p>

          <Button
            variant="danger"
            size="sm"
            icon={DeleteForever}
            onClick={() => setConfirmDelete(true)}
            disabled={deleting || saving}
          >
            Excluir minha conta permanentemente
          </Button>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir conta permanentemente?"
        description="Esta ação não pode ser desfeita. Todos os seus dados serão removidos do sistema."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
