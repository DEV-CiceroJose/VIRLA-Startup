import { useId } from 'react'

/**
 * Campo de formulário acessível do Design System Virla.
 *
 * - Sempre gera um <label> associado (htmlFor/id) — corrige o uso de
 *   placeholder como rótulo.
 * - Ícone opcional à esquerda (decorativo, aria-hidden).
 * - Estados de erro com aria-invalid + aria-describedby.
 * - Suporta input, textarea e select via `as`.
 *
 * Aceita `ref` para manter compatibilidade com formulários não-controlados
 * (useRef) já existentes no projeto.
 */
import { forwardRef } from 'react'

const BASE_INPUT =
  'w-full rounded-xl border bg-white/80 text-virla-texto placeholder-virla-texto/40 text-sm ' +
  'transition-all duration-200 focus:outline-none focus:ring-2 ' +
  'disabled:bg-gray-50 disabled:text-virla-texto/40 disabled:cursor-not-allowed'

const Field = forwardRef(function Field(
  {
    label,
    icon: Icon,
    error,
    hint,
    as = 'input',
    className = '',
    id: providedId,
    required,
    srOnlyLabel = false,
    children,
    ...props
  },
  ref,
) {
  const autoId = useId()
  const id = providedId ?? autoId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const Component = as

  const stateRing = error
    ? 'border-red-300 focus:ring-red-300 focus:border-red-400'
    : 'border-virla-roxomid/70 focus:ring-virla-roxo/40 focus:border-virla-roxo'

  const padding = Icon
    ? as === 'textarea'
      ? 'pl-10 pr-4 py-3'
      : 'pl-10 pr-4 py-3'
    : 'px-4 py-3'

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className={
            srOnlyLabel
              ? 'sr-only'
              : 'block text-xs font-semibold text-virla-muted uppercase tracking-wide'
          }
        >
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden>*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon
            sx={{ fontSize: 18 }}
            className={`absolute left-3 ${
              as === 'textarea' ? 'top-3.5' : 'top-1/2 -translate-y-1/2'
            } text-virla-roxo/50 pointer-events-none`}
            aria-hidden
          />
        )}
        <Component
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${BASE_INPUT} ${stateRing} ${padding} ${
            as === 'select' ? 'appearance-none cursor-pointer' : ''
          } ${as === 'textarea' ? 'resize-none' : ''} ${className}`}
          {...props}
        >
          {children}
        </Component>
      </div>

      {hint && !error && (
        <p id={hintId} className="text-xs text-virla-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-600 font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

export default Field
