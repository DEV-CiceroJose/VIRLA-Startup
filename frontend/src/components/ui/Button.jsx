import { forwardRef } from 'react'
import { ButtonSpinner } from '../Spinner'

/**
 * Botão padrão do Design System Virla.
 *
 * Variantes:
 *  - primary   → roxo sólido (ação principal)
 *  - secondary → contorno roxo (ação secundária)
 *  - ghost     → sem fundo, hover suave
 *  - danger    → vermelho sólido (ações destrutivas)
 *  - success   → verde sólido (confirmações de pagamento)
 *
 * Suporta `loading`, `icon`, `fullWidth` e renderização polimórfica via `as`
 * (ex.: `as={Link}` do react-router) preservando todo o comportamento.
 */
const VARIANTS = {
  primary:
    'bg-virla-roxo text-white shadow-virla hover:bg-virla-roxohighlight hover:shadow-virla-lg ' +
    'hover:-translate-y-0.5 active:translate-y-0',
  secondary:
    'border-2 border-virla-roxo text-virla-roxo bg-transparent hover:bg-virla-roxo/10 ' +
    'active:bg-virla-roxo/15',
  ghost:
    'text-virla-roxo bg-transparent hover:bg-virla-roxo/10 active:bg-virla-roxo/15',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md',
  success:
    'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow-md',
}

const SIZES = {
  sm: 'px-3.5 py-2 text-xs gap-1.5 rounded-lg',
  md: 'px-5 py-3 text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3.5 text-base gap-2 rounded-xl',
}

const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    icon: Icon = null,
    iconRight = false,
    fullWidth = false,
    className = '',
    disabled,
    children,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading
  const isNativeButton = Component === 'button'

  const classes = [
    'inline-flex items-center justify-center font-semibold select-none',
    'transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virla-roxo/50 focus-visible:ring-offset-2',
    'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-virla',
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const iconNode = loading ? (
    <ButtonSpinner size={size === 'sm' ? 16 : 20} />
  ) : Icon ? (
    <Icon sx={{ fontSize: size === 'sm' ? 16 : 20 }} aria-hidden />
  ) : null

  return (
    <Component
      ref={ref}
      className={classes}
      aria-busy={loading || undefined}
      {...(isNativeButton ? { disabled: isDisabled } : { 'aria-disabled': isDisabled || undefined })}
      {...props}
    >
      {!iconRight && iconNode}
      {children}
      {iconRight && iconNode}
    </Component>
  )
})

export default Button
