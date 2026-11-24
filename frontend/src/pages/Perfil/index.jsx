import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import Person from '@mui/icons-material/Person'
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined'
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
import { computeCompleteness } from '../../components/ProfileCompleteness/completeness'
import '../../design-system/own-profile.css'
import { Field, Button, Alert, ConfirmDialog, TagSelect, DatePickerField } from '../../components/ui'
import { hasPasswordProvider, linkPassword, mapAuthError } from '../../services/auth'
import { COUNCILS, isValidRegister } from '../../constants/councils'
import { STATES } from '../../constants/states'
import { SPECIALTIES, SPECIALTY_VALUES } from '../../constants/specialties'
import { TURNOS, FREQUENCIAS, TURNO_VALUES, FREQUENCIA_VALUES } from '../../constants/solicitacaoOptions'
import { lookupCep } from '../../services/viacep'
import { maskCep, maskCurrencyInput, parseCurrencyInput } from '../../utils/formatters'

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase()
}

const VERIFICATION = {
  NAO_ENVIADO: { tone: 'brand', title: 'Verificação pendente', text: 'Envie seus documentos para aparecer às famílias.' },
  EM_ANALISE: { tone: 'wait', title: 'Documentos em análise', text: 'Avisamos quando a equipe terminar.' },
  APROVADO: { tone: 'ok', title: 'Perfil verificado', text: 'Documentos e antecedentes conferidos.' },
  REPROVADO: { tone: 'risk', title: 'Verificação reprovada', text: 'Veja o motivo e envie de novo.' },
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
    availableShifts: [],
    serviceFrequencies: [],
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
    availableShifts: Array.isArray(user.availableShifts)
      ? user.availableShifts.filter((value) => TURNO_VALUES.includes(value))
      : [],
    serviceFrequencies: Array.isArray(user.serviceFrequencies)
      ? user.serviceFrequencies.filter((value) => FREQUENCIA_VALUES.includes(value))
      : [],
    description: user.description ?? '',
    zipCode: user.zipCode ?? '',
    city: user.city ?? '',
    state: user.state ?? '',
  }
}

