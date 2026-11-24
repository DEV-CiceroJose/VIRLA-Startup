import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import VerifiedUser from '@mui/icons-material/VerifiedUser'
import HourglassTopOutlined from '@mui/icons-material/HourglassTopOutlined'
import ErrorOutline from '@mui/icons-material/ErrorOutlineOutlined'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import OpenInNew from '@mui/icons-material/OpenInNew'
import LockOutlined from '@mui/icons-material/LockOutlined'
import { Field, DatePickerField } from '../../components/ui'
import DocumentDrop from '../../components/verification/DocumentDrop'
import { useAuth } from '../../context/AuthContext'
import {
  getMyVerification,
  uploadVerificationDocument,
  submitVerification,
  documentObjectUrl,
  PF_CERTIDAO_URL,
  CRIMINAL_RECORD_MAX_AGE_DAYS,
} from '../../services/verification'
import { addDays, todayISO, formatDate } from '../../components/ui/dateUtils'
import '../../design-system/verification.css'

const STEPS = [
  {
    kind: 'identity',
    title: 'Documento com foto',
    text: 'RG, CNH ou outro documento oficial. Frente e verso legíveis (pode ser um PDF ou duas fotos juntas).',
    hint: 'JPG, PNG, WEBP ou PDF · até 8 MB',
  },
  {
    kind: 'selfie',
    title: 'Selfie segurando o documento',
    text: 'Rosto e documento visíveis na mesma foto, com boa luz e sem óculos escuros.',
    hint: 'Foto JPG, PNG ou WEBP · até 8 MB',
  },
  {
    kind: 'criminalRecord',
    title: 'Certidão de antecedentes criminais',
    text: `Emitida há no máximo ${CRIMINAL_RECORD_MAX_AGE_DAYS} dias. A da Polícia Federal é gratuita e sai na hora.`,
    hint: 'PDF da certidão · até 8 MB',
  },
]

const STATUS = {
  NAO_ENVIADO: { tone: 'brand', Icon: ShieldOutlined, title: 'Verifique seu perfil para começar', text: 'Famílias só encontram cuidadores verificados. Envie os três documentos abaixo; a equipe VIRLA confere tudo, inclusive a autenticidade da certidão.' },
  EM_ANALISE: { tone: 'wait', Icon: HourglassTopOutlined, title: 'Recebemos seus documentos', text: 'A equipe VIRLA está analisando. Você recebe uma notificação assim que terminarmos.' },
  APROVADO: { tone: 'ok', Icon: VerifiedUser, title: 'Perfil verificado', text: 'Seus documentos e antecedentes foram aprovados. Seu perfil aparece para as famílias e você já recebe solicitações.' },
  REPROVADO: { tone: 'risk', Icon: ErrorOutline, title: 'Verificação não aprovada', text: 'Corrija o que a equipe apontou e envie de novo.' },
}

