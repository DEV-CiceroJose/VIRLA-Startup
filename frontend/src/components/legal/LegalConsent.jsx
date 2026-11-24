import { useState } from 'react'
import CheckCircle from '@mui/icons-material/CheckCircle'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import ChevronRight from '@mui/icons-material/ChevronRight'
import LegalDialog from './LegalDialog'
import { TERMS, PRIVACY } from '../../pages/Legal/documents'
import '../../design-system/legal.css'

const ITEMS = [
  { key: 'terms', doc: TERMS, Icon: DescriptionOutlined },
  { key: 'privacy', doc: PRIVACY, Icon: ShieldOutlined },
]

/**
 * Aceite obrigatório no cadastro: cada documento abre na LegalDialog e só
 * conta como aceito depois de lido até o fim. `value` = { terms, privacy }.
 */
export default function LegalConsent({ value, onChange }) {
  const [openKey, setOpenKey] = useState(null)
  const current = ITEMS.find((item) => item.key === openKey)
  const all = value.terms && value.privacy

  return (
    <div className={`vl-consent${all ? ' is-done' : ''}`}>
      <p className="vl-consent-title">
        {all ? 'Tudo certo: você leu e aceitou os dois documentos.' : 'Antes de criar a conta, leia e aceite:'}
      </p>
      <ul>
        {ITEMS.map(({ key, doc, Icon }) => (
          <li key={key}>
            <button type="button" className={`vl-consent-row${value[key] ? ' is-accepted' : ''}`} onClick={() => setOpenKey(key)}>
              <span className="vl-consent-icon"><Icon aria-hidden /></span>
              <span className="vl-consent-text">
                <strong>{doc.title}</strong>
                <small>{value[key] ? 'Lido e aceito' : 'Toque para ler'}</small>
              </span>
              {value[key] ? <CheckCircle aria-label="Aceito" className="vl-consent-check" /> : <ChevronRight aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <LegalDialog
          doc={current.doc}
          open
          onClose={() => setOpenKey(null)}
          onAccept={() => { onChange({ ...value, [current.key]: true }); setOpenKey(null) }}
        />
      )}
    </div>
  )
}