export default function Perfil() {
  const navigate = useNavigate()
  // Status de verificação e data do aceite (só leitura; não entram no formulário).
  const [profile, setProfile] = useState(null)
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
        setProfile({ verificationStatus: user?.verificationStatus, termsAcceptedAt: user?.termsAcceptedAt })
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
          availableShifts: userData.availableShifts,
          serviceFrequencies: userData.serviceFrequencies,
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
      <PageLoader label="Carregando perfil…" />
    )
  }

  const age = calculateAge(userData.birthDate)
  const isFamiliar = userData.role === 'FAMILIAR'
  const bioLength = (userData.bio ?? '').length
  const bioOverLimit = bioLength > 1900
  const { percent, missing } = computeCompleteness(userData, userData.role)
  const verification = VERIFICATION[profile?.verificationStatus ?? 'NAO_ENVIADO'] ?? VERIFICATION.NAO_ENVIADO
  const sections = [
    { id: 'pf-dados', label: 'Dados pessoais' },
    { id: 'pf-foto', label: isFamiliar ? 'Foto de perfil' : 'Foto e valor' },
    ...(!isFamiliar ? [{ id: 'pf-profissional', label: 'Perfil profissional' }, { id: 'pf-local', label: 'Onde você atende' }] : []),
    { id: 'pf-conta', label: 'Conta e segurança' },
  ]

  return (
    <div className="comfort-page min-h-screen pt-16">
      <div className="vd-dash pf-page">
        <header className="vd-greeting">
          <h1>Meu perfil</h1>
          <p>{isFamiliar ? 'Seus dados e como você aparece para os cuidadores.' : 'Como as famílias veem você e o que usamos para o match.'}</p>
        </header>

        {message.text && (
          <Alert tone={message.type === 'success' ? 'success' : 'error'} className="pf-alert">{message.text}</Alert>
        )}

        <div className="pf-layout">
          <aside className="pf-aside">
            <div className="pf-id">
              <div className="pf-photo">
                {userData.profileImage ? <img src={userData.profileImage} alt="" /> : <span aria-hidden>{initials(userData.name)}</span>}
              </div>
              <strong className="pf-name">{userData.name || 'Seu nome'}</strong>
              <span className="pf-role">{isFamiliar ? 'Família' : 'Cuidador profissional'}{age !== null ? ` · ${age} anos` : ''}</span>

              <div className="pf-complete" aria-live="polite">
                <div className="pf-complete-head">
                  <span>Perfil {percent}% completo</span>
                </div>
                <div className="pf-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Perfil completo">
                  <span style={{ width: `${percent}%` }} />
                </div>
                {missing.length > 0 && <p>Faltam: {missing.join(', ')}</p>}
              </div>

              {!isFamiliar && (
                <Link to="/verificacao" className={`pf-verify tone-${verification.tone}`}>
                  <VerifiedUserOutlined aria-hidden />
                  <span>
                    <strong>{verification.title}</strong>
                    <small>{verification.text}</small>
                  </span>
                </Link>
              )}
            </div>

            <nav className="pf-nav" aria-label="Seções do perfil">
              {sections.map((s) => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
            </nav>
          </aside>

          <div className="pf-main">
            <form onSubmit={handleUpdate} className="pf-form">
              <section id="pf-dados" className="pf-panel" aria-labelledby="pf-dados-t">
                <h2 id="pf-dados-t"><Person aria-hidden /> Dados pessoais</h2>
                <div className="pf-grid">
                  <Field
                    label="Nome completo"
                    icon={Person}
                    type="text"
                    value={userData.name}
                    onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                  />
                  <Field label="E-mail (não editável)" type="text" value={userData.email} disabled />
                </div>
                <div className="pf-grid">
                  <DatePickerField
                    label="Data de Nascimento"
                    shortcuts={false}
                    placeholder="dd/mm/aaaa"
                    value={userData.birthDate ? userData.birthDate.split('T')[0] : ''}
                    onChange={(e) => setUserData({ ...userData, birthDate: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    hint={age !== null ? `${age} anos` : undefined}
                  />
                  <div className="pf-readonly">
                    <span>Tipo de conta</span>
                    <strong>{isFamiliar ? 'Família' : 'Cuidador profissional'}</strong>
                  </div>
                </div>
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
              </section>

              <section id="pf-foto" className="pf-panel" aria-labelledby="pf-foto-t">
                <h2 id="pf-foto-t"><Image aria-hidden /> {isFamiliar ? 'Foto de perfil' : 'Foto e valor'}</h2>
                <ProfileImageUpload
                  value={userData.profileImage}
                  onChange={(v) => setUserData({ ...userData, profileImage: v })}
                />
                {!isFamiliar && (
                  <Field
                    label="Valor por hora (R$)"
                    icon={Payments}
                    type="text"
                    inputMode="numeric"
                    value={userData.hourlyRate}
                    onChange={(e) => setUserData({ ...userData, hourlyRate: maskCurrencyInput(e.target.value) })}
                    placeholder="R$ 0,00"
                  />
                )}
              </section>

              {!isFamiliar && (
                <section id="pf-profissional" className="pf-panel" aria-labelledby="pf-prof-t">
                  <h2 id="pf-prof-t"><Psychology aria-hidden /> Perfil profissional</h2>
                  <div className="pf-grid">
                    <Field
                      as="select"
                      label="Conselho profissional"
                      icon={Badge}
                      value={userData.council}
                      onChange={(e) => setUserData({ ...userData, council: e.target.value })}
                    >
                      <option value="">Selecione…</option>
                      {COUNCILS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
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
                  </div>
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
                  <TagSelect
                    label="Turnos disponíveis"
                    options={TURNOS}
                    value={userData.availableShifts}
                    onChange={(availableShifts) => setUserData({ ...userData, availableShifts })}
                    max={TURNOS.length}
                  />
                  <TagSelect
                    label="Frequências de atendimento"
                    options={FREQUENCIAS}
                    value={userData.serviceFrequencies}
                    onChange={(serviceFrequencies) => setUserData({ ...userData, serviceFrequencies })}
                    max={FREQUENCIAS.length}
                  />
                  <Field
                    as="textarea"
                    label="Descrição longa (opcional)"
                    rows={4}
                    value={userData.description}
                    onChange={(e) => setUserData({ ...userData, description: e.target.value })}
                    placeholder="Currículo, experiência, formação…"
                  />
                </section>
              )}

              {!isFamiliar && (
                <section id="pf-local" className="pf-panel" aria-labelledby="pf-local-t">
                  <h2 id="pf-local-t"><LocationOn aria-hidden /> Onde você atende</h2>
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
                  <div className="pf-grid">
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
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </Field>
                  </div>
                </section>
              )}

              <div className="pf-savebar">
                <span>As alterações só valem depois de salvar.</span>
                <Button type="submit" loading={saving} disabled={deleting} icon={Save}>
                  {saving ? 'Salvando…' : 'Salvar alterações'}
                </Button>
              </div>
            </form>

            <section id="pf-conta" className="pf-panel" aria-labelledby="pf-conta-t">
              <h2 id="pf-conta-t"><Shield aria-hidden /> Conta e segurança</h2>

              {needsPassword && !passwordLinked && (
                <form onSubmit={handleCriarSenha} className="pf-password">
                  <div>
                    <strong>Criar senha</strong>
                    <p>Você entrou com o Google. Crie uma senha para também poder entrar com e-mail e senha.</p>
                  </div>
                  <div className="pf-grid">
                    <input ref={novaSenha} type="password" placeholder="Nova senha (mín. 6 caracteres)" autoComplete="new-password" className="pf-input" aria-label="Nova senha" />
                    <input ref={confirmaNovaSenha} type="password" placeholder="Confirmar nova senha" autoComplete="new-password" className="pf-input" aria-label="Confirmar nova senha" />
                  </div>
                  <Button type="submit" loading={linkingPwd} variant="secondary">Criar senha</Button>
                </form>
              )}

              <div className="pf-legal">
                <span>Você aceitou os <Link to="/termos">Termos de Uso</Link> e a <Link to="/privacidade">Política de Privacidade</Link>{profile?.termsAcceptedAt ? ` em ${new Date(profile.termsAcceptedAt).toLocaleDateString('pt-BR')}` : ''}.</span>
              </div>

              <div className="pf-danger">
                <div>
                  <strong>Excluir conta</strong>
                  <p>Ação <b>permanente e irreversível</b>. Todos os seus dados são removidos do sistema.</p>
                </div>
                <Button variant="danger" size="sm" icon={DeleteForever} onClick={() => setConfirmDelete(true)} disabled={deleting || saving}>
                  Excluir minha conta permanentemente
                </Button>
              </div>
            </section>
          </div>
        </div>
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