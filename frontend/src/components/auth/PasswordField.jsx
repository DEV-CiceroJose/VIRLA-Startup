import { useState } from 'react'
import Lock from '@mui/icons-material/Lock'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { Field } from '../ui'

/** Campo de senha com botão de mostrar/ocultar (como no Sign In Page do 21st.dev). */
export default function PasswordField({ ref, label, ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="va-password">
      <Field ref={ref} label={label} icon={Lock} type={show ? 'text' : 'password'} className="pr-12" {...props} />
      <button
        type="button"
        className="va-eye"
        aria-label={show ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        aria-pressed={show}
        onClick={() => setShow((value) => !value)}
      >
        {show ? <VisibilityOff aria-hidden /> : <Visibility aria-hidden />}
      </button>
    </div>
  )
}
