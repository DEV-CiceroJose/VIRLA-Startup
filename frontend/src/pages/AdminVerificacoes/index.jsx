import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import OpenInNew from '@mui/icons-material/OpenInNew'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Block from '@mui/icons-material/Block'
import Inbox from '@mui/icons-material/InboxOutlined'
import Avatar from '../../components/Avatar'
import {
  listVerifications,
  approveVerification,
  rejectVerification,
  fetchDocument,
  PF_CERTIDAO_URL,
} from '../../services/verification'
import { formatDate } from '../../components/ui/dateUtils'
import '../../design-system/verification.css'

const TABS = [
  { value: 'EM_ANALISE', label: 'Em análise' },
  { value: 'APROVADO', label: 'Aprovadas' },
  { value: 'REPROVADO', label: 'Reprovadas' },
]

const DOCS = [
  { kind: 'identity', label: 'Documento com foto' },
  { kind: 'selfie', label: 'Selfie com o documento' },
  { kind: 'criminalRecord', label: 'Certidão de antecedentes' },
]

const CHECKLIST = [
  'A foto do documento confere com a selfie',
  'Nome, CPF e data de nascimento conferem com o cadastro',
  'Certidão validada no site do órgão emissor com o código informado',
  'Certidão emitida há no máximo 90 dias e sem registros que impeçam o trabalho',
]

const maskCpf = (cpf) => (cpf && cpf.length === 11 ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : cpf ?? '—')
const dateTime = (value) => (value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')

/** Prévia autenticada: baixa o arquivo como blob e mostra imagem ou PDF. */
function DocPreview({ userId, kind, label }) {
  const [url, setUrl] = useState(null)
  const [type, setType] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    fetchDocument(userId, kind)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setType(blob.type)
        setUrl(objectUrl)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [userId, kind])

  return (
    <figure className="vr-doc">
      <figcaption>
        <span>{label}</span>
        {url && <a href={url} target="_blank" rel="noreferrer">Abrir <OpenInNew aria-hidden /></a>}
      </figcaption>
      <div className="vr-doc-frame">
        {failed && <p>Não foi possível carregar.</p>}
        {!failed && !url && <p>Carregando…</p>}
        {url && type.startsWith('image/') && <img src={url} alt={label} />}
        {url && type === 'application/pdf' && <iframe src={url} title={label} />}
      </div>
    </figure>
  )
}