export default function Verificacao() {
  const { profile, refreshProfile } = useAuth()
  const [verification, setVerification] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [uploading, setUploading] = useState('')
  const [code, setCode] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [declaration, setDeclaration] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyVerification()
      .then((v) => {
        if (cancelled) return
        setVerification(v)
        setCode(v.criminalRecordCode ?? '')
        setIssuedAt(v.criminalRecordIssuedAt ?? '')
      })
      .catch(() => { if (!cancelled) setLoadError('Não foi possível carregar sua verificação. Tente de novo em instantes.') })
    return () => { cancelled = true }
  }, [])

  async function handleFile(kind, file) {
    setUploading(kind)
    try {
      setVerification(await uploadVerificationDocument(kind, file))
      toast.success('Documento enviado.')
    } catch (err) {
      toast.error(err.response?.data?.msg ?? 'Não foi possível enviar o documento.')
    } finally {
      setUploading('')
    }
  }

  async function handleView(kind) {
    try {
      const url = await documentObjectUrl(profile.id, kind)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      toast.error('Não foi possível abrir o documento.')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!declaration) {
      toast.warning('Confirme a declaração de veracidade para enviar.')
      return
    }
    setSending(true)
    try {
      setVerification(await submitVerification({ criminalRecordCode: code.trim(), criminalRecordIssuedAt: issuedAt, declaration: true }))
      await refreshProfile().catch(() => {})
      toast.success('Verificação enviada para análise.')
    } catch (err) {
      toast.error(err.response?.data?.msg ?? 'Não foi possível enviar sua verificação.')
    } finally {
      setSending(false)
    }
  }

  if (!verification && !loadError) {
    return <div className="comfort-page min-h-screen pt-16"><div className="vd-dash vv-page"><p role="status" className="vv-loading">Carregando sua verificação…</p></div></div>
  }

  const status = verification?.status ?? 'NAO_ENVIADO'
  const info = STATUS[status] ?? STATUS.NAO_ENVIADO
  const editable = status === 'NAO_ENVIADO' || status === 'REPROVADO'
  const sentCount = verification ? STEPS.filter((s) => verification.documents?.[s.kind]?.sent).length : 0
  const ready = sentCount === STEPS.length && code.trim().length >= 4 && issuedAt && declaration

  return (
    <div className="comfort-page min-h-screen pt-16">
      <div className="vd-dash vv-page">
        <header className="vd-greeting">
          <h1>Verificação de segurança</h1>
          <p>Documentos e antecedentes conferidos pela equipe protegem as famílias, quem recebe o cuidado e você.</p>
        </header>

        {loadError && <div role="alert" className="vv-alert">{loadError}</div>}

        {verification && (
          <>
            <section className={`vv-status tone-${info.tone}`} aria-live="polite">
              <span className="vv-status-icon"><info.Icon aria-hidden /></span>
              <div>
                <h2>{info.title}</h2>
                <p>{info.text}</p>
                {status === 'REPROVADO' && verification.rejectionReason && (
                  <p className="vv-reason"><strong>Motivo:</strong> {verification.rejectionReason}</p>
                )}
                {status === 'EM_ANALISE' && verification.submittedAt && (
                  <p className="vv-meta">Enviado em {new Date(verification.submittedAt).toLocaleDateString('pt-BR')}</p>
                )}
                {status === 'APROVADO' && (
                  <Link to="/solicitacoes-disponiveis" className="vv-status-link">Ver solicitações disponíveis</Link>
                )}
              </div>
              {editable && (
                <div className="vv-progress" aria-label={`${sentCount} de ${STEPS.length} documentos enviados`}>
                  <strong>{sentCount}/{STEPS.length}</strong>
                  <span>documentos</span>
                </div>
              )}
            </section>

            <form className="vv-grid" onSubmit={handleSubmit}>
              <ol className="vv-steps">
                {STEPS.map((step, index) => {
                  const sent = verification.documents?.[step.kind]?.sent
                  return (
                    <li key={step.kind} className={`vv-step${sent ? ' is-sent' : ''}`}>
                      <span className="vv-step-num" aria-hidden="true">{index + 1}</span>
                      <div className="vv-step-body">
                        <h3>{step.title}</h3>
                        <p>{step.text}</p>
                        {step.kind === 'criminalRecord' && editable && (
                          <a className="vv-ext" href={PF_CERTIDAO_URL} target="_blank" rel="noreferrer">
                            Emitir certidão na Polícia Federal <OpenInNew aria-hidden />
                          </a>
                        )}
                        <DocumentDrop
                          id={`doc-${step.kind}`}
                          label={step.title}
                          hint={step.hint}
                          sent={sent}
                          uploading={uploading === step.kind}
                          disabled={!editable}
                          onFile={(file) => handleFile(step.kind, file)}
                          onView={() => handleView(step.kind)}
                        />
                        {step.kind === 'criminalRecord' && (
                          <div className="vv-cert">
                            <Field
                              label="Código de validação da certidão"
                              placeholder="Ex.: 1234.5678.9012"
                              value={code}
                              onChange={(e) => setCode(e.target.value)}
                              disabled={!editable}
                              maxLength={64}
                            />
                            {editable ? (
                              <DatePickerField
                                label="Data de emissão"
                                value={issuedAt}
                                onChange={(e) => setIssuedAt(e.target.value)}
                                min={addDays(todayISO(), -CRIMINAL_RECORD_MAX_AGE_DAYS)}
                                max={todayISO()}
                                shortcuts={false}
                                placeholder="dd/mm/aaaa"
                              />
                            ) : (
                              <Field label="Data de emissão" value={formatDate(issuedAt)} disabled />
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>

              <aside className="vv-side">
                <div className="vv-privacy">
                  <LockOutlined aria-hidden />
                  <div>
                    <strong>Seus documentos ficam protegidos</strong>
                    <p>Guardados criptografados, nunca aparecem no seu perfil e só a equipe de verificação acessa, com registro de cada acesso. Saiba mais na <Link to="/privacidade">Política de Privacidade</Link>.</p>
                  </div>
                </div>

                {editable && (
                  <div className="vv-submit">
                    <label className="vv-declaration">
                      <input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} />
                      <span>Declaro, sob as penas da lei, que as informações e os documentos enviados são verdadeiros e autorizo a VIRLA a conferi-los.</span>
                    </label>
                    <button type="submit" className="vv-send" disabled={!ready || sending}>
                      {sending ? 'Enviando…' : 'Enviar para análise'}
                    </button>
                    {!ready && <p className="vv-hint">Envie os três documentos, informe o código e a data da certidão e marque a declaração.</p>}
                  </div>
                )}
              </aside>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
