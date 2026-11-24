import { useTheme } from '../../../design-system/theme/ThemeProvider'
import { spillTheme } from '../../../design-system/theme/inkSpill'

/** Botão sol/lua do cabeçalho da landing; a troca usa a tinta de inkSpill.js. */
export default function InkThemeToggle({ className = '' }) {
  const { isDark, setTheme } = useTheme()
  const label = `Ativar tema ${isDark ? 'claro' : 'escuro'}`

  return (
    <button
      type="button"
      className={`landing-ink-toggle ${className}`.trim()}
      onClick={(event) => spillTheme({ from: event.currentTarget, next: isDark ? 'light' : 'dark', setTheme })}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
          </>
        ) : (
          <path d="M20 14.6A8.4 8.4 0 0 1 9.4 4a8.4 8.4 0 1 0 10.6 10.6Z" />
        )}
      </svg>
    </button>
  )
}
