import { DarkModeOutlined, LightModeOutlined } from '@mui/icons-material'
import { IconButton, Tooltip } from '@mui/material'
import { useTheme } from './ThemeProvider'

/**
 * Alternância de tema.
 * - `floating` (padrão): botão fixo no canto, usado nas páginas públicas.
 * - `inline`: botão comum para a topbar/cabeçalho da área logada.
 */
export default function ThemeToggle({ variant = 'floating', className = '' }) {
  const { isDark, toggleTheme } = useTheme()
  const nextTheme = isDark ? 'claro' : 'escuro'
  const label = `Ativar tema ${nextTheme}`

  if (variant === 'inline') {
    return (
      <button type="button" onClick={toggleTheme} aria-label={label} title={label} className={className}>
        {isDark ? <LightModeOutlined sx={{ fontSize: 21 }} /> : <DarkModeOutlined sx={{ fontSize: 21 }} />}
      </button>
    )
  }

  return (
    <Tooltip title={label}>
      <IconButton
        onClick={toggleTheme}
        aria-label={label}
        size="large"
        sx={{
          position: 'fixed',
          right: { xs: 16, sm: 24 },
          bottom: { xs: 16, sm: 24 },
          zIndex: 1200,
          width: 48,
          height: 48,
          color: 'var(--virla-text-primary)',
          backgroundColor: 'var(--virla-surface-raised)',
          border: '1px solid var(--virla-border)',
          boxShadow: 'var(--virla-shadow-floating)',
          '&:hover': {
            backgroundColor: 'var(--virla-surface-muted)',
          },
        }}
      >
        {isDark ? <LightModeOutlined /> : <DarkModeOutlined />}
      </IconButton>
    </Tooltip>
  )
}