export default function AdminVerificacoes() {
  const [tab, setTab] = useState('EM_ANALISE')
  const [items, setItems] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [checks, setChecks] = useState([])
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    listVerifications(tab)
      .then((list) => {
        if (cancelled) return
        setItems(list)
        setSelectedId(list[0]?.userId ?? null)
      })
      .catch(() => { if (!cancelled) { setItems([]); toast.error('Não foi possível carregar as verificações.') } })
    return () => { cancelled = true }
  }, [tab])

  const selected = useMemo(() => items?.find((v) => v.userId === selectedId) ?? null, [items, selectedId])

  function select(id) {
    setSelectedId(id)
    setChecks([])
    setReason('')
  }

  function changeTab(value) {
    if (value === tab) return
    setItems(null)
    setChecks([])
    setReason('')
    setTab(value)
  }

  async function decide(approve) {
    if (!selected) return
    if (!approve && reason.trim().length < 10) {
      toast.warning('Explique o motivo da reprovação (mínimo 10 caracteres).')
      return
    }
    setBusy(true)
    try {
      if (approve) await approveVerification(selected.userId)
      else await rejectVerification(selected.userId, reason.trim())
      toast.success(approve ? `${selected.name} foi aprovado(a).` : `Verificação de ${selected.name} reprovada.`)
      const rest = items.filter((v) => v.userId !== selected.userId)
      setItems(rest)
      select(rest[0]?.userId ?? null)
    } catch (err) {
      toast.error(err.response?.data?.msg ?? 'Não foi possível concluir a revisão.')
    } finally {
      setBusy(false)
    }
  }

  const reviewing = tab === 'EM_ANALISE'
  const allChecked = checks.length === CHECKLIST.length

  return (
    <div className="comfort-page min-h-screen pt-16">
      <div className="vd-dash vr-page">
        <header className="vd-greeting">
          <h1>Verificações</h1>
          <p>Confira documentos e antecedentes antes de liberar um cuidador para as famílias.</p>
        </header>

        <div className="vr-tabs" role="tablist" aria-label="Situação">
          {TABS.map((t) => (
            <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} className="vr-tab" onClick={() => changeTab(t.value)}>
              {t.label}
              {tab === t.value && items && <span className="vr-count">{items.length}</span>}
            </button>
          ))}
        </div>

        {!items && <p role="status" className="vv-loading">Carregando…</p>}

        {items && items.length === 0 && (
          <div className="vd-empty vr-empty">
            <Inbox aria-hidden />
            <strong>{reviewing ? 'Nenhuma verificação esperando revisão' : 'Nada por aqui ainda'}</strong>
            <span>{reviewing ? 'Quando um cuidador enviar documentos, ele aparece aqui.' : 'As verificações revisadas aparecem nesta aba.'}</span>
          </div>
        )}

        {items && items.length > 0 && (
          <div className="vr-layout">
            <ul className="vr-list" aria-label="Cuidadores">
              {items.map((v) => (
                <li key={v.userId}>
                  <button type="button" className={`vr-item${v.userId === selectedId ? ' is-active' : ''}`} onClick={() => select(v.userId)} aria-current={v.userId === selectedId}>
                    <Avatar src={v.profileImage} name={v.name} size={40} />
                    <span className="vr-item-text">
                      <strong>{v.name}</strong>
                      <small>{reviewing ? `Enviado ${dateTime(v.submittedAt)}` : `Revisado ${dateTime(v.reviewedAt)}`}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {selected && (
              <section className="vr-detail" aria-labelledby="vr-name">
                <header className="vr-person">
                  <Avatar src={selected.profileImage} name={selected.name} size={56} radius={16} />
                  <div>
                    <h2 id="vr-name">{selected.name}</h2>
                    <p>{[selected.city, selected.state].filter(Boolean).join(', ') || 'Cidade não informada'}</p>
                  </div>
                </header>

                <dl className="vr-facts">
                  <div><dt>CPF</dt><dd>{maskCpf(selected.cpf)}</dd></div>
                  <div><dt>Nascimento</dt><dd>{selected.birthDate ? new Date(selected.birthDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</dd></div>
                  <div><dt>E-mail</dt><dd>{selected.email ?? '—'}</dd></div>
                  <div><dt>Registro</dt><dd>{selected.council ? `${selected.council} ${selected.registerNumber}` : 'Não informado'}</dd></div>
                  <div><dt>Código da certidão</dt><dd className="vr-mono">{selected.criminalRecordCode ?? '—'}</dd></div>
                  <div><dt>Emitida em</dt><dd>{formatDate(selected.criminalRecordIssuedAt) || '—'}</dd></div>
                </dl>
                <a className="vv-ext" href={PF_CERTIDAO_URL} target="_blank" rel="noreferrer">
                  Validar a certidão no site da Polícia Federal <OpenInNew aria-hidden />
                </a>

                <div className="vr-docs">
                  {DOCS.filter((d) => selected.documentKinds?.includes(d.kind)).map((d) => (
                    <DocPreview key={`${selected.userId}-${d.kind}`} userId={selected.userId} kind={d.kind} label={d.label} />
                  ))}
                </div>

                {reviewing ? (
                  <div className="vr-review">
                    <fieldset className="vr-checklist">
                      <legend>Antes de aprovar, confirme</legend>
                      {CHECKLIST.map((item, index) => (
                        <label key={item}>
                          <input
                            type="checkbox"
                            checked={checks.includes(index)}
                            onChange={(e) => setChecks((c) => (e.target.checked ? [...c, index] : c.filter((i) => i !== index)))}
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </fieldset>
                    <label className="vr-reason">
                      <span>Motivo, se for reprovar (o cuidador vê este texto)</span>
                      <textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: a selfie está sem foco; envie outra com o documento legível." />
                    </label>
                    <div className="vr-actions">
                      <button type="button" className="vr-reject" onClick={() => decide(false)} disabled={busy}><Block aria-hidden /> Reprovar</button>
                      <button type="button" className="vr-approve" onClick={() => decide(true)} disabled={busy || !allChecked}><CheckCircle aria-hidden /> Aprovar</button>
                    </div>
                  </div>
                ) : (
                  <p className={`vr-outcome ${tab === 'APROVADO' ? 'is-ok' : 'is-risk'}`}>
                    {tab === 'APROVADO' ? 'Aprovada' : 'Reprovada'} em {dateTime(selected.reviewedAt)}
                    {selected.rejectionReason && <> · Motivo: {selected.rejectionReason}</>}
                  </p>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
