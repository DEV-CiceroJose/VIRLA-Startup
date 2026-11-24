import { useRef, useState } from 'react'
import LocationOnOutlined from '@mui/icons-material/LocationOnOutlined'
import CheckCircle from '@mui/icons-material/CheckCircle'
import ErrorOutline from '@mui/icons-material/ErrorOutlineOutlined'
import { InlineSpinner } from '../Spinner'
import Field from './Field'
import { lookupCep } from '../../services/viacep'
import { maskCep } from '../../utils/formatters'
import './cep-field.css'

/**
 * Campo único de CEP: ao completar os 8 dígitos consulta o ViaCEP e mostra
 * rua, bairro, cidade e estado num cartão logo abaixo (sem campos extras).
 *
 * - `value`: CEP com ou sem máscara.
 * - `address`: { street, neighborhood, city, state } atual (para exibir).
 * - `onChange(cep)`: CEP mascarado a cada tecla.
 * - `onResolve(address | null)`: endereço encontrado, ou null se o CEP foi
 *   apagado/alterado ou não existe (quem chama limpa os campos).
 */
export default function CepField({ label = 'CEP', value, address, onChange, onResolve, hint, required }) {
  const [status, setStatus] = useState('idle') // idle | loading | found | missing
  const lastQuery = useRef('')

  async function handleChange(event) {
    const masked = maskCep(event.target.value)
    onChange(masked)
    const digits = masked.replace(/\D/g, '')
    if (digits.length !== 8) {
      if (lastQuery.current) onResolve(null)
      lastQuery.current = ''
      setStatus('idle')
      return
    }
    if (digits === lastQuery.current) return
    lastQuery.current = digits
    setStatus('loading')
    const result = await lookupCep(digits)
    if (lastQuery.current !== digits) return // o usuário já digitou outro CEP
    onResolve(result)
    setStatus(result ? 'found' : 'missing')
  }

  const hasAddress = Boolean(address?.city)
  const line1 = [address?.street, address?.neighborhood].filter(Boolean).join(', ')
  const line2 = [address?.city, address?.state].filter(Boolean).join(' - ')

  return (
    <div className="cep-field">
      <Field
        label={label}
        icon={LocationOnOutlined}
        type="text"
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="00000-000"
        value={value ?? ''}
        onChange={handleChange}
        maxLength={9}
        required={required}
        hint={status === 'missing' ? undefined : hint}
        error={status === 'missing' ? 'CEP não encontrado. Confira os números.' : undefined}
      />
      <div className="cep-result" aria-live="polite">
        {status === 'loading' && (
          <p className="cep-card is-loading"><InlineSpinner size={16} /> Buscando endereço…</p>
        )}
        {status !== 'loading' && hasAddress && (
          <div className="cep-card">
            <CheckCircle aria-hidden className="cep-ok" />
            <div>
              {line1 && <strong>{line1}</strong>}
              <span>{line2}</span>
            </div>
          </div>
        )}
        {status === 'missing' && !hasAddress && (
          <p className="cep-card is-missing"><ErrorOutline aria-hidden /> Sem endereço para esse CEP.</p>
        )}
      </div>
    </div>
  )
}
